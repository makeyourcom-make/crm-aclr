/**
 * « Objectifs & gains » de la commerciale (SERVEUR) : tout ce qu'il faut pour
 * la vue /commissions (gains en CHF, objectifs, records), à partir des
 * données réelles du CRM.
 *
 *  - commissions : cockpit existant (getCommissionsCockpit) + frise mois par
 *    mois (historique + versements à venir) + détail du mois en cours ;
 *  - taux réels de la commerciale (User.tauxCommissionSignature /
 *    tauxCommissionRenouvellement) pour le simulateur ;
 *  - objectif MENSUEL + réalisé + projection (objectifs-progress) ;
 *  - prochains RDV (phrase coach, CTA agenda) ;
 *  - offres types du catalogue (produits actifs les plus vendus).
 */
import { ADS_CATEGORIES } from "@/lib/commissions";
import { prisma } from "@/lib/db";
import { type SessionUser } from "@/lib/session";

import {
  buildCommissionTimeline,
  getCommissionsCockpit,
  zurichMonthKey,
  type CommissionPaymentDetail,
  type CommissionsCockpit,
  type TimelineMonth,
} from "./commissions";
import { buildMetrics, type MonthRealised, type MonthWindow, type ObjectiveMetric } from "./objectifs-pace";
import {
  currentMonthWindow,
  getMonthlyObjectives,
  getMonthRealised,
  SIGNED_STATUTS,
  zurichMidnight,
  type MonthlyObjective,
} from "./objectifs-progress";

export interface MonthLine {
  id: string;
  contractId: string;
  numero: string;
  prospectId: string;
  client: string;
  products: string;
  typePart: CommissionPaymentDetail["typePart"];
  numeroMois: number | null;
  statut: CommissionPaymentDetail["statut"];
  montant: number;
  date: Date;
}

export interface SimPreset {
  id: string;
  nom: string;
  oneShot: number;
  mensuel: number;
  duree: number;
  ads: boolean;
}

export interface UpcomingRdv {
  id: string;
  date: Date;
  client: string | null;
}

export interface GainsData {
  window: MonthWindow;
  rates: {
    signature: number;
    renouvellement: number;
    typeContrat: string | null;
  };
  cockpit: CommissionsCockpit;
  timeline: TimelineMonth[];
  month: {
    total: number;
    acquis: number;
    aVenir: number;
    signature: number;
    recurrent: number;
    /** Commission générée sur les signatures du mois (total, part signature, part étalée). */
    genere: number;
    genereSignature: number;
    genereEtale: number;
    lines: MonthLine[];
    prev: TimelineMonth | null;
    next: TimelineMonth | null;
    /** Meilleur mois passé (hors mois en cours). */
    bestPast: TimelineMonth | null;
  };
  objective: MonthlyObjective | null;
  realised: MonthRealised;
  metrics: ObjectiveMetric[];
  /** CA signé moyen par contrat (12 derniers mois), null si aucun. */
  panierMoyen: number | null;
  upcomingRdvs: UpcomingRdv[];
  upcomingRdvCount: number;
  presets: SimPreset[];
}

const RDV_TYPES = ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"] as const;

function emptyRealised(commission: number): MonthRealised {
  return {
    appels: 0,
    contacts: 0,
    rdv: 0,
    rdvPris: 0,
    propositions: 0,
    signatures: 0,
    ca: 0,
    commission,
    commissionSigned: 0,
  };
}

/** Donnée d'agrément (RDV, offres types) : en cas d'échec, valeur neutre. */
function soft<T>(p: Promise<T>, fallback: T, label: string): Promise<T> {
  return p.catch((err) => {
    console.error(`[gains] ${label} a échoué :`, err);
    return fallback;
  });
}

