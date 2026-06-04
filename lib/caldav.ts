/**
 * Client CalDAV pour synchroniser l'agenda CRM avec un serveur externe
 * (Infomaniak, Google, Apple, Nextcloud…).
 *
 * Architecture :
 *  - lecture : `pullEvents()` PROPFIND + REPORT calendar-query → liste events
 *  - écriture : `pushEvent()` PUT + DELETE
 *  - mapping Activity ↔ VEVENT défini ici (centralisé)
 *
 * Sécurité : le mot de passe d'application Infomaniak est chiffré dans la
 * DB avec AES-256-GCM (clé = AUTH_SECRET). On ne le déchiffre qu'au moment
 * d'appeler l'API CalDAV.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { DAVClient, type DAVCalendar, type DAVCalendarObject } from "tsdav";

// ===========================================================================
// CRYPTO — chiffrement du mot de passe Infomaniak
// ===========================================================================

function getEncKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET manquant pour chiffrement CalDAV.");
  // AES-256 requiert 32 bytes. AUTH_SECRET est base64(32 bytes) → décodé donne 32.
  // Si AUTH_SECRET n'est pas exactement 32 bytes, on dérive via SHA-256.
  const decoded = Buffer.from(secret, "base64");
  if (decoded.length === 32) return decoded;
  // Fallback : hash
  return Buffer.from(
    require("node:crypto").createHash("sha256").update(secret).digest(),
  );
}

export function encryptPassword(plain: string): string {
  const key = getEncKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format : <iv base64>.<tag base64>.<encrypted base64>
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptPassword(stored: string): string {
  const key = getEncKey();
  const parts = stored.split(".");
  if (parts.length !== 3) throw new Error("Format de mot de passe corrompu.");
  const iv = Buffer.from(parts[0]!, "base64");
  const tag = Buffer.from(parts[1]!, "base64");
  const encrypted = Buffer.from(parts[2]!, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

// ===========================================================================
// CONNEXION
// ===========================================================================

interface CaldavCreds {
  serverUrl: string;
  username: string;
  password: string;
}

/**
 * Construit + initialise un client CalDAV authentifié (utilitaire interne).
 */
