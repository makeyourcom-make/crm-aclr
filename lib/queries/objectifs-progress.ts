/**
 * Objectifs du mois (SERVEUR) : fenêtre du mois en jours ouvrés (Europe/Zurich,
 * fériés VS via lib/planning/dates), objectif MENSUEL actif, réalisé et
 * projection fin de mois au rythme actuel.
 *
 * Définitions alignées sur le bloc « Objectifs du mois » du dashboard
 * (lib/queries/dashboard.ts) et sur le moteur de jeu (getDayCounters) :
 *  - appels       : APPEL_SORTANT au statut FAIT / EN_COURS
 *  - contacts     : EMAIL_ENVOYE + LINKEDIN + SMS (cible `nbEmailsObjectif`,
 *                   comme le dashboard)
 *  - rdv          : RDV effectués (RDV_* rattachés à un prospect, FAIT,
 *                   datés au plus tard maintenant)
 *  - propositions : contrats créés par la commerciale (getDayCounters)
 *  - signatures   : contrats réellement signés (ACTIF, SUSPENDU, RESILIE,
 *                   EXPIRE) datés par dateSignature
 *  - ca           : valeur TOTALE des contrats signés (one-shot + mensuel ×
 *                   durée), comme le dashboard
 *  - commission   : versements de commission du mois (acquis + à venir, hors
 *                   annulés), même périmètre que le cockpit commissions
 */
import { prisma } from "@/lib/db";
import { getDayCounters } from "@/lib/gamification";
import { daysInMonth, isWorkingDay, todayZurich, utcDay } from "@/lib/planning/dates";

import {
  buildMetrics,
  capitalize,
  type MonthRealised,
  type MonthWindow,
  type ObjectiveMetric,
  type ObjectiveTargets,
} from "./objectifs-pace";

export type { MonthRealised, MonthWindow, ObjectiveMetric, ObjectiveTargets };

/** Statuts d'un contrat réellement signé (même liste que le dashboard). */
export const SIGNED_STATUTS = ["ACTIF", "SUSPENDU", "RESILIE", "EXPIRE"] as const;

// ---------------------------------------------------------------------------
// FUSEAU EUROPE/ZURICH
// ---------------------------------------------------------------------------

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Zurich",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zurichOffsetMs(at: Date): number {
  const p: Record<string, number> = {};
  for (const part of partsFmt.formatToParts(at)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Instant UTC de minuit (heure de Zurich) du jour y-m-d (mois 0-11, débordement accepté). */
export function zurichMidnight(y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m, d);
  const first = guess - zurichOffsetMs(new Date(guess));
  return new Date(guess - zurichOffsetMs(new Date(first)));
}

const monthLabelFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});
const monthNameFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: "UTC",
  month: "long",
});

/** Fenêtre du mois calendaire en cours (vu de Suisse). */
export function currentMonthWindow(): MonthWindow {
  const today = todayZurich();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const dim = daysInMonth(y, m);
  let total = 0;
  let elapsed = 0;
  let lastWorkingDay: Date | null = null;
  for (let d = 1; d <= dim; d++) {
    const day = utcDay(y, m, d);
    if (!isWorkingDay(day)) continue;
    total += 1;
    if (day.getTime() <= today.getTime()) elapsed += 1;
    lastWorkingDay = day;
  }
  const todayIsWorkingDay = isWorkingDay(today);
  const workingDaysLeft = Math.max(0, total - elapsed);
  const first = utcDay(y, m, 1);
  return {
    key: `${y}-${String(m + 1).padStart(2, "0")}`,
    year: y,
    month: m,
    start: zurichMidnight(y, m, 1),
    end: new Date(zurichMidnight(y, m + 1, 1).getTime() - 1),
    label: capitalize(monthLabelFmt.format(first)),
    monthName: monthNameFmt.format(first),
    todayKey: today.toISOString().slice(0, 10),
    workingDaysTotal: total,
    workingDaysElapsed: elapsed,
    workingDaysLeft,
    daysLeftInclToday: workingDaysLeft + (todayIsWorkingDay ? 1 : 0),
    todayIsWorkingDay,
    timeRatio: total > 0 ? Math.min(1, elapsed / total) : 0,
    lastWorkingDay,
  };
}

// ---------------------------------------------------------------------------
// OBJECTIF MENSUEL
// ---------------------------------------------------------------------------

export interface MonthlyObjective {
  id: string;
  dateDebut: Date;
  dateFin: Date;
  notes: string | null;
  targets: ObjectiveTargets;
}

const toNum = (v: unknown): number | null => (v == null ? null : Number(v));

function objectiveToTargets(o: {
  nbAppelsObjectif: number | null;
  nbEmailsObjectif: number | null;
  nbRdvObjectif: number | null;
  nbPropositionsObjectif: number | null;
  nbSignaturesObjectif: number | null;
  caObjectif: unknown;
  commissionObjectif: unknown;
}): ObjectiveTargets {
  return {
    appels: o.nbAppelsObjectif,
    contacts: o.nbEmailsObjectif,
    rdv: o.nbRdvObjectif,
    propositions: o.nbPropositionsObjectif,
    signatures: o.nbSignaturesObjectif,
    ca: toNum(o.caObjectif),
    commission: toNum(o.commissionObjectif),
  };
}