export async function getGainsData(user: SessionUser): Promise<GainsData> {
  const w = currentMonthWindow();
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);
  const historyStart = zurichMidnight(w.year, w.month - 11, 1);

  const [
    cockpit,
    userRates,
    objectives,
    signedContracts,
    upcoming,
    upcomingCount,
    presetsRaw,
  ] = await Promise.all([
    getCommissionsCockpit(user),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        tauxCommissionSignature: true,
        tauxCommissionRenouvellement: true,
        typeContrat: true,
      },
    }),
    // Couche « objectifs » : en cas d'échec, les commissions restent visibles.
    soft(getMonthlyObjectives(w, [user.id]), new Map<string, MonthlyObjective>(), "objectif du mois"),
    soft(
      prisma.contract.findMany({
        where: {
          assigneAId: user.id,
          statut: { in: [...SIGNED_STATUTS] },
          dateSignature: { gte: historyStart },
        },
        select: {
          dateSignature: true,
          montantOneShot: true,
          montantMensuel: true,
          dureeMois: true,
        },
      }),
      [],
      "contrats signés (12 mois)",
    ),
    soft(
      prisma.activity.findMany({
        where: {
          userId: user.id,
          type: { in: [...RDV_TYPES] },
          statut: "PLANIFIE",
          date: { gt: now, lte: in7Days },
        },
        orderBy: { date: "asc" },
        take: 3,
        select: { id: true, date: true, prospect: { select: { raisonSociale: true } } },
      }),
      [],
      "prochains RDV",
    ),
    soft(
      prisma.activity.count({
        where: {
          userId: user.id,
          type: { in: [...RDV_TYPES] },
          statut: "PLANIFIE",
          date: { gt: now, lte: in7Days },
        },
      }),
      0,
      "compte des RDV",
    ),
    soft(prisma.product.findMany({
      where: {
        isActive: true,
        OR: [{ prixMensuel: { gt: 0 } }, { prixOneShot: { gt: 0 } }],
      },
      select: {
        id: true,
        nom: true,
        categorie: true,
        prixOneShot: true,
        prixMensuel: true,
        engagementMois: true,
      },
      orderBy: [{ contracts: { _count: "desc" } }, { nom: "asc" }],
      take: 4,
    }), [], "offres types"),
  ]);

  // ---- Frise (6 mois passés → 12 mois à venir) ----
  const signedByMonth = new Map<string, number>();
  for (const c of signedContracts) {
    const k = zurichMonthKey(c.dateSignature);
    signedByMonth.set(k, (signedByMonth.get(k) ?? 0) + 1);
  }
  const timeline = buildCommissionTimeline(cockpit.payments, {
    pastMonths: 6,
    futureMonths: 12,
    signedByMonth,
    now,
  });
  const curIdx = timeline.findIndex((m) => m.isCurrent);
  const current = timeline[curIdx];
  const prev = curIdx > 0 ? timeline[curIdx - 1] : null;
  const next = curIdx >= 0 && curIdx + 1 < timeline.length ? timeline[curIdx + 1] : null;
  let bestPast: TimelineMonth | null = null;
  for (const m of timeline) {
    if (m.isCurrent || m.isFuture) continue;
    const t = m.signature + m.recurrent;
    if (t > 0 && (!bestPast || t > bestPast.signature + bestPast.recurrent)) bestPast = m;
  }

  // ---- Détail du mois en cours (contrat par contrat) ----
  const monthPayments = cockpit.payments.filter(
    (p) =>
      p.statut !== "ANNULE" &&
      zurichMonthKey(p.dateVersement ?? p.dateVersementPrevue) === w.key,
  );
  const contractIds = [...new Set(monthPayments.map((p) => p.commission.contract.id))];
  const contractProducts =
    contractIds.length > 0
      ? await soft(
          prisma.contract.findMany({
            where: { id: { in: contractIds } },
            select: { id: true, products: { select: { nom: true } } },
          }),
          [],
          "produits des contrats",
        )
      : [];
  const productsByContract = new Map(
    contractProducts.map((c) => [c.id, c.products.map((p) => p.nom).join(", ")]),
  );
  const lines: MonthLine[] = monthPayments
    .map((p) => ({
      id: p.id,
      contractId: p.commission.contract.id,
      numero: p.commission.contract.numero,
      prospectId: p.commission.contract.prospect.id,
      client: p.commission.contract.prospect.raisonSociale,
      products: productsByContract.get(p.commission.contract.id) ?? "",
      typePart: p.typePart,
      numeroMois: p.numeroMois,
      statut: p.statut,
      montant: Number(p.montant),
      date: p.dateVersement ?? p.dateVersementPrevue,
    }))
    .sort((a, b) => b.montant - a.montant);

  const monthTotal = current ? current.signature + current.recurrent : 0;

  // Commission GÉNÉRÉE sur les contrats signés CE mois (25 % de la valeur signée,
  // budget pub exclu) : part1 = versée à la signature, part2 = étalée sur 11 mois.
  // C'est le chiffre du dashboard (« commission sur tes signatures du mois »).
  const genereAgg = await prisma.commission.aggregate({
    where: {
      userId: user.id,
      contract: {
        statut: { in: [...SIGNED_STATUTS] },
        dateSignature: { gte: w.start, lte: w.end },
      },
    },
    _sum: { montantTotal: true, montantPart1: true, montantPart2: true },
  });
  const genereMois = Number(genereAgg._sum.montantTotal ?? 0);
  const genereSignature = Number(genereAgg._sum.montantPart1 ?? 0);
  const genereEtale = Number(genereAgg._sum.montantPart2 ?? 0);

  // ---- Objectif du mois ----
  const objective = objectives.get(user.id) ?? null;
  const realisedOrNull = await soft<MonthRealised | null>(
    getMonthRealised(user.id, w, { commissionTotal: monthTotal }),
    null,
    "réalisé du mois",
  );
  const realised = realisedOrNull ?? emptyRealised(monthTotal);
  // Pas de jauge sur un réalisé inconnu (on n'affiche pas un faux 0 %).
  const metrics =
    objective && realisedOrNull ? buildMetrics(objective.targets, realisedOrNull, w) : [];

  // Panier moyen : valeur totale moyenne d'un contrat signé (12 derniers mois).
  const panierMoyen =
    signedContracts.length > 0
      ? signedContracts.reduce(
          (s, c) => s + Number(c.montantOneShot) + Number(c.montantMensuel) * c.dureeMois,
          0,
        ) / signedContracts.length
      : null;

  return {
    window: w,
    rates: {
      signature: Number(userRates?.tauxCommissionSignature ?? 0.25),
      renouvellement: Number(userRates?.tauxCommissionRenouvellement ?? 0.1),
      typeContrat: userRates?.typeContrat ?? null,
    },
    cockpit,
    timeline,
    month: {
      total: monthTotal,
      genere: genereMois,
      genereSignature,
      genereEtale,
      acquis: current?.acquis ?? 0,
      aVenir: current?.aVenir ?? 0,
      signature: current?.signature ?? 0,
      recurrent: current?.recurrent ?? 0,
      lines,
      prev,
      next,
      bestPast,
    },
    objective,
    realised,
    metrics,
    panierMoyen,
    upcomingRdvs: upcoming.map((a) => ({
      id: a.id,
      date: a.date,
      client: a.prospect?.raisonSociale ?? null,
    })),
    upcomingRdvCount: upcomingCount,
    presets: presetsRaw.map((p) => ({
      id: p.id,
      nom: p.nom,
      oneShot: Number(p.prixOneShot ?? 0),
      mensuel: Number(p.prixMensuel ?? 0),
      duree: p.engagementMois && p.engagementMois > 0 ? p.engagementMois : 12,
      ads: ADS_CATEGORIES.has(p.categorie),
    })),
  };
}
