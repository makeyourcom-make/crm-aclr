/**
 * Chiffres de la rubrique Emails (SERVEUR uniquement, lecture seule).
 *
 * Tout est recalculé à partir de la table `emails` (aucune donnée inventée) :
 *  - mails envoyés      : SORTANT hors vrais brouillons (label « draft ») et
 *                         hors spam, datés par envoyeLe (sinon createdAt, cas
 *                         du mode dry-run)
 *  - réponses obtenues  : fils où un mail ENTRANT arrive APRÈS un de mes envois
 *  - temps de réponse   : délai entre un mail reçu et ma première réponse
 *                         dans le même fil
 *  - inbox zéro         : non lus de la boîte (hors archivés / corbeille, même
 *                         périmètre que la jauge « Inbox zéro ») et
 *                         mails reçus lus aujourd'hui (`luALe`)
 * Jours découpés en fuseau Europe/Zurich (dates stockées en UTC).
 *
 * Pas de `"use server"` : module importé par les pages serveur uniquement.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getDayCounters } from "@/lib/gamification";
import { initialsOf } from "@/lib/gamification/rules";
import { isoWeekKey } from "@/lib/planning/dates";

const TZ = "Europe/Zurich";
const DAY_MS = 86_400_000;
const DRAFT_LABEL = "draft";
const SPAM_LABEL = "spam";

/**
 * Objectif de mails envoyés par jour : celui de l'Objective QUOTIDIEN actif
 * (`nbEmailsObjectif`, même source que « Ma journée ») quand Arthur l'a fixé,
 * sinon ce repère de jeu par défaut.
 */
export const EMAIL_DAILY_TARGET = 10;

// ---------------------------------------------------------------------------
// Fuseau
// ---------------------------------------------------------------------------

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zurichDayKey(d: Date): string {
  return dayKeyFmt.format(d);
}

