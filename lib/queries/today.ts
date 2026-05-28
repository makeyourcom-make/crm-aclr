/**
 * Requête principale du cockpit /aujourd-hui.
 *
 * Renvoie tout ce qu'il faut pour la page en une passe :
 *   - les activités du jour groupées par section temporelle
 *   - les activités de demain (preview pour anticipation)
 *   - les compteurs du jour (déjà fait) pour les progress bars
 *   - les compteurs de la semaine pour la sidebar
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { type SessionUser } from "@/lib/session";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type TodayActivity = Prisma.ActivityGetPayload<{
  include: {
    prospect: {
      select: {
        id: true;
        raisonSociale: true;
        telephone: true;
        telephoneMobile: true;
        ville: true;
      };
    };
  };
}>;

export interface TodaySections {
  /** Prévu hier ou avant, toujours pas FAIT */
  enRetard: TodayActivity[];
  /** Prévu dans l'heure courante */
  maintenant: TodayActivity[];
  /** Reste du jour, jusqu'à 12 h */
  ceMatin: TodayActivity[];
  /** 12 h - 18 h */
  cetApresMidi: TodayActivity[];
  /** Après 18 h */
  ceSoir: TodayActivity[];
  /** Preview des 5 prochains items de demain */
  demain: TodayActivity[];
}

export interface TodayCounters {
  appels: number;
  emails: number;
  rdvHonores: number;
  propositionsEnvoyees: number;
}

export interface WeeklyCounters {
  appels: number;
  emails: number;
  rdv: number;
  signatures: number;
}

export interface TodayCockpit {
  sections: TodaySections;
  jour: TodayCounters;
  semaine: WeeklyCounters;
}

// ---------------------------------------------------------------------------
// IMPLÉMENTATION
// ---------------------------------------------------------------------------

export async function getTodayCockpit(
  user: SessionUser,
): Promise<TodayCockpit> {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const endOfTomorrow = new Date(endOfToday);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  // Début et fin de la semaine ISO (lundi → dimanche)
  const startOfWeek = new Date(startOfToday);
  const day = startOfWeek.getDay() || 7;
  startOfWeek.setDate(startOfWeek.getDate() - (day - 1));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // Scope row-level : commercial ne voit que ses propres activités
  const scopeWhere =
    user.role === "ADMIN" ? {} : { userId: user.id };

  // Couleur include réutilisable
  const includeProspect = {
    prospect: {
      select: {
        id: true,
        raisonSociale: true,
        telephone: true,
        telephoneMobile: true,
        ville: true,
      },
    },
  } as const;

  // ---- Requêtes en parallèle ----
  const [
    todayPlanned,
    overdue,
    tomorrow,
    appelsAujourdhui,
    emailsAujourdhui,
    rdvHonoresAujourdhui,
    propositionsAujourdhui,
    appelsSemaine,
    emailsSemaine,
    rdvSemaine,
    signaturesSemaine,
  ] = await Promise.all([
    prisma.activity.findMany({
      where: {
        ...scopeWhere,
        date: { gte: startOfToday, lte: endOfToday },
        statut: { in: ["PLANIFIE", "EN_COURS"] },
      },
      include: includeProspect,
      orderBy: { date: "asc" },
    }),
    prisma.activity.findMany({
      where: {
        ...scopeWhere,
        date: { lt: startOfToday },
        statut: { in: ["PLANIFIE", "EN_COURS"] },
      },
      include: includeProspect,
      orderBy: { date: "asc" },
    }),
    prisma.activity.findMany({
      where: {
        ...scopeWhere,
        date: { gte: startOfTomorrow, lte: endOfTomorrow },
        statut: "PLANIFIE",
      },
      include: includeProspect,
      orderBy: { date: "asc" },
      take: 5,
    }),
    // Compteurs déjà faits aujourd'hui
    prisma.activity.count({
      where: {
        ...scopeWhere,
        type: "APPEL_SORTANT",
        date: { gte: startOfToday, lte: endOfToday },
        statut: { in: ["FAIT", "EN_COURS"] },
      },
    }),
    prisma.activity.count({
      where: {
        ...scopeWhere,
        type: "EMAIL_ENVOYE",
        date: { gte: startOfToday, lte: endOfToday },
      },
    }),
    prisma.activity.count({
      where: {
        ...scopeWhere,
        type: {
          in: ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"],
        },
        date: { gte: startOfToday, lte: endOfToday },
        statut: "FAIT",
      },
    }),
    // Heuristique propositions : les prospects qu'on a fait passer à
    // PROPOSITION_ENVOYEE aujourd'hui. À remplacer par un vrai compteur
    // sur deal/contract à l'étape 8.
    prisma.prospect.count({
      where: {
        ...(user.role === "ADMIN" ? {} : { assigneAId: user.id }),
        statut: "PROPOSITION_ENVOYEE",
        updatedAt: { gte: startOfToday, lte: endOfToday },
      },
    }),
    // Compteurs semaine
    prisma.activity.count({
      where: {
        ...scopeWhere,
        type: "APPEL_SORTANT",
        date: { gte: startOfWeek, lte: endOfWeek },
        statut: { in: ["FAIT", "EN_COURS"] },
      },
    }),
    prisma.activity.count({
      where: {
        ...scopeWhere,
        type: "EMAIL_ENVOYE",
        date: { gte: startOfWeek, lte: endOfWeek },
      },
    }),
    prisma.activity.count({
      where: {
        ...scopeWhere,
        type: {
          in: ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"],
        },
        date: { gte: startOfWeek, lte: endOfWeek },
        statut: "FAIT",
      },
    }),
    prisma.contract.count({
      where: {
        ...(user.role === "ADMIN" ? {} : { assigneAId: user.id }),
        dateSignature: { gte: startOfWeek, lte: endOfWeek },
      },
    }),
  ]);

  // ---- Groupement temporel des activités du jour ----
  const currentHour = now.getHours();

  const maintenant: TodayActivity[] = [];
  const ceMatin: TodayActivity[] = [];
  const cetApresMidi: TodayActivity[] = [];
  const ceSoir: TodayActivity[] = [];

  for (const a of todayPlanned) {
    const h = a.date.getHours();
    if (h === currentHour) {
      maintenant.push(a);
    } else if (h < 12) {
      ceMatin.push(a);
    } else if (h < 18) {
      cetApresMidi.push(a);
    } else {
      ceSoir.push(a);
    }
  }

  return {
    sections: {
      enRetard: overdue,
      maintenant,
      ceMatin,
      cetApresMidi,
      ceSoir,
      demain: tomorrow,
    },
    jour: {
      appels: appelsAujourdhui,
      emails: emailsAujourdhui,
      rdvHonores: rdvHonoresAujourdhui,
      propositionsEnvoyees: propositionsAujourdhui,
    },
    semaine: {
      appels: appelsSemaine,
      emails: emailsSemaine,
      rdv: rdvSemaine,
      signatures: signaturesSemaine,
    },
  };
}
