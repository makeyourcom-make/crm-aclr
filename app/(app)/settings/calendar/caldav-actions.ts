"use server";

/**
 * Actions CalDAV — chaque user gère sa propre config (Infomaniak,
 * Google, Apple, etc.). Pas d'admin override : confidentialité agenda.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  decryptPassword,
  deleteRemoteEvent,
  encryptPassword,
  listAvailableCalendars,
  pullEvents,
  pushActivity,
  guessActivityType,
} from "@/lib/caldav";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

/**
 * Normalise une URL serveur CalDAV :
 *  - Si l'URL pointe DIRECTEMENT sur un calendrier (path /calendars/<id>/<calid>/)
 *    → on garde tel quel, en nettoyant juste `?export` et trailing slashes.
 *    Mode "URL directe" : la découverte CalDAV est sautée côté lib.
 *  - Sinon pour Infomaniak/iCloud → on revient à l'origine (la racine).
 *  - Pour les autres serveurs → on garde l'URL fournie.
 */
function normalizeServerUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    // URL directe d'un calendrier Sabre/DAV (Infomaniak) : on préserve le path
    if (/^\/calendars\/[^/]+\/[^/]+/.test(u.pathname)) {
      const cleanPath = u.pathname.replace(/\/+$/, "") + "/";
      return `${u.protocol}//${u.host}${cleanPath}`;
    }
    // Racine seule pour Infomaniak / iCloud (path erroné supprimé)
    if (
      u.host.includes("infomaniak.com") ||
      u.host.includes("icloud.com")
    ) {
      return `${u.protocol}//${u.host}`;
    }
    return u.toString().replace(/\/+$/, "");
  } catch {
    return raw;
  }
}

const CredsSchema = z.object({
  serverUrl: z.string().trim().url("URL serveur invalide."),
  username: z.string().trim().min(1, "Identifiant requis."),
  password: z.string().min(1, "Mot de passe requis."),
});

/**
 * Test la connexion + retourne la liste des calendriers du serveur.
 * Le mot de passe n'est PAS sauvegardé à ce stade.
 */
export async function testCaldavConnection(input: unknown): Promise<
  | { ok: true; calendars: Array<{ url: string; displayName: string }> }
  | { ok: false; error: string }
> {
  await requireUser(); // auth required
  const parsed = CredsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
  }
  const creds = {
    ...parsed.data,
    serverUrl: normalizeServerUrl(parsed.data.serverUrl),
  };
  const res = await listAvailableCalendars(creds);
  if (!res.ok) return res;
  return {
    ok: true,
    calendars: res.calendars.map((c) => ({
      url: c.url,
      displayName:
        (typeof c.displayName === "string" ? c.displayName : null) ?? c.url,
    })),
  };
}

/**
 * Sauvegarde les credentials + le calendrier choisi. Chiffre le mot de passe.
 */
export async function saveCaldavConfig(input: unknown): Promise<{
  ok: boolean;
  error?: string;
}> {
  const user = await requireUser();
  const schema = CredsSchema.extend({
    calendarUrl: z.string().trim().url(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
  }
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        caldavServerUrl: normalizeServerUrl(parsed.data.serverUrl),
        caldavUsername: parsed.data.username,
        caldavPasswordEnc: encryptPassword(parsed.data.password),
        caldavCalendarUrl: parsed.data.calendarUrl,
      },
    });
    revalidatePath("/settings/calendar");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

/**
 * Déconnecte CalDAV : efface les credentials et le lien aux events distants
 * côté activités. Les activités restent en DB, seul le tracking sync est
 * effacé. Les events restent côté serveur distant.
 */
export async function disconnectCaldav(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const user = await requireUser();
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          caldavServerUrl: null,
          caldavUsername: null,
          caldavPasswordEnc: null,
          caldavCalendarUrl: null,
          caldavSyncToken: null,
          caldavLastSyncAt: null,
        },
      }),
      prisma.activity.updateMany({
        where: { userId: user.id },
        data: { caldavHref: null, caldavEtag: null, caldavUid: null },
      }),
    ]);
    revalidatePath("/settings/calendar");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