function zurichOffsetMs(at: Date): number {
  const p: Record<string, number> = {};
  for (const part of partsFmt.formatToParts(at)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Instant UTC de minuit (heure de Zurich) du jour `key` (AAAA-MM-JJ). */
function zurichStartOfDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - zurichOffsetMs(new Date(guess));
  return new Date(guess - zurichOffsetMs(new Date(first)));
}

function keyToUtcDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function utcDateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Types exposés
// ---------------------------------------------------------------------------

export interface MailLeaderboardEntry {
  userId: string;
  name: string;
  initials: string;
  sent: number;
  replies: number;
  rank: number;
  isMe: boolean;
}

export interface MailBounce {
  id: string;
  objet: string;
  destinataire: string;
  statut: "REBOND" | "ERREUR";
}

export interface MailStats {
  target: number;
  sentToday: number;
  /** Record de mails envoyés en un jour (tout l'historique). */
  sentRecordDay: number;
  /** Mails rattachés à un client envoyés aujourd'hui (activités EMAIL_ENVOYE). */
  clientMailsToday: number;
  sent7d: number;
  sentPrev7d: number;
  /** Record de mails envoyés sur une semaine ISO. */
  bestWeekSent: number;
  sentThisWeek: number;
  /** Fils lancés (au moins un envoi) sur 7 jours glissants. */
  threads7d: number;
  /** Parmi eux, ceux où le contact a répondu après mon envoi. */
  replied7d: number;
  /** Délai moyen de réponse aux mails reçus sur 7 jours (minutes). */
  avgResponseMinutes: number | null;
  answered7d: number;
  /** Non lus de la boîte (hors archivés et corbeille). */
  unreadInbox: number;
  /** Mails reçus lus aujourd'hui. */
  treatedToday: number;
  delivery: { sent: number; delivered: number; pending: number; failed: number };
  bounces: MailBounce[];
  leaderboard: MailLeaderboardEntry[];
}

interface LiteMail {
  id: string;
  userId: string;
  threadId: string;
  direction: "SORTANT" | "ENTRANT";
  createdAt: Date;
  envoyeLe: Date | null;
  labels: string[];
  statut: string;
}

const at = (m: Pick<LiteMail, "envoyeLe" | "createdAt">) =>
  (m.envoyeLe ?? m.createdAt).getTime();

const isSentMail = (m: LiteMail) =>
  m.direction === "SORTANT" &&
  !m.labels.includes(DRAFT_LABEL) &&
  !m.labels.includes(SPAM_LABEL);

const isRealInbound = (m: LiteMail) =>
  m.direction === "ENTRANT" && !m.labels.includes(SPAM_LABEL);

// ---------------------------------------------------------------------------
// Requête principale
// ---------------------------------------------------------------------------

export async function getMailStats(userId: string): Promise<MailStats> {
  const now = new Date();
  const nowMs = now.getTime();
  const todayKey = zurichDayKey(now);
  const todayStart = zurichStartOfDay(todayKey);
  const start7 = new Date(nowMs - 7 * DAY_MS);
  const start14 = new Date(nowMs - 14 * DAY_MS);

  const [
    dayRows,
    users,
    recent,
    unreadInbox,
    treatedToday,
    bouncedRows,
    counters,
    dailyObjective,
  ] = await Promise.all([
      // Mails envoyés par jour (Zurich) sur tout l'historique : records + jour.
      prisma.$queryRaw<Array<{ d: string; n: number }>>(Prisma.sql`
        SELECT to_char((COALESCE(e."envoyeLe", e."createdAt") AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS d,
          COUNT(*)::int AS n
        FROM emails e
        WHERE e."userId" = ${userId}
          AND e."direction" = 'SORTANT'
          AND NOT (${DRAFT_LABEL} = ANY(e."labels"))
          AND NOT (${SPAM_LABEL} = ANY(e."labels"))
        GROUP BY 1
      `),
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      // 14 derniers jours, tous les collaborateurs actifs (classement + délais).
      prisma.email.findMany({
        where: {
          createdAt: { gte: start14 },
          user: { isActive: true },
        },
        select: {
          id: true,
          userId: true,
          threadId: true,
          direction: true,
          createdAt: true,
          envoyeLe: true,
          labels: true,
          statut: true,
        },
      }),
      prisma.email.count({
        where: { userId, direction: "ENTRANT", lu: false, archive: false, supprime: false },
      }),
      prisma.email.count({
        where: {
          userId,
          direction: "ENTRANT",
          luALe: { gte: todayStart },
          NOT: { labels: { has: SPAM_LABEL } },
        },
      }),
      prisma.email.findMany({
        where: {
          userId,
          direction: "SORTANT",
          statut: { in: ["REBOND", "ERREUR"] },
          createdAt: { gte: start7 },
          supprime: false,
        },
        select: { id: true, objet: true, destinataireEmail: true, statut: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      getDayCounters(userId, todayStart, now).catch(() => null),
      // Objectif quotidien actif (même requête que lib/queries/today.ts).
      prisma.objective.findFirst({
        where: {
          userId,
          periode: "QUOTIDIEN",
          isActif: true,
          dateDebut: { lte: now },
          dateFin: { gte: now },
        },
        orderBy: { dateFin: "desc" },
        select: { nbEmailsObjectif: true },
      }),
    ]);
  const objEmails = dailyObjective?.nbEmailsObjectif;
  const target = objEmails != null && objEmails > 0 ? objEmails : EMAIL_DAILY_TARGET;

  const recentMails = recent as LiteMail[];

  // --- Envois par jour : aujourd'hui, records, semaines -----------------------
  const perDay = new Map<string, number>();
  for (const r of dayRows) perDay.set(r.d, Number(r.n) || 0);
  const sentToday = perDay.get(todayKey) ?? 0;
  const sentRecordDay = Math.max(0, ...perDay.values());
  const perWeek = new Map<string, number>();
  for (const [k, n] of perDay) {
    const wk = isoWeekKey(keyToUtcDate(k));
    perWeek.set(wk, (perWeek.get(wk) ?? 0) + n);
  }
  const thisWeek = isoWeekKey(keyToUtcDate(todayKey));
  const sentThisWeek = perWeek.get(thisWeek) ?? 0;
  const bestWeekSent = Math.max(0, ...perWeek.values());

  // 7 jours glissants (jour J et les 6 précédents) vs les 7 d'avant.
  let sent7d = 0;
  let sentPrev7d = 0;
  for (let i = 0; i < 14; i++) {
    const key = utcDateToKey(new Date(keyToUtcDate(todayKey).getTime() - i * DAY_MS));
    const n = perDay.get(key) ?? 0;
    if (i < 7) sent7d += n;
    else sentPrev7d += n;
  }

  // --- Premiers contacts plus anciens que 14 jours (pour les réponses) --------
  const inbound7 = recentMails.filter(
    (m) => isRealInbound(m) && at(m) >= start7.getTime(),
  );
  const inboundThreads = [...new Set(inbound7.map((m) => m.threadId))];
  const olderOutbound =
    inboundThreads.length > 0
      ? ((await prisma.email.findMany({
          where: {
            threadId: { in: inboundThreads },
            direction: "SORTANT",
            createdAt: { lt: start14 },
          },
          select: {
            id: true,
            userId: true,
            threadId: true,
            direction: true,
            createdAt: true,
            envoyeLe: true,
            labels: true,
            statut: true,
          },
        })) as LiteMail[])
      : [];

  // Index fil → messages (par propriétaire de boîte).
  const byOwnerThread = new Map<string, LiteMail[]>();
  for (const m of [...recentMails, ...olderOutbound]) {
    const k = `${m.userId}::${m.threadId}`;
    const list = byOwnerThread.get(k) ?? [];
    list.push(m);
    byOwnerThread.set(k, list);
  }
  for (const list of byOwnerThread.values()) list.sort((a, b) => at(a) - at(b));

  /** Réponses obtenues (fils) et fils lancés sur 7 jours pour un collaborateur. */
  const repliesFor = (uid: string) => {
    let threads = 0;
    let replied = 0;
    for (const [k, list] of byOwnerThread) {
      if (!k.startsWith(`${uid}::`)) continue;
      const firstSent = list.find((m) => isSentMail(m) && at(m) >= start7.getTime());
      const anySent = list.find(isSentMail);
      // Fil lancé dans la fenêtre → compte dans le dénominateur.
      if (firstSent) {
        threads++;
        if (list.some((m) => isRealInbound(m) && at(m) > at(firstSent))) replied++;
        continue;
      }
      // Envoi plus ancien mais réponse reçue dans la fenêtre : c'est une
      // réponse obtenue (le contact a répondu cette semaine).
      if (
        anySent &&
        list.some(
          (m) => isRealInbound(m) && at(m) >= start7.getTime() && at(m) > at(anySent),
        )
      ) {
        replied++;
      }
    }
    return { threads, replied };
  };

  // --- Mon délai de réponse --------------------------------------------------
  let totalMin = 0;
  let answered7d = 0;
  for (const [k, list] of byOwnerThread) {
    if (!k.startsWith(`${userId}::`)) continue;
    for (const m of list) {
      if (!isRealInbound(m) || at(m) < start7.getTime()) continue;
      const reply = list.find((x) => isSentMail(x) && at(x) > at(m));
      if (!reply) continue;
      totalMin += (at(reply) - at(m)) / 60_000;
      answered7d++;
    }
  }
  const avgResponseMinutes = answered7d > 0 ? Math.round(totalMin / answered7d) : null;

  // --- Livraison de mes envois (7 jours) ---------------------------------------
  const mySent7 = recentMails.filter(
    (m) => m.userId === userId && isSentMail(m) && at(m) >= start7.getTime(),
  );
  const DELIVERED = new Set(["LIVRE", "OUVERT", "CLIQUE", "REPONDU"]);
  const FAILED = new Set(["REBOND", "ERREUR"]);
  const delivery = {
    sent: mySent7.length,
    delivered: mySent7.filter((m) => DELIVERED.has(m.statut)).length,
    failed: mySent7.filter((m) => FAILED.has(m.statut)).length,
    pending: mySent7.filter((m) => !DELIVERED.has(m.statut) && !FAILED.has(m.statut)).length,
  };

  // --- Classement mails de la semaine (7 jours glissants) ---------------------
  const sentByUser = new Map<string, number>();
  for (const m of recentMails) {
    if (isSentMail(m) && at(m) >= start7.getTime()) {
      sentByUser.set(m.userId, (sentByUser.get(m.userId) ?? 0) + 1);
    }
  }
  const sorted = users
    .map((u) => ({
      userId: u.id,
      name: u.name,
      initials: initialsOf(u.name),
      sent: sentByUser.get(u.id) ?? 0,
      replies: repliesFor(u.id).replied,
      isMe: u.id === userId,
    }))
    .sort((a, b) => b.sent - a.sent || b.replies - a.replies || a.name.localeCompare(b.name, "fr"));
  let prevSent: number | null = null;
  let prevRank = 0;
  const leaderboard: MailLeaderboardEntry[] = sorted.map((e, i) => {
    const rank = prevSent !== null && e.sent === prevSent ? prevRank : i + 1;
    prevSent = e.sent;
    prevRank = rank;
    return { ...e, rank };
  });

  const mine = repliesFor(userId);

  return {
    target,
    sentToday,
    sentRecordDay,
    clientMailsToday: counters?.emails ?? 0,
    sent7d,
    sentPrev7d,
    bestWeekSent,
    sentThisWeek,
    threads7d: mine.threads,
    replied7d: mine.replied,
    avgResponseMinutes,
    answered7d,
    unreadInbox,
    treatedToday,
    delivery,
    bounces: bouncedRows.map((b) => ({
      id: b.id,
      objet: b.objet,
      destinataire: b.destinataireEmail,
      statut: b.statut === "ERREUR" ? "ERREUR" : "REBOND",
    })),
    leaderboard,
  };
}
