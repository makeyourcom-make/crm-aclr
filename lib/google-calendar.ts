/**
 * Client Google Calendar (API v3 + OAuth2) pour la sync bidirectionnelle
 * de l'agenda CRM avec un compte Gmail.
 *
 * Zéro dépendance lourde : l'OAuth (échange/refresh de token) et l'API
 * Calendar sont appelés en `fetch` natif. Le refresh token est chiffré en
 * base (AES-256-GCM, clé = AUTH_SECRET) — voir lib/caldav (encrypt/decrypt).
 *
 * Architecture (miroir de lib/caldav.ts) :
 *  - OAuth : buildAuthUrl / exchangeCode / refreshAccessToken / signState
 *  - PUSH  : upsertGoogleEvent (insert|patch) / deleteGoogleEvent
 *  - PULL  : listGoogleEventsIncremental (events.list + syncToken)
 *  - MAP   : activityToGoogleEvent / googleEventToFields
 */
import { createHmac } from "node:crypto";

// Réutilise le chiffrement AES-GCM déjà en place pour CalDAV.
export { encryptPassword as encryptToken, decryptPassword as decryptToken } from "@/lib/caldav";

// ===========================================================================
// CONFIG OAUTH
// ===========================================================================

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";

/** Scopes : gérer les events + lire l'email du compte connecté. */
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
].join(" ");

export function appBaseUrl(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "https://crm.makeyourcom.ch"
  ).replace(/\/+$/, "");
}

export function googleRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI ?? `${appBaseUrl()}/api/google/callback`;
}

export function googleOAuthConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

function clientCreds(): { id: string; secret: string } {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants.");
  }
  return { id, secret };
}

// ===========================================================================
// STATE signé (CSRF + identité) — HMAC AUTH_SECRET
// ===========================================================================

function stateSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET manquant.");
  return s;
}