// ===========================================================================
// SYNCHRONISATION
// ===========================================================================

interface SyncResult {
  ok: boolean;
  error?: string;
  pulled?: number; // events importés depuis le serveur
  updated?: number; // events mis à jour depuis le serveur
  pushed?: number; // activités envoyées au serveur
  unchanged?: number;
}

/**
 * Sync manuel : pull les nouveaux events distants + push les activités
 * locales pas encore synchronisées. Fenêtre : −90j / +365j.
 */
export async function syncNow(): Promise<SyncResult> {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      caldavServerUrl: true,
      caldavUsername: true,
      caldavPasswordEnc: true,
      caldavCalendarUrl: true,
    },
  });
  if (
    !dbUser?.caldavServerUrl ||
    !dbUser.caldavUsername ||
    !dbUser.caldavPasswordEnc ||
    !dbUser.caldavCalendarUrl
  ) {
    return { ok: false, error: "Sync CalDAV non configurée." };
  }

  const creds = {
    serverUrl: dbUser.caldavServerUrl,
    username: dbUser.caldavUsername,
    password: decryptPassword(dbUser.caldavPasswordEnc),
  };
  const calendarUrl = dbUser.caldavCalendarUrl;
  const appUrl = process.env.NEXTAUTH_URL ?? "https://crm.makeyourcom.ch";

  const now = new Date();
  const windowStart = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  const windowEnd = new Date(now.getTime() + 365 * 24 * 3600 * 1000);

  try {
    // ---------- PULL ----------
    const remote = await pullEvents(creds, calendarUrl, windowStart, windowEnd);

    let pulled = 0;
    let updated = 0;
    let unchanged = 0;

    for (const ev of remote) {
      // Cherche l'activité existante (par UID en priorité, puis par href)
      const existing = await prisma.activity.findFirst({
        where: {
          userId: user.id,
          OR: [{ caldavUid: ev.uid }, { caldavHref: ev.href }],
        },
        select: { id: true, caldavEtag: true, updatedAt: true },
      });

      if (existing) {
        // Pas de changement → skip
        if (existing.caldavEtag === ev.etag) {
          unchanged++;
          continue;
        }
        // Update local depuis le distant
        await prisma.activity.update({
          where: { id: existing.id },
          data: {
            sujet: stripIcsPrefix(ev.summary),
            contenu: ev.description ?? null,
            adresseRdv: ev.location ?? null,
            date: ev.start,
            duree: Math.max(
              0,
              Math.round((ev.end.getTime() - ev.start.getTime()) / 60000),
            ),
            statut: ev.status === "CANCELLED" ? "ANNULE" : undefined,
            caldavHref: ev.href,
            caldavEtag: ev.etag,
            caldavUid: ev.uid,
          },
        });
        updated++;
      } else {
        // Nouvel event distant → crée activité locale
        // Pas de prospect rattaché (impossible à deviner)
        await prisma.activity.create({
          data: {
            userId: user.id,
            type: guessActivityType(ev.summary) as never,
            date: ev.start,
            duree: Math.max(
              0,
              Math.round((ev.end.getTime() - ev.start.getTime()) / 60000),
            ),
            sujet: stripIcsPrefix(ev.summary),
            contenu: ev.description,
            adresseRdv: ev.location,
            statut: ev.status === "CANCELLED" ? "ANNULE" : "PLANIFIE",
            caldavHref: ev.href,
            caldavEtag: ev.etag,
            caldavUid: ev.uid,
          },
        });
        pulled++;
      }
    }

    // ---------- PUSH ----------
    // Push uniquement les activités non encore synchronisées (caldavHref null)
    // sur la même fenêtre. Le push à la création/modification se fera via
    // hooks dans les actions (étape suivante).
    const toPush = await prisma.activity.findMany({
      where: {
        userId: user.id,
        caldavHref: null,
        date: { gte: windowStart, lte: windowEnd },
      },
      select: {
        id: true,
        type: true,
        sujet: true,
        contenu: true,
        adresseRdv: true,
        date: true,
        duree: true,
        statut: true,
        caldavHref: true,
        caldavUid: true,
        prospect: { select: { id: true, raisonSociale: true } },
      },
      take: 200, // sécurité
    });

    let pushed = 0;
    for (const a of toPush) {
      try {
        const res = await pushActivity(creds, calendarUrl, a, appUrl);
        await prisma.activity.update({
          where: { id: a.id },
          data: {
            caldavHref: res.href,
            caldavEtag: res.etag,
            caldavUid: res.uid,
          },
        });
        pushed++;
      } catch (err) {
        console.error(`[caldav] push ${a.id} échoué`, err);
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { caldavLastSyncAt: now },
    });

    revalidatePath("/agenda");
    revalidatePath("/settings/calendar");
    return { ok: true, pulled, updated, pushed, unchanged };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

/**
 * Retire le préfixe "[Type] — Client : " qu'on ajoute au push, pour
 * que le sujet pull-back redevienne propre. Best-effort.
 */
function stripIcsPrefix(summary: string): string {
  // Pattern : [Xxx] — Client : Vrai sujet  ou  [Xxx] Vrai sujet
  const m = summary.match(/^\[[^\]]+\](?:\s+—\s+[^:]+:)?\s*(.+)$/);
  return m ? m[1]!.trim() : summary.trim();
}

