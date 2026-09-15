"use server";

/**
 * Actions Google Calendar — sync bidirectionnelle API v3 + OAuth2.
 * Chaque user gère sa propre connexion (confidentialité agenda).
 *
 *  - PUSH temps réel : hooks pushActivityToGoogle / deleteActivityFromGoogle
 *    appelés depuis create/update/deleteActivity.
 *  - PULL périodique : syncGoogleForUser (bouton manuel + cron), via syncToken.
 */
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import {
  type ActivityForGoogle,
  decryptToken,
  deleteGoogleEvent,
  guessActivityType,
  listGoogleEventsIncremental,
  refreshAccessToken,
  stripGooglePrefix,
  upsertGoogleEvent,
  appBaseUrl,
} from "@/lib/google-calendar";
import { requireUser } from "@/lib/session";

const ACTIVITY_PUSH_SELECT = {
  id: true,
  type: true,
  sujet: true,
  contenu: true,
  adresseRdv: true,
  date: true,
  duree: true,
  statut: true,
  googleEventId: true,
  userId: true,
  prospect: { select: { id: true, raisonSociale: true } },
} as const;

export interface GoogleSyncResult {
  ok: boolean;
  error?: string;
  pulled?: number; // events importés depuis Google
  updated?: number; // events mis à jour depuis Google
  cancelled?: number; // events annulés/supprimés côté Google
  pushed?: number; // activités envoyées à Google
}

// ===========================================================================
// SYNC (pull + push) pour un utilisateur — partagé bouton manuel & cron
// ===========================================================================

export async function syncGoogleForUser(
  userId: string,
): Promise<GoogleSyncResult> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      googleRefreshTokenEnc: true,
      googleCalendarId: true,
      googleSyncToken: true,
    },
  });
  if (!u?.googleRefreshTokenEnc) {
    return { ok: false, error: "Google non connecté." };
  }

  const calendarId = u.googleCalendarId ?? "primary";
  const appUrl = appBaseUrl();

  try {
    const accessToken = await refreshAccessToken(
      decryptToken(u.googleRefreshTokenEnc),
    );

    // ---------------- PULL (Google → CRM) ----------------
    const { events, nextSyncToken } = await listGoogleEventsIncremental(
      accessToken,
      calendarId,
      u.googleSyncToken,
    );

    let pulled = 0;
    let updated = 0;
    let cancelled = 0;

    for (const ev of events) {
      const existing = await prisma.activity.findFirst({
        where: { userId, googleEventId: ev.id },
        select: { id: true },
      });

      // Event annulé / supprimé côté Google.
      if (ev.status === "cancelled") {
        if (existing) {
          // On ne détruit pas : on marque ANNULE (réversible, pas de perte).
          await prisma.activity.update({
            where: { id: existing.id },
            data: { statut: "ANNULE" },
          });
          cancelled++;
        }
        continue;
      }

      if (!ev.start) continue; // rien d'exploitable

      const dureeMin = ev.end
        ? Math.max(0, Math.round((ev.end.getTime() - ev.start.getTime()) / 60000))
        : 30;
      const sujet = ev.summary ? stripGooglePrefix(ev.summary) : "(sans titre)";

      if (existing) {
        await prisma.activity.update({
          where: { id: existing.id },
          data: {
            sujet,
            contenu: ev.description ?? null,
            adresseRdv: ev.location ?? null,
            date: ev.start,
            duree: dureeMin,
          },
        });
        updated++;
      } else {
        await prisma.activity.create({
          data: {
            userId,
            type: guessActivityType(ev.summary ?? "") as never,
            date: ev.start,
            duree: dureeMin,
            sujet,
            contenu: ev.description,
            adresseRdv: ev.location,
            statut: "PLANIFIE",
            googleEventId: ev.id,
          },
        });
        pulled++;
      }
    }

    // ---------------- PUSH (CRM → Google) ----------------
    // Active uniquement les activités pas encore liées à un event Google.
    const now = Date.now();
    const toPush = await prisma.activity.findMany({
      where: {
        userId,
        googleEventId: null,
        date: {
          gte: new Date(now - 90 * 864e5),
          lte: new Date(now + 365 * 864e5),
        },
      },
      select: ACTIVITY_PUSH_SELECT,
      take: 200,
    });

    let pushed = 0;
    for (const a of toPush) {
      try {
        const eventId = await upsertGoogleEvent(
          accessToken,
          calendarId,
          a as ActivityForGoogle,
          appUrl,
        );
        await prisma.activity.update({
          where: { id: a.id },
          data: { googleEventId: eventId },
        });
        pushed++;
      } catch (err) {
        console.error(`[google] push ${a.id} échoué`, err);
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        googleSyncToken: nextSyncToken,
        googleLastSyncAt: new Date(),
      },
    });

    revalidatePath("/agenda");
    revalidatePath("/settings/calendar");
    return { ok: true, pulled, updated, cancelled, pushed };
  } catch (err) {
    console.error("[google] syncGoogleForUser", err);
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

/** Sync manuel déclenché par l'utilisateur (bouton « Synchroniser »). */
export async function syncGoogleNow(): Promise<GoogleSyncResult> {
  const user = await requireUser();
  return syncGoogleForUser(user.id);
}

/** Déconnecte Google : efface le token + délie les activités (events gardés côté Google). */
export async function disconnectGoogle(): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          googleRefreshTokenEnc: null,
          googleEmail: null,
          googleCalendarId: null,
          googleSyncToken: null,
          googleLastSyncAt: null,
        },
      }),
      prisma.activity.updateMany({
        where: { userId: user.id },
        data: { googleEventId: null },
      }),
    ]);
    revalidatePath("/settings/calendar");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

// ===========================================================================
// HOOKS temps réel — appelés depuis create/update/deleteActivity
// ===========================================================================

/** Pousse (crée/maj) une activité vers Google. Best-effort, ne casse pas le flow. */
export async function pushActivityToGoogle(activityId: string): Promise<void> {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: ACTIVITY_PUSH_SELECT,
  });
  if (!a) return;

  const owner = await prisma.user.findUnique({
    where: { id: a.userId },
    select: { googleRefreshTokenEnc: true, googleCalendarId: true },
  });
  if (!owner?.googleRefreshTokenEnc) return;

  try {
    const accessToken = await refreshAccessToken(
      decryptToken(owner.googleRefreshTokenEnc),
    );
    const eventId = await upsertGoogleEvent(
      accessToken,
      owner.googleCalendarId ?? "primary",
      a as ActivityForGoogle,
      appBaseUrl(),
    );
    if (eventId !== a.googleEventId) {
      await prisma.activity.update({
        where: { id: a.id },
        data: { googleEventId: eventId },
      });
    }
  } catch (err) {
    console.error(`[google] pushActivityToGoogle ${activityId} échoué`, err);
  }
}

/** Supprime l'event Google lié (metadata récupérée AVANT la suppression locale). */
export async function deleteActivityFromGoogle(payload: {
  userId: string;
  googleEventId: string | null;
}): Promise<void> {
  if (!payload.googleEventId) return;
  const owner = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { googleRefreshTokenEnc: true, googleCalendarId: true },
  });
  if (!owner?.googleRefreshTokenEnc) return;
  try {
    const accessToken = await refreshAccessToken(
      decryptToken(owner.googleRefreshTokenEnc),
    );
    await deleteGoogleEvent(
      accessToken,
      owner.googleCalendarId ?? "primary",
      payload.googleEventId,
    );
  } catch (err) {
    console.error("[google] deleteActivityFromGoogle échoué", err);
  }
}