/**
 * Objectifs MENSUEL actifs qui chevauchent le mois (le plus récent par
 * utilisateur, comme le dashboard).
 */
export async function getMonthlyObjectives(
  w: MonthWindow,
  userIds?: string[],
): Promise<Map<string, MonthlyObjective>> {
  const rows = await prisma.objective.findMany({
    where: {
      ...(userIds ? { userId: { in: userIds } } : {}),
      periode: "MENSUEL",
      isActif: true,
      dateDebut: { lte: w.end },
      dateFin: { gte: w.start },
    },
    orderBy: { createdAt: "desc" },
  });
  const map = new Map<string, MonthlyObjective>();
  for (const o of rows) {
    if (map.has(o.userId)) continue;
    map.set(o.userId, {
      id: o.id,
      dateDebut: o.dateDebut,
      dateFin: o.dateFin,
      notes: o.notes,
      targets: objectiveToTargets(o),
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// RÉALISÉ DU MOIS
// ---------------------------------------------------------------------------

/** Versements de commission du mois (acquis + à venir), périmètre cockpit. */
async function monthCommissionTotal(userId: string, w: MonthWindow): Promise<number> {
  const range = { gte: w.start, lte: w.end };
  const agg = await prisma.commissionPayment.aggregate({
    where: {
      commission: {
        userId,
        user: { role: { not: "ADMIN" } },
        contract: {
          statut: { notIn: ["ATTENTE_SIGNATURE_CLIENT", "ATTENTE_VALIDATION_ADMIN"] },
        },
      },
      OR: [
        { statut: "PAYE", dateVersement: range },
        { statut: "PAYE", dateVersement: null, dateVersementPrevue: range },
        { statut: "PREVU", dateVersementPrevue: range },
      ],
    },
    _sum: { montant: true },
  });
  return Number(agg._sum.montant ?? 0);
}

/** Réalisé du mois pour un utilisateur (≈ 5 requêtes en parallèle). */
export async function getMonthRealised(
  userId: string,
  w: MonthWindow,
  opts: { commissionTotal?: number } = {},
): Promise<MonthRealised> {
  const range = { gte: w.start, lte: w.end };
  const [counters, contacts, signed, commission, commissionSigned] = await Promise.all([
    getDayCounters(userId, w.start, w.end),
    prisma.activity.count({
      where: {
        userId,
        type: { in: ["EMAIL_ENVOYE", "LINKEDIN", "SMS"] },
        date: range,
      },
    }),
    prisma.contract.findMany({
      where: {
        assigneAId: userId,
        statut: { in: [...SIGNED_STATUTS] },
        dateSignature: range,
      },
      select: { montantOneShot: true, montantMensuel: true, dureeMois: true },
    }),
    opts.commissionTotal !== undefined
      ? Promise.resolve(opts.commissionTotal)
      : monthCommissionTotal(userId, w),
    prisma.commission.aggregate({
      where: {
        userId,
        contract: {
          statut: { in: [...SIGNED_STATUTS] },
          dateSignature: range,
        },
      },
      _sum: { montantTotal: true },
    }),
  ]);

  const ca = signed.reduce(
    (s, c) => s + Number(c.montantOneShot) + Number(c.montantMensuel) * c.dureeMois,
    0,
  );

  return {
    appels: counters.appels,
    contacts,
    rdv: counters.rdvEffectues,
    rdvPris: counters.rdvPris,
    propositions: counters.propositions,
    signatures: signed.length,
    ca,
    commission,
    commissionSigned: Number(commissionSigned._sum.montantTotal ?? 0),
  };
}

// ---------------------------------------------------------------------------
// TABLEAU D'ÉQUIPE (admin)
// ---------------------------------------------------------------------------

export interface TeamObjectiveRow {
  userId: string;
  name: string;
  role: string;
  objective: MonthlyObjective | null;
  realised: MonthRealised;
  metrics: ObjectiveMetric[];
}

/**
 * Progression du mois de chaque utilisateur actif ayant un objectif MENSUEL,
 * plus les commerciales actives sans objectif (pour les signaler).
 */
export async function getTeamObjectiveBoard(w: MonthWindow): Promise<TeamObjectiveRow[]> {
  const [users, objectives] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    getMonthlyObjectives(w),
  ]);
  const board = users.filter((u) => objectives.has(u.id) || u.role === "COMMERCIAL");
  return Promise.all(
    board.map(async (u) => {
      const objective = objectives.get(u.id) ?? null;
      const realised = await getMonthRealised(u.id, w);
      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        objective,
        realised,
        metrics: objective ? buildMetrics(objective.targets, realised, w) : [],
      };
    }),
  );
}