// ===========================================================================
// HOOKS appelés depuis createActivity / updateActivity / deleteActivity
// ===========================================================================

/**
 * Push une activité spécifique vers le serveur CalDAV de son owner.
 * Best-effort : si la config n'est pas en place ou si Infomaniak est down,
 * on log et on retourne sans casser le flow CRM.
 */
export async function pushActivityToCaldav(activityId: string): Promise<void> {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      type: true,
      sujet: true,
      contenu: true,
      adresseRdv: true,
      date: true,
      duree: true,
      statut: true,
      caldavHref: true,
      caldavUid: true,
      userId: true,
      prospect: { select: { id: true, raisonSociale: true } },
    },
  });
  if (!a) return;

  const owner = await prisma.user.findUnique({
    where: { id: a.userId },
    select: {
      caldavServerUrl: true,
      caldavUsername: true,
      caldavPasswordEnc: true,
      caldavCalendarUrl: true,
    },
  });
  if (
    !owner?.caldavServerUrl ||
    !owner.caldavUsername ||
    !owner.caldavPasswordEnc ||
    !owner.caldavCalendarUrl
  )
    return;

  try {
    const creds = {
      serverUrl: owner.caldavServerUrl,
      username: owner.caldavUsername,
      password: decryptPassword(owner.caldavPasswordEnc),
    };
    const appUrl = process.env.NEXTAUTH_URL ?? "https://crm.makeyourcom.ch";
    const res = await pushActivity(creds, owner.caldavCalendarUrl, a, appUrl);
    await prisma.activity.update({
      where: { id: a.id },
      data: {
        caldavHref: res.href,
        caldavEtag: res.etag,
        caldavUid: res.uid,
      },
    });
  } catch (err) {
    console.error(`[caldav] pushActivityToCaldav ${activityId} échoué`, err);
  }
}

/**
 * Supprime un event sur le serveur distant à partir des metadata stockées
 * en DB (récupérées AVANT la suppression locale).
 */
export async function deleteActivityFromCaldav(payload: {
  userId: string;
  caldavHref: string | null;
}): Promise<void> {
  if (!payload.caldavHref) return;
  const owner = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      caldavServerUrl: true,
      caldavUsername: true,
      caldavPasswordEnc: true,
    },
  });
  if (!owner?.caldavServerUrl || !owner.caldavUsername || !owner.caldavPasswordEnc)
    return;
  try {
    const creds = {
      serverUrl: owner.caldavServerUrl,
      username: owner.caldavUsername,
      password: decryptPassword(owner.caldavPasswordEnc),
    };
    await deleteRemoteEvent(creds, payload.caldavHref);
  } catch (err) {
    console.error("[caldav] deleteActivityFromCaldav échoué", err);
  }
}