async function makeClient(creds: CaldavCreds): Promise<DAVClient> {
  const client = new DAVClient({
    serverUrl: creds.serverUrl,
    credentials: {
      username: creds.username,
      password: creds.password,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
  await client.login();
  return client;
}

/**
 * Si l'URL contient déjà le path d'un calendrier précis
 * (`/calendars/<account>/<calendar>/` chez Sabre/DAV / Infomaniak), on
 * peut utiliser ce calendrier directement SANS la découverte standard
 * (PROPFIND DAV:current-user-principal) qui échoue parfois côté Infomaniak.
 *
 * Retourne { directUrl, displayName } si le PROPFIND minimal est OK,
 * sinon null pour fallback sur la découverte tsdav normale.
 */
async function tryDirectCalendarUrl(
  creds: CaldavCreds,
): Promise<{ url: string; displayName: string } | null> {
  try {
    const u = new URL(creds.serverUrl);
    // Le path doit ressembler à /calendars/<id>/<id>/ pour considérer
    // que c'est une URL de calendrier direct
    if (!/^\/calendars\/[^/]+\/[^/]+/.test(u.pathname)) return null;
    // Nettoie ?export et trailing slash → garde juste le calendrier
    const cleanPath = u.pathname.replace(/\/+$/, "") + "/";
    const calendarUrl = `${u.protocol}//${u.host}${cleanPath}`;
    const auth = Buffer.from(`${creds.username}:${creds.password}`).toString(
      "base64",
    );
    const res = await fetch(calendarUrl, {
      method: "PROPFIND",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/xml",
        Depth: "0",
      },
      body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:resourcetype/></d:prop></d:propfind>',
    });
    if (!res.ok) return null;
    const text = await res.text();
    const nameMatch = text.match(
      /<[a-z0-9]*:?displayname[^>]*>([^<]*)<\/[a-z0-9]*:?displayname>/i,
    );
    const displayName = nameMatch?.[1]?.trim() || "Calendrier Infomaniak";
    return { url: calendarUrl, displayName };
  } catch {
    return null;
  }
}

/**
 * Teste les credentials CalDAV. Retourne la liste des calendriers
 * disponibles si OK, ou une erreur lisible.
 */
export async function listAvailableCalendars(
  creds: CaldavCreds,
): Promise<{ ok: true; calendars: DAVCalendar[] } | { ok: false; error: string }> {
  // Mode "URL directe" : si l'utilisateur a collé l'URL CalDAV exacte d'un
  // calendrier (issu de Infomaniak → Partager / Exporter), on l'utilise
  // directement et on évite la découverte qui peut échouer.
  const direct = await tryDirectCalendarUrl(creds);
  if (direct) {
    return {
      ok: true,
      calendars: [
        {
          url: direct.url,
          displayName: direct.displayName,
          components: ["VEVENT"],
        } as unknown as DAVCalendar,
      ],
    };
  }

  // Découverte CalDAV standard via tsdav (Google, Apple, Nextcloud, …)
  try {
    const client = await makeClient(creds);
    const calendars = await client.fetchCalendars();
    const eventCalendars = calendars.filter((c) => {
      const comps = c.components ?? [];
      return comps.length === 0 || comps.includes("VEVENT");
    });
    return { ok: true, calendars: eventCalendars };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erreur de connexion CalDAV.";
    // Aide spécifique pour le cas "cannot find homeUrl"
    if (/cannot find homeUrl|currentUserPrincipal/i.test(msg)) {
      return {
        ok: false,
        error:
          "Infomaniak n'a pas retourné l'URL du principal. Solution : colle directement l'URL CalDAV de TON calendrier (format https://sync.infomaniak.com/calendars/<id>/<calendar>/) — disponible dans Infomaniak Calendar → Paramètres du calendrier → Partager.",
      };
    }
    return { ok: false, error: msg };
  }
}

// ===========================================================================
// PULL — récupération des events du serveur distant
// ===========================================================================

export interface RemoteEvent {
  href: string;
  etag: string;
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date;
  status: string | null;
}

/**
 * Récupère tous les events d'un calendrier sur une fenêtre temporelle.
 * Utilise REPORT calendar-query (filtré par date) — efficace côté serveur.
 */
/**
 * Construit un faux DAVCalendar à partir d'une URL connue. Permet de
 * bypass `fetchCalendars()` quand on a déjà l'URL du calendrier (cas
 * Infomaniak où la découverte échoue).
 */
function calendarFromUrl(url: string): DAVCalendar {
  return {
    url,
    ctag: undefined,
    displayName: "",
    components: ["VEVENT"],
    resourcetype: ["calendar"],
    timezone: "",
    description: "",
    syncToken: "",
  } as unknown as DAVCalendar;
}

export async function pullEvents(
  creds: CaldavCreds,
  calendarUrl: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<RemoteEvent[]> {
  const client = await makeClient(creds);
  // Bypass fetchCalendars : on connaît déjà l'URL du calendrier
  const cal = calendarFromUrl(calendarUrl);

  const objs = await client.fetchCalendarObjects({
    calendar: cal,
    timeRange: {
      start: windowStart.toISOString(),
      end: windowEnd.toISOString(),
    },
  });

  return objs.map(parseCalendarObject).filter((e): e is RemoteEvent => e !== null);
}

// ===========================================================================
// PUSH — créer / mettre à jour / supprimer un event distant
// ===========================================================================

export interface ActivityForPush {
  id: string;
  type: string;
  sujet: string;
  contenu: string | null;
  adresseRdv: string | null;
  date: Date;
  duree: number | null;
  statut: string;
  caldavHref: string | null;
  caldavUid: string | null;
  prospect: { id: string; raisonSociale: string } | null;
}

/**
 * Pousse une activité vers le serveur. Crée si caldavHref est null,
 * sinon update. Retourne { href, etag, uid } à stocker en DB.
 */
export async function pushActivity(
  creds: CaldavCreds,
  calendarUrl: string,
  activity: ActivityForPush,
  appUrl: string,
): Promise<{ href: string; etag: string | null; uid: string }> {
  const client = await makeClient(creds);
  // Bypass fetchCalendars (cf. pullEvents) — l'URL est connue
  const cal = calendarFromUrl(calendarUrl);

  const uid = activity.caldavUid ?? `activity-${activity.id}@crm.makeyourcom.ch`;
  const ical = activityToIcal(activity, uid, appUrl);

  if (activity.caldavHref) {
    // UPDATE existing event — tsdav v2 prend un DAVCalendarObject avec data
    const result = await client.updateCalendarObject({
      calendarObject: {
        url: activity.caldavHref,
        data: ical,
        etag: "",
      } as DAVCalendarObject,
    });
    // tsdav retourne un Response standard — on lit le header etag si présent
    const etag =
      result instanceof Response ? result.headers.get("etag") : null;
    return { href: activity.caldavHref, etag, uid };
  } else {
    // CREATE new event
    const filename = `${encodeURIComponent(uid)}.ics`;
    const result = await client.createCalendarObject({
      calendar: cal,
      filename,
      iCalString: ical,
    });
    const etag =
      result instanceof Response ? result.headers.get("etag") : null;
    // tsdav génère l'URL via calendar.url + filename
    const href = `${calendarUrl.replace(/\/+$/, "")}/${filename}`;
    return { href, etag, uid };
  }
}

/**
 * Supprime un event distant. Best-effort : ignore les 404 (déjà supprimé).
 */
export async function deleteRemoteEvent(
  creds: CaldavCreds,
  href: string,
): Promise<void> {
  try {
    const client = await makeClient(creds);
    await client.deleteCalendarObject({
      calendarObject: { url: href, etag: "" } as DAVCalendarObject,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404")) return;
    throw err;
  }
}

// ===========================================================================
// MAPPING Activity ↔ iCalendar
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

function escapeIcs(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function icsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function activityToIcal(
  a: ActivityForPush,
  uid: string,
  appUrl: string,
): string {
  const dureeMin = a.duree ?? 30;
  const dtStart = a.date;
  const dtEnd = new Date(dtStart.getTime() + dureeMin * 60 * 1000);
  const prefix = TYPE_LABEL[a.type] ?? a.type;
  const clientPart = a.prospect ? ` — ${a.prospect.raisonSociale}` : "";
  const summary = `[${prefix}]${clientPart} ${a.sujet}`.trim();

  const descParts: string[] = [];
  if (a.contenu) descParts.push(a.contenu);
  if (a.adresseRdv) descParts.push(`Lieu/lien: ${a.adresseRdv}`);
  if (a.prospect) descParts.push(`${appUrl}/prospects/${a.prospect.id}`);
  descParts.push(`Statut: ${a.statut}`);

  const status = a.statut === "ANNULE" ? "CANCELLED" : "CONFIRMED";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Make Your Com//CRM ACLR//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(dtStart)}`,
    `DTEND:${icsDate(dtEnd)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(descParts.join("\n"))}`,
    ...(a.adresseRdv ? [`LOCATION:${escapeIcs(a.adresseRdv)}`] : []),
    `STATUS:${status}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/**
 * Parse un VEVENT iCalendar en RemoteEvent.
 * Implémentation minimale : pas de récurrence (RRULE ignorée → l'occurrence
 * de base est récupérée, suffisant pour les RDV ponctuels).
 */
function parseCalendarObject(obj: DAVCalendarObject): RemoteEvent | null {
  const raw = typeof obj.data === "string" ? obj.data : "";
  if (!raw) return null;

  const get = (key: string): string | null => {
    // Supporte les paramètres genre DTSTART;TZID=...:20260603T140000
    const re = new RegExp(`^${key}(?:;[^:\\r\\n]*)?:(.+)$`, "m");
    const m = raw.match(re);
    return m ? unescape(m[1]!.trim()) : null;
  };
  const unescape = (s: string) =>
    s
      .replace(/\\n/g, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\\\/g, "\\");

  const parseDate = (raw: string | null): Date | null => {
    if (!raw) return null;
    // YYYYMMDDTHHMMSSZ ou YYYYMMDDTHHMMSS (local) — on traite tout en UTC
    const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
    if (!m) return null;
    return new Date(
      Date.UTC(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6]),
      ),
    );
  };

  const uid = get("UID");
  const start = parseDate(get("DTSTART"));
  const end = parseDate(get("DTEND"));
  if (!uid || !start) return null;

  return {
    href: obj.url,
    etag: obj.etag ?? "",
    uid,
    summary: get("SUMMARY") ?? "(sans titre)",
    description: get("DESCRIPTION"),
    location: get("LOCATION"),
    start,
    end: end ?? new Date(start.getTime() + 30 * 60 * 1000),
    status: get("STATUS"),
  };
}

/**
 * Devine le type d'activité à partir d'un titre/résumé venant de l'extérieur.
 * Heuristique simple pour catégoriser les events Infomaniak.
 */
export function guessActivityType(summary: string): string {
  const s = summary.toLowerCase();
  if (/visio|meet|zoom|teams|google\.com\/meet/.test(s)) return "RDV_VISIO";
  if (/\btél|telephon|appel/.test(s)) return "RDV_TELEPHONIQUE";
  if (/\brdv|rendez-vous|meeting/.test(s)) return "RDV_PHYSIQUE";
  return "NOTE";
}

export type { DAVCalendar };