/** state = base64url(userId).base64url(hmac) — lie le callback à l'utilisateur. */
export function signState(userId: string): string {
  const payload = Buffer.from(userId, "utf8").toString("base64url");
  const mac = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyState(state: string | null): string | null {
  if (!state) return null;
  const [payload, mac] = state.split(".");
  if (!payload || !mac) return null;
  const expected = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");
  if (mac !== expected) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

// ===========================================================================
// OAUTH — URL de consentement, échange de code, refresh
// ===========================================================================

export function buildAuthUrl(state: string): string {
  const { id } = clientCreds();
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline", // nécessaire pour obtenir un refresh_token
    prompt: "consent", // force le refresh_token même si déjà consenti
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
}

/** Décode le payload d'un id_token JWT (sans vérif — usage : lire l'email). */
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string): Promise<{
  refreshToken: string | null;
  accessToken: string;
  email: string | null;
}> {
  const { id, secret } = clientCreds();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Échange de code Google échoué: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as TokenResponse;
  return {
    refreshToken: data.refresh_token ?? null,
    accessToken: data.access_token,
    email: emailFromIdToken(data.id_token),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { id, secret } = clientCreds();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Refresh token Google échoué: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}

// ===========================================================================
// MAPPING Activity ↔ Google event
// ===========================================================================

const TYPE_LABEL: Record<string, string> = {
  RDV_PHYSIQUE: "RDV",
  RDV_VISIO: "Visio",
  RDV_TELEPHONIQUE: "RDV tél.",
  APPEL_SORTANT: "Appel",
  APPEL_ENTRANT: "Appel reçu",
  EMAIL_ENVOYE: "Email",
  EMAIL_RECU: "Email reçu",
  SMS: "SMS",
  LINKEDIN: "LinkedIn",
  NOTE: "Note",
};

export interface ActivityForGoogle {
  id: string;
  type: string;
  sujet: string;
  contenu: string | null;
  adresseRdv: string | null;
  date: Date;
  duree: number | null;
  statut: string;
  googleEventId: string | null;
  prospect: { id: string; raisonSociale: string } | null;
}

interface GoogleEventBody {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  status?: string;
}

const TZ = "Europe/Zurich";

function activityToGoogleEvent(a: ActivityForGoogle, appUrl: string): GoogleEventBody {
  const dureeMin = a.duree ?? 30;
  const start = a.date;
  const end = new Date(start.getTime() + dureeMin * 60 * 1000);
  const prefix = TYPE_LABEL[a.type] ?? a.type;
  const clientPart = a.prospect ? ` — ${a.prospect.raisonSociale}` : "";
  const summary = `[${prefix}]${clientPart} ${a.sujet}`.trim();

  const descParts: string[] = [];
  if (a.contenu) descParts.push(a.contenu);
  if (a.prospect) descParts.push(`${appUrl}/prospects/${a.prospect.id}`);
  descParts.push(`Statut: ${a.statut}`);

  const body: GoogleEventBody = {
    summary,
    description: descParts.join("\n"),
    start: { dateTime: start.toISOString(), timeZone: TZ },
    end: { dateTime: end.toISOString(), timeZone: TZ },
    status: a.statut === "ANNULE" ? "cancelled" : "confirmed",
  };
  if (a.adresseRdv) body.location = a.adresseRdv;
  return body;
}

/** Retire le préfixe "[Type] — Client :" ajouté au push, pour un sujet propre. */
export function stripGooglePrefix(summary: string): string {
  const m = summary.match(/^\[[^\]]+\](?:\s+—\s+[^:]+:)?\s*(.+)$/);
  return m ? m[1]!.trim() : summary.trim();
}

/** Devine le type d'activité depuis un titre externe. */
export function guessActivityType(summary: string): string {
  const s = summary.toLowerCase();
  if (/visio|meet|zoom|teams|google\.com\/meet/.test(s)) return "RDV_VISIO";
  if (/\btél|telephon|appel/.test(s)) return "RDV_TELEPHONIQUE";
  if (/\brdv|rendez-vous|meeting/.test(s)) return "RDV_PHYSIQUE";
  return "NOTE";
}

// ===========================================================================
// PUSH — insert / patch / delete
// ===========================================================================

/** Crée (si googleEventId null) ou met à jour l'event Google. Retourne l'id. */
export async function upsertGoogleEvent(
  accessToken: string,
  calendarId: string,
  a: ActivityForGoogle,
  appUrl: string,
): Promise<string> {
  const body = activityToGoogleEvent(a, appUrl);
  const cal = encodeURIComponent(calendarId);

  if (a.googleEventId) {
    const res = await fetch(
      `${CAL_API}/calendars/${cal}/events/${encodeURIComponent(a.googleEventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (res.status === 404) {
      // L'event a disparu côté Google → on le recrée.
      return insertGoogleEvent(accessToken, calendarId, body);
    }
    if (!res.ok) {
      throw new Error(`PATCH event Google: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  }
  return insertGoogleEvent(accessToken, calendarId, body);
}

async function insertGoogleEvent(
  accessToken: string,
  calendarId: string,
  body: GoogleEventBody,
): Promise<string> {
  const cal = encodeURIComponent(calendarId);
  const res = await fetch(`${CAL_API}/calendars/${cal}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`INSERT event Google: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Supprime un event Google. Best-effort : 404/410 = déjà supprimé. */
export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const cal = encodeURIComponent(calendarId);
  const res = await fetch(
    `${CAL_API}/calendars/${cal}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 404 || res.status === 410 || res.ok) return;
  throw new Error(`DELETE event Google: ${res.status} ${await res.text()}`);
}

// ===========================================================================
// PULL — events.list incrémental (syncToken)
// ===========================================================================

export interface GoogleRemoteEvent {
  id: string;
  status: string; // "confirmed" | "tentative" | "cancelled"
  summary: string | null;
  description: string | null;
  location: string | null;
  start: Date | null;
  end: Date | null;
}

export interface GooglePullResult {
  events: GoogleRemoteEvent[];
  nextSyncToken: string | null;
  /** true si le syncToken était périmé (410) → un full resync a été fait. */
  didFullResync: boolean;
}

function parseGoogleDate(
  d: { dateTime?: string; date?: string } | undefined,
): Date | null {
  if (!d) return null;
  if (d.dateTime) return new Date(d.dateTime);
  if (d.date) return new Date(`${d.date}T00:00:00`); // event "journée entière"
  return null;
}

/**
 * Liste les events modifiés depuis le dernier syncToken (pull incrémental).
 * Sans syncToken → full sync borné à [−90j, +365j]. Gère le 410 GONE
 * (token périmé) en refaisant un full sync.
 */
export async function listGoogleEventsIncremental(
  accessToken: string,
  calendarId: string,
  syncToken: string | null,
): Promise<GooglePullResult> {
  const cal = encodeURIComponent(calendarId);
  const events: GoogleRemoteEvent[] = [];
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;
  let didFullResync = false;
  let useSyncToken = syncToken;

  // Boucle de pagination. On peut relancer en full sync si 410.
  for (let guard = 0; guard < 50; guard++) {
    const params = new URLSearchParams({
      singleEvents: "true", // récurrences éclatées en instances
      showDeleted: "true", // pour propager les suppressions
      maxResults: "250",
    });
    if (useSyncToken) {
      params.set("syncToken", useSyncToken);
    } else {
      // Full sync borné dans le temps.
      const now = Date.now();
      params.set("timeMin", new Date(now - 90 * 864e5).toISOString());
      params.set("timeMax", new Date(now + 365 * 864e5).toISOString());
      params.set("orderBy", "startTime");
    }
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `${CAL_API}/calendars/${cal}/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (res.status === 410 && useSyncToken) {
      // Token périmé → on repart sur un full sync propre.
      useSyncToken = null;
      pageToken = null;
      events.length = 0;
      didFullResync = true;
      continue;
    }
    if (!res.ok) {
      throw new Error(`events.list Google: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        status?: string;
        summary?: string;
        description?: string;
        location?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
      nextPageToken?: string;
      nextSyncToken?: string;
    };

    for (const it of data.items ?? []) {
      events.push({
        id: it.id,
        status: it.status ?? "confirmed",
        summary: it.summary ?? null,
        description: it.description ?? null,
        location: it.location ?? null,
        start: parseGoogleDate(it.start),
        end: parseGoogleDate(it.end),
      });
    }

    if (data.nextPageToken) {
      pageToken = data.nextPageToken;
      continue;
    }
    nextSyncToken = data.nextSyncToken ?? null;
    break;
  }

  return { events, nextSyncToken, didFullResync };
}
