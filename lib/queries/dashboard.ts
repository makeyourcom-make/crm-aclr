/**
 * Requêtes pour le Dashboard (étape 16) + résultats commerciaux (prochains
 * RDV avec la valeur du deal ouvert, fil des derniers résultats, activité par
 * période, calendrier du mois). Données réelles uniquement.
 */
import type { ActivityStatut, ActivityType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getDayCounters } from "@/lib/gamification";
import type { DayCounters } from "@/lib/gamification/rules";
import { getActivityTypeLabel } from "@/lib/labels";
import { addDays, daysInMonth, isWorkingDay } from "@/lib/planning/dates";
import { type SessionUser } from "@/lib/session";

export interface MonthlyObjectiveProgress {
  hasObjective: boolean;
  objectiveId?: string;
  // Objectifs fixés (vide si pas d'Objective MENSUEL actif)
  nbAppelsObjectif: number | null;
  nbContactsObjectif: number | null; // = nbEmailsObjectif (emails + RS)
  nbRdvObjectif: number | null;
  nbSignaturesObjectif: number | null;
  caObjectif: number | null;
  // Réalisé ce mois (toujours calculé)
  nbAppelsRealise: number;
  nbContactsRealise: number; // emails + LinkedIn + SMS
  nbRdvRealise: number;
  nbSignaturesRealise: number;
  caRealise: number;
}

export interface DashboardData {
  // KPI du mois
  signaturesMois: { count: number; montant: number };
  commissionsAcquisesMois: number;
  /** Commissions générées sur les contrats signés ce mois (25 % de la valeur signée, hors budget pub). */
  commissionsEstimeesMois: number;
  /** Forfait de frais mensuel (ex. 250 CHF), à ajouter aux commissions. */
  forfaitFraisMois: number;
  /** = MAX(commissions du mois, garantie) + frais */
  salairePrevuMois: number;
  garantieActiveMois: boolean;

  // Objectifs du mois (étape 20)
  monthlyProgress: MonthlyObjectiveProgress;

  // Évolution 12 mois (CA signé par mois - somme valeurAn1 des contrats signés)
  evolutionCASignatures: Array<{ label: string; montant: number }>;

  // Pipeline résumé
  pipelineParStage: Array<{ stage: string; count: number; montant: number }>;

  // Top deals (proposition / négociation)
  topDeals: Array<{
    id: string;
    titre: string;
    raisonSociale: string;
    montantPrevu: number;
    probabilite: number;
    montantPondere: number;
  }>;

  // Renouvellements à venir (90 jours)
  renouvellementsAVenir: Array<{
    contractId: string;
    numero: string;
    raisonSociale: string;
    dateAnniversaire: Date;
    commissionMensuelle: number;
  }>;

  // Section admin only
  caAgenceMois?: number;
  montantAVerserCommerciales?: number;
  caRecurrentTotalMensuel?: number;
  /** CA annuel : valeur totale des contrats signés du 1er janvier à aujourd'hui,
   *  comparé à la même période l'an dernier (variationPct null si l'an dernier = 0). */
  caAnnuel?: {
    annee: number;
    courant: number;
    precedent: number;
    variationPct: number | null;
  };
  /** Contrats signés par le client en attente de contre-signature ACLR. */
  contratsAValider?: Array<{
    contractId: string;
    numero: string;
    raisonSociale: string;
    signatureId: string;
    dateSignatureClient: Date | null;
    valeurAn1: number;
    commercialeName: string;
  }>;
  /** Contrats contre-signés par la commerciale (statut ATTENTE_VALIDATION_ADMIN)
   *  en attente de la validation DÉFINITIVE de l'admin → ACTIF. */
  contratsAValiderDefinitif?: Array<{
    contractId: string;
    numero: string;
    raisonSociale: string;
    valeurAn1: number;
    /** Mensuel du contrat (montant affiché sur la carte de signature). */
    montantMensuel: number;
    commercialeName: string;
    contreSigneLe: Date | null;
  }>;
}

/** Statuts d'un contrat RÉELLEMENT signé (exécutoire) - exclut les propositions
 *  encore en attente de signature client / validation admin. Le CA et le compteur
 *  de signatures ne doivent compter QUE ces contrats-là. */
const STATUTS_SIGNES = [
  "ACTIF",
  "SUSPENDU",
  "RESILIE",
  "EXPIRE",
] as const;

/** Valeur TOTALE d'un contrat sur sa durée réelle : one-shot + mensuel × durée.
 *  Contrairement à `valeurAn1` (plafonnée à 12 mois), reflète la vraie valeur
 *  d'un contrat pluriannuel - utilisée pour le CA agence et le CA annuel. */
function valeurTotaleContrat(c: {
  montantOneShot: unknown;
  montantMensuel: unknown;
  dureeMois: number;
}): number {
  return Number(c.montantOneShot) + Number(c.montantMensuel) * c.dureeMois;
}

export async function getDashboard(user: SessionUser): Promise<DashboardData> {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const scopeContract =
    user.role === "ADMIN" ? {} : { assigneAId: user.id };
  const scopeCommission =
    user.role === "ADMIN" ? {} : { commission: { userId: user.id } };
  const scopeDeal = user.role === "ADMIN" ? {} : { assigneAId: user.id };

  // ──────────────────────────────────────────────────────────────────
  // PARALLÉLISATION : les étapes 1, 2, 3-user, 4, 5, 6, 7 sont toutes
  // indépendantes et peuvent partir en même temps. Promise.all() →
  // gain ~6-7× sur le block de queries du dashboard.
  // ──────────────────────────────────────────────────────────────────
  const start12 = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const in90Days = new Date(now);
  in90Days.setDate(in90Days.getDate() + 90);

  const [
    signaturesMoisRaw,
    comAcquisesMois,
    userSettings,
    contractsLast12,
    dealsAggregated,
    hotDeals,
    contractsForRenewal,
    monthlyProgressPartial,
  ] = await Promise.all([
    // 1. Signatures ce mois - contrats RÉELLEMENT signés (pas les propositions),
    //    valeur TOTALE (pas an 1).
    prisma.contract.findMany({
      where: {
        ...scopeContract,
        statut: { in: [...STATUTS_SIGNES] },
        dateSignature: { gte: startMonth, lte: endMonth },
      },
      select: {
        montantOneShot: true,
        montantMensuel: true,
        dureeMois: true,
      },
    }),
    // 2. Commissions acquises ce mois
    prisma.commissionPayment.aggregate({
      where: {
        ...scopeCommission,
        statut: "PAYE",
        dateVersement: { gte: startMonth, lte: endMonth },
      },
      _sum: { montant: true },
    }),
    // 3. User garantie/frais (uniquement pour les commerciales)
    user.role === "ADMIN"
      ? Promise.resolve(null)
      : prisma.user.findUnique({
          where: { id: user.id },
          select: { garantieMensuelle: true, forfaitFrais: true },
        }),
    // 4. Évolution 12 mois (CA signé par mois - valeur TOTALE, contrats signés)
    prisma.contract.findMany({
      where: {
        ...scopeContract,
        statut: { in: [...STATUTS_SIGNES] },
        dateSignature: { gte: start12 },
      },
      select: {
        dateSignature: true,
        montantOneShot: true,
        montantMensuel: true,
        dureeMois: true,
      },
    }),
    // 5. Pipeline résumé - MÊME filtre que le Kanban /pipeline pour que les
    //    chiffres correspondent : stages actifs toujours comptés, mais
    //    Signé/Perdu uniquement clôturés le mois en cours (sinon la carte
    //    cumulait tout l'historique et ne matchait pas la page Pipeline).
    prisma.deal.groupBy({
      by: ["stage"],
      where: {
        ...scopeDeal,
        OR: [
          { stage: { notIn: ["SIGNE", "PERDU"] } },
          { stage: "SIGNE", closeReelLe: { gte: startMonth } },
          { stage: "PERDU", closeReelLe: { gte: startMonth } },
        ],
      },
      _count: true,
      _sum: { montantPrevu: true },
    }),
    // 6. Top deals chauds (Proposition + Négociation)
    prisma.deal.findMany({
      where: {
        ...scopeDeal,
        stage: { in: ["PROPOSITION", "NEGOCIATION"] },
      },
      select: {
        id: true,
        titre: true,
        montantPrevu: true,
        probabilite: true,
        prospect: { select: { raisonSociale: true } },
      },
    }),
    // 7. Renouvellements à venir 90 jours
    prisma.contract.findMany({
      where: { ...scopeContract, statut: "ACTIF", montantMensuel: { gt: 0 } },
      select: {
        id: true,
        numero: true,
        dateSignature: true,
        montantMensuel: true,
        prospect: { select: { raisonSociale: true } },
        assigneA: { select: { tauxCommissionRenouvellement: true } },
      },
    }),
    // 8. Progression objectif mensuel (objective + 4 counts, en parallèle interne)
    //    → ne dépend PAS de signaturesMoisRaw : on fusionne après.
    computeMonthlyProgressPartial(user, startMonth, endMonth),
  ]);

  // Calcul garantie/frais depuis le résultat parallèle
  let garantieMensuelle = 2500;
  let forfaitFrais = 250;
  if (userSettings) {
    garantieMensuelle = Number(userSettings.garantieMensuelle);
    forfaitFrais = Number(userSettings.forfaitFrais);
  }
  const comMois = Number(comAcquisesMois._sum.montant ?? 0);
  // Commissions GÉNÉRÉES sur les contrats signés ce mois (25 % de la valeur 1re
  // année, frais compris), qu'elles soient déjà versées ou à venir. Les commerciales
  // voient ce montant ; l'« acquis » (versé) reste disponible à part.
  const commissionsEstimeesMois =
    user.role === "ADMIN"
      ? 0
      : Number(
          (
            await prisma.commission.aggregate({
              where: {
                userId: user.id,
                contract: {
                  statut: { in: [...STATUTS_SIGNES] },
                  dateSignature: { gte: startMonth, lte: endMonth },
                },
              },
              _sum: { montantTotal: true },
            })
          )._sum.montantTotal ?? 0,
        );
  // Rémunération prévue du mois : commissions générées (ou garantie) + frais.
  const salairePrevuMois = Math.max(commissionsEstimeesMois, garantieMensuelle) + forfaitFrais;
  const garantieActiveMois = commissionsEstimeesMois < garantieMensuelle;

  // Signatures du mois : count + valeur TOTALE (one-shot + mensuel × durée).
  const signaturesMoisCount = signaturesMoisRaw.length;
  const signaturesMoisMontant = signaturesMoisRaw.reduce(
    (s, c) => s + valeurTotaleContrat(c),
    0,
  );

  // 3.b Objectif mensuel : fusion des données partielles avec signaturesMoisRaw
  const monthlyProgress: MonthlyObjectiveProgress = {
    ...monthlyProgressPartial,
    nbSignaturesRealise: signaturesMoisCount,
    caRealise: signaturesMoisMontant,
  };
  // Évolution 12 mois - agrégation in-memory du résultat de la query 4
  const monthMap = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthMap.set(key, 0);
  }
  for (const c of contractsLast12) {
    if (!c.dateSignature) continue;
    const key = `${c.dateSignature.getFullYear()}-${c.dateSignature.getMonth()}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + valeurTotaleContrat(c));
  }
  const evolutionCASignatures: DashboardData["evolutionCASignatures"] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    evolutionCASignatures.push({
      label: d.toLocaleDateString("fr-CH", { month: "short" }).replace(".", ""),
      montant: monthMap.get(key) ?? 0,
    });
  }

  // Pipeline résumé - agrégé du résultat de la query 5
  const stages = ["DECOUVERTE", "PROPOSITION", "NEGOCIATION", "SIGNE", "PERDU"];
  const pipelineParStage = stages.map((s) => {
    const found = dealsAggregated.find((d) => d.stage === s);
    return {
      stage: s,
      count: found?._count ?? 0,
      montant: Number(found?._sum.montantPrevu ?? 0),
    };
  });

  // Top deals - calcul du résultat de la query 6
  const topDeals = hotDeals
    .map((d) => ({
      id: d.id,
      titre: d.titre,
      raisonSociale: d.prospect.raisonSociale,
      montantPrevu: Number(d.montantPrevu),
      probabilite: d.probabilite,
      montantPondere: (Number(d.montantPrevu) * d.probabilite) / 100,
    }))
    .sort((a, b) => b.montantPondere - a.montantPondere)
    .slice(0, 5);

  // Renouvellements à venir - calcul du résultat de la query 7
  const renouvellementsAVenir = contractsForRenewal
    .map((c) => {
      // Prochain anniversaire
      const anniv = new Date(c.dateSignature);
      while (anniv <= now) {
        anniv.setFullYear(anniv.getFullYear() + 1);
      }
      const taux = Number(c.assigneA.tauxCommissionRenouvellement);
      return {
        contractId: c.id,
        numero: c.numero,
        raisonSociale: c.prospect.raisonSociale,
        dateAnniversaire: anniv,
        commissionMensuelle: Number(c.montantMensuel) * taux,
      };
    })
    .filter((r) => r.dateAnniversaire <= in90Days)
    .sort((a, b) => a.dateAnniversaire.getTime() - b.dateAnniversaire.getTime());

  // 8. Vue admin
  let caAgenceMois: number | undefined;
  let montantAVerserCommerciales: number | undefined;
  let caRecurrentTotalMensuel: number | undefined;
  let caAnnuel: DashboardData["caAnnuel"];
  let contratsAValider: DashboardData["contratsAValider"];
  let contratsAValiderDefinitif: DashboardData["contratsAValiderDefinitif"];

  if (user.role === "ADMIN") {
    // Bornes du CA annuel : 1er janvier → aujourd'hui, vs la MÊME période
    // l'an dernier (comparaison à date équivalente, pas l'année pleine).
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const prevYearSameDate = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
    );
    // Queries admin indépendantes → en parallèle.
    const [
      allComMois,
      allActiveContracts,
      sigsAValider,
      annualCourant,
      annualPrecedent,
      contratsAttenteValidation,
    ] = await Promise.all([
        prisma.commissionPayment.aggregate({
          where: {
            statut: "PAYE",
            dateVersement: { gte: startMonth, lte: endMonth },
          },
          _sum: { montant: true },
        }),
        prisma.contract.aggregate({
          where: { statut: "ACTIF" },
          _sum: { montantMensuel: true },
        }),
        prisma.signature.findMany({
          where: { signeParClient: true, signeParAclr: false },
          select: {
            id: true,
            dateSignatureClient: true,
            contract: {
              select: {
                id: true,
                numero: true,
                valeurAn1: true,
                assigneA: { select: { name: true } },
                prospect: { select: { raisonSociale: true } },
              },
            },
          },
          orderBy: { dateSignatureClient: "asc" },
        }),
        prisma.contract.findMany({
          where: {
            statut: { in: [...STATUTS_SIGNES] },
            dateSignature: { gte: yearStart, lte: now },
          },
          select: { montantOneShot: true, montantMensuel: true, dureeMois: true },
        }),
        prisma.contract.findMany({
          where: {
            statut: { in: [...STATUTS_SIGNES] },
            dateSignature: { gte: prevYearStart, lte: prevYearSameDate },
          },
          select: { montantOneShot: true, montantMensuel: true, dureeMois: true },
        }),
        // Contrats contre-signés par la commerciale, en attente de validation
        // définitive admin → ACTIF.
        prisma.contract.findMany({
          where: { statut: "ATTENTE_VALIDATION_ADMIN" },
          select: {
            id: true,
            numero: true,
            valeurAn1: true,
            montantMensuel: true,
            assigneA: { select: { name: true } },
            prospect: { select: { raisonSociale: true } },
            signatures: {
              where: { signeParAclr: true },
              orderBy: { dateSignatureAclr: "desc" },
              take: 1,
              select: { dateSignatureAclr: true },
            },
          },
          orderBy: { updatedAt: "asc" },
        }),
      ]);
    // Admin : scopeContract = {} → signaturesMoisMontant = tout le mois = CA agence.
    caAgenceMois = signaturesMoisMontant;
    montantAVerserCommerciales = Number(allComMois._sum.montant ?? 0);
    caRecurrentTotalMensuel = Number(allActiveContracts._sum.montantMensuel ?? 0);
    const courant = annualCourant.reduce((s, c) => s + valeurTotaleContrat(c), 0);
    const precedent = annualPrecedent.reduce(
      (s, c) => s + valeurTotaleContrat(c),
      0,
    );
    caAnnuel = {
      annee: now.getFullYear(),
      courant,
      precedent,
      variationPct:
        precedent > 0 ? ((courant - precedent) / precedent) * 100 : null,
    };
    contratsAValider = sigsAValider.map((s) => ({
      contractId: s.contract.id,
      numero: s.contract.numero,
      raisonSociale: s.contract.prospect.raisonSociale,
      signatureId: s.id,
      dateSignatureClient: s.dateSignatureClient,
      valeurAn1: Number(s.contract.valeurAn1),
      commercialeName: s.contract.assigneA?.name ?? "-",
    }));
    contratsAValiderDefinitif = contratsAttenteValidation.map((c) => ({
      contractId: c.id,
      numero: c.numero,
      raisonSociale: c.prospect.raisonSociale,
      valeurAn1: Number(c.valeurAn1),
      montantMensuel: Number(c.montantMensuel) || 0,
      commercialeName: c.assigneA?.name ?? "-",
      contreSigneLe: c.signatures[0]?.dateSignatureAclr ?? null,
    }));
  }

  return {
    signaturesMois: {
      count: signaturesMoisCount,
      montant: signaturesMoisMontant,
    },
    commissionsAcquisesMois: comMois,
    commissionsEstimeesMois,
    forfaitFraisMois: forfaitFrais,
    salairePrevuMois,
    garantieActiveMois,
    monthlyProgress,
    evolutionCASignatures,
    pipelineParStage,
    topDeals,
    renouvellementsAVenir,
    caAgenceMois,
    montantAVerserCommerciales,
    caRecurrentTotalMensuel,
    caAnnuel,
    contratsAValider,
    contratsAValiderDefinitif,
  };
}

// ---------------------------------------------------------------------------
// HELPER - Progression objectifs du mois
// ---------------------------------------------------------------------------

/**
 * Variante "partielle" de la progression objectif : ne lit PAS
 * signaturesMoisRaw (qu'on a déjà côté caller). Permet de paralléliser cette
 * fonction avec le Promise.all principal du dashboard plutôt que d'attendre
 * la fin de la 1re vague.
 *
 * Le caller fusionnera nbSignaturesRealise + caRealise après.
 */
async function computeMonthlyProgressPartial(
  user: SessionUser,
  startMonth: Date,
  endMonth: Date,
): Promise<Omit<MonthlyObjectiveProgress, "nbSignaturesRealise" | "caRealise">> {
  const userId = user.id;
  const userScope = { userId };

  const [
    objective,
    nbAppelsRealise,
    nbEmailsRealise,
    nbRsRealise,
    nbRdvRealise,
  ] = await Promise.all([
    prisma.objective.findFirst({
      where: {
        userId,
        periode: "MENSUEL",
        isActif: true,
        dateDebut: { lte: endMonth },
        dateFin: { gte: startMonth },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activity.count({
      where: {
        ...userScope,
        type: "APPEL_SORTANT",
        date: { gte: startMonth, lte: endMonth },
        statut: { in: ["FAIT", "EN_COURS"] },
      },
    }),
    prisma.activity.count({
      where: {
        ...userScope,
        type: "EMAIL_ENVOYE",
        date: { gte: startMonth, lte: endMonth },
      },
    }),
    prisma.activity.count({
      where: {
        ...userScope,
        type: { in: ["LINKEDIN", "SMS"] },
        date: { gte: startMonth, lte: endMonth },
      },
    }),
    prisma.activity.count({
      where: {
        ...userScope,
        type: { in: ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"] },
        // RDV honoré = rattaché à un client (exclut phoning / points internes).
        prospectId: { not: null },
        date: { gte: startMonth, lte: new Date(Math.min(endMonth.getTime(), Date.now())) },
        statut: "FAIT",
      },
    }),
  ]);

  return {
    hasObjective: !!objective,
    objectiveId: objective?.id,
    nbAppelsObjectif: objective?.nbAppelsObjectif ?? null,
    nbContactsObjectif: objective?.nbEmailsObjectif ?? null,
    nbRdvObjectif: objective?.nbRdvObjectif ?? null,
    nbSignaturesObjectif: objective?.nbSignaturesObjectif ?? null,
    caObjectif:
      objective?.caObjectif != null ? Number(objective.caObjectif) : null,
    nbAppelsRealise,
    nbContactsRealise: nbEmailsRealise + nbRsRealise,
    nbRdvRealise,
  };
}

// ===========================================================================
// Résultats commerciaux du Dashboard (données réelles uniquement)
// ===========================================================================

// ---------------------------------------------------------------------------
// Fuseau Europe/Zurich (les dates sont stockées en UTC ; le serveur tourne en
// UTC : on découpe les jours / semaines / mois vus de Suisse).
// ---------------------------------------------------------------------------

const TZ = "Europe/Zurich";

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const zKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const zPartsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Clé « AAAA-MM-JJ » du jour (vu de Suisse) contenant l'instant `d`. */
function zKey(d: Date): string {
  return zKeyFmt.format(d);
}

/** Décalage (ms) entre l'heure de Zurich et UTC à l'instant `at`. */
function zOffsetMs(at: Date): number {
  const p: Record<string, number> = {};
  for (const part of zPartsFmt.formatToParts(at)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Clé de jour → minuit UTC (convention de `lib/planning/dates.ts`). */
function keyToUtc(key: string): Date {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function utcToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Instant UTC de minuit (heure de Zurich) du jour `key`. */
function zMidnight(key: string): Date {
  const guess = keyToUtc(key).getTime();
  const first = guess - zOffsetMs(new Date(guess));
  return new Date(guess - zOffsetMs(new Date(first)));
}

const RDV_TYPES: ActivityType[] = ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"];
/** Statuts d'un RDV encore « en attente » (même liste que rdv-a-valider.ts). */
const RDV_EN_ATTENTE: ActivityStatut[] = ["PLANIFIE", "EN_COURS", "REPLANIFIE"];
/** Contrats pas encore signés (exclus des signatures, comme stats.ts / le moteur). */
const STATUTS_NON_SIGNES = ["ATTENTE_SIGNATURE_CLIENT", "ATTENTE_VALIDATION_ADMIN"] as const;

/**
 * Texte saisi / généré (sujets d'activité, d'email) prêt à l'affichage :
 * pas de grand tiret (règle Arthur), pas de tiret orphelin en tête.
 */
export function cleanText(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/^\s*-\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Lieu affichable d'un RDV : adresse saisie, sinon ville du client. */
export function lieuRdv(
  type: ActivityType | string,
  adresseRdv: string | null,
  ville: string | null | undefined,
): string | null {
  const adresse = adresseRdv?.trim();
  if (adresse) return /^https?:\/\//i.test(adresse) ? "Lien visio" : adresse;
  const v = ville?.trim() || null;
  if (type === "RDV_TELEPHONIQUE") return v ? `Par téléphone · ${v}` : "Par téléphone";
  if (type === "RDV_VISIO") return v ? `Visio · ${v}` : "Visio";
  return v;
}

// ---------------------------------------------------------------------------
// Calendrier du mois en cours (objectifs du mois)
// ---------------------------------------------------------------------------

export interface MonthCalendar {
  /** « Octobre 2026 » */
  label: string;
  /** « octobre » */
  mois: string;
  /** « septembre » */
  moisPrecedent: string;
  /** Part du mois calendaire écoulée, aujourd'hui compris (0-100). */
  pctEcoule: number;
  /** Jours ouvrés restants (lun-ven hors fériés VS), aujourd'hui compris. */
  joursOuvresRestants: number;
}

export function getMonthCalendar(now: Date = new Date()): MonthCalendar {
  const today = keyToUtc(zKey(now));
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const dim = daysInMonth(y, m);
  const dom = today.getUTCDate();
  let restants = 0;
  for (let d = dom; d <= dim; d++) {
    if (isWorkingDay(new Date(Date.UTC(y, m, d)))) restants += 1;
  }
  const mois = MOIS[m] ?? "";
  return {
    label: `${mois.charAt(0).toUpperCase()}${mois.slice(1)} ${y}`,
    mois,
    moisPrecedent: MOIS[(m + 11) % 12] ?? "",
    pctEcoule: Math.round((dom / dim) * 100),
    joursOuvresRestants: restants,
  };
}

/** Vrai si aujourd'hui (vu de Suisse) est un jour ouvré (lun-ven hors fériés VS). */
export function isTodayWorkingDay(now: Date = new Date()): boolean {
  return isWorkingDay(keyToUtc(zKey(now)));
}

// ---------------------------------------------------------------------------
// « Ton activité » : compteurs jour / semaine / mois vs période précédente
// ---------------------------------------------------------------------------

export type ActivityPeriodKey = "jour" | "semaine" | "mois";

export interface ActivityPeriod {
  key: ActivityPeriodKey;
  /** Libellé du bouton (« Jour »). */
  label: string;
  /** Sous-titre (« Aujourd'hui · mardi 27.10.2026 »). */
  sousTitre: string;
  /** Complément des tendances (« vs hier », « vs sem. passée », « vs septembre »). */
  compareLabel: string;
  current: DayCounters;
  /** Même fenêtre, période précédente, arrêtée au même moment. */
  previous: DayCounters;
}

/**
 * Compteurs de l'utilisateur (mêmes définitions que lib/gamification) sur
 * le jour, la semaine ISO et le mois en cours, comparés à la période
 * précédente « à date équivalente » (veille ouvrée à la même heure, même
 * moment la semaine passée, même jour du mois précédent). 6 petites requêtes
 * en parallèle.
 */
export async function getActivityPeriods(userId: string): Promise<ActivityPeriod[]> {
  const now = new Date();
  const todayKey = zKey(now);
  const today = keyToUtc(todayKey);
  const dayStart = zMidnight(todayKey);
  const dayEnd = new Date(zMidnight(utcToKey(addDays(today, 1))).getTime() - 1);
  const sinceDayStart = Math.max(0, now.getTime() - dayStart.getTime());

  // Jour : comparé au jour ouvré précédent (le lundi, au vendredi), arrêté à
  // la même heure (sinon une journée en cours paraît toujours en baisse face
  // à une veille complète).
  let prev = addDays(today, -1);
  for (let i = 0; i < 10 && !isWorkingDay(prev); i++) prev = addDays(prev, -1);
  const prevKey = utcToKey(prev);
  const prevStart = zMidnight(prevKey);
  const prevDayEnd = zMidnight(utcToKey(addDays(prev, 1))).getTime() - 1;
  const prevEnd = new Date(Math.min(prevDayEnd, prevStart.getTime() + sinceDayStart));
  const yesterdayKey = utcToKey(addDays(today, -1));

  // Semaine ISO : lundi → aujourd'hui, vs même moment la semaine passée.
  const dow = today.getUTCDay() || 7;
  const monday = addDays(today, -(dow - 1));
  const weekStart = zMidnight(utcToKey(monday));
  const prevWeekStart = zMidnight(utcToKey(addDays(monday, -7)));
  const prevWeekEnd = new Date(
    zMidnight(utcToKey(addDays(today, -7))).getTime() + sinceDayStart,
  );

  // Mois : 1er → aujourd'hui, vs même jour (même heure) du mois précédent.
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const monthStart = zMidnight(`${y}-${pad2(m + 1)}-01`);
  const py = m === 0 ? y - 1 : y;
  const pm = m === 0 ? 11 : m - 1;
  const prevMonthStart = zMidnight(`${py}-${pad2(pm + 1)}-01`);
  const dom = today.getUTCDate();
  const prevMonthEnd =
    dom > daysInMonth(py, pm)
      ? new Date(monthStart.getTime() - 1)
      : new Date(zMidnight(`${py}-${pad2(pm + 1)}-${pad2(dom)}`).getTime() + sinceDayStart);

  const [jour, veille, semaine, semainePassee, mois, moisPasse] = await Promise.all([
    getDayCounters(userId, dayStart, dayEnd),
    getDayCounters(userId, prevStart, prevEnd),
    getDayCounters(userId, weekStart, dayEnd),
    getDayCounters(userId, prevWeekStart, prevWeekEnd),
    getDayCounters(userId, monthStart, dayEnd),
    getDayCounters(userId, prevMonthStart, prevMonthEnd),
  ]);

  const [ty, tm, td] = todayKey.split("-");
  const jourNom = JOURS[today.getUTCDay()] ?? "";
  const [my, mm, md] = utcToKey(monday).split("-");
  const moisNom = MOIS[m] ?? "";
  const veilleNom = prevKey === yesterdayKey ? "hier" : (JOURS[prev.getUTCDay()] ?? "");

  return [
    {
      key: "jour",
      label: "Jour",
      sousTitre: `Aujourd'hui · ${jourNom} ${td}.${tm}.${ty} · comparé à ${veilleNom} à la même heure`,
      compareLabel: `vs ${veilleNom}`,
      current: jour,
      previous: veille,
    },
    {
      key: "semaine",
      label: "Semaine",
      sousTitre: `Semaine en cours · depuis le lundi ${md}.${mm}.${my}`,
      compareLabel: "vs sem. passée",
      current: semaine,
      previous: semainePassee,
    },
    {
      key: "mois",
      label: "Mois",
      sousTitre: `${moisNom.charAt(0).toUpperCase()}${moisNom.slice(1)} ${y} · depuis le 01.${pad2(m + 1)}.${y}`,
      compareLabel: `vs ${MOIS[pm]}`,
      current: mois,
      previous: moisPasse,
    },
  ];
}

// ---------------------------------------------------------------------------
// Prochains RDV client
// ---------------------------------------------------------------------------

export interface UpcomingRdv {
  id: string;
  /** ISO */
  date: string;
  type: ActivityType;
  typeLabel: string;
  sujet: string;
  prospectId: string | null;
  raisonSociale: string | null;
  lieu: string | null;
  /**
   * Valeur du deal ouvert du client (montant prévu sur 1 an, CHF), la plus
   * élevée s'il y en a plusieurs. null si aucun deal ouvert : jamais inventée.
   */
  valeurDeal: number | null;
}

/**
 * Prochains RDV client de l'utilisateur (à venir, encore planifiés), +
 * nombre de RDV restants d'ici dimanche soir. Mêmes critères que les RDV
 * « effectués » de lib/gamification : rattachés à un client. Chaque RDV porte
 * la valeur du deal ouvert du client quand elle existe.
 */
export async function getUpcomingRdv(
  userId: string,
  limit = 5,
): Promise<{ rdvs: UpcomingRdv[]; restantsSemaine: number }> {
  const now = new Date();
  const today = keyToUtc(zKey(now));
  const dow = today.getUTCDay() || 7;
  const nextMonday = addDays(today, 8 - dow);
  const endOfWeek = zMidnight(utcToKey(nextMonday));

  const where = {
    userId,
    type: { in: RDV_TYPES },
    prospectId: { not: null },
    statut: { in: RDV_EN_ATTENTE },
  };

  const [rows, restantsSemaine] = await Promise.all([
    prisma.activity.findMany({
      where: { ...where, date: { gt: now } },
      select: {
        id: true,
        date: true,
        type: true,
        sujet: true,
        adresseRdv: true,
        prospectId: true,
        prospect: { select: { raisonSociale: true, ville: true } },
      },
      orderBy: { date: "asc" },
      take: limit,
    }),
    prisma.activity.count({
      where: { ...where, date: { gt: now, lt: endOfWeek } },
    }),
  ]);

  // Valeur du deal ouvert (hors Signé / Perdu) de chaque client listé.
  const prospectIds = [
    ...new Set(rows.map((r) => r.prospectId).filter((id): id is string => id !== null)),
  ];
  const deals =
    prospectIds.length > 0
      ? await prisma.deal.findMany({
          where: { prospectId: { in: prospectIds }, stage: { notIn: ["SIGNE", "PERDU"] } },
          select: { prospectId: true, montantPrevu: true },
        })
      : [];
  const valeurParClient = new Map<string, number>();
  for (const d of deals) {
    const v = Number(d.montantPrevu) || 0;
    if (v > (valeurParClient.get(d.prospectId) ?? 0)) valeurParClient.set(d.prospectId, v);
  }

  return {
    rdvs: rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString(),
      type: r.type,
      typeLabel: getActivityTypeLabel(r.type),
      sujet: cleanText(r.sujet),
      prospectId: r.prospectId,
      raisonSociale: r.prospect?.raisonSociale ?? null,
      lieu: lieuRdv(r.type, r.adresseRdv, r.prospect?.ville),
      valeurDeal: r.prospectId ? (valeurParClient.get(r.prospectId) ?? null) : null,
    })),
    restantsSemaine,
  };
}


// ---------------------------------------------------------------------------
// Derniers résultats (RDV pris, RDV effectués, propositions, signatures)
// ---------------------------------------------------------------------------

export type ResultFeedKind = "rdvPris" | "rdvEffectue" | "proposition" | "signature";

export interface ResultFeedItem {
  id: string;
  /** ISO */
  at: string;
  kind: ResultFeedKind;
  title: string;
  detail: string | null;
  href: string | null;
  /** Montants du contrat (propositions / signatures), null sinon. */
  montant: { mensuel: number; oneShot: number } | null;
}

const FEED_DAYS = 30;

/**
 * Derniers résultats de l'utilisateur (30 derniers jours), mêmes critères
 * que lib/gamification :
 *  - RDV pris (résultat RDV_PRIS) ;
 *  - RDV client effectué (FAIT, date passée) ;
 *  - proposition (contrat créé, hors imports a posteriori) ;
 *  - contrat signé, avec ses montants (CHF / mois et one-shot).
 * Les appels et emails n'y figurent pas : ce sont des actions, pas des
 * résultats (ils restent dans « Ton activité »).
 */
export async function getResultsFeed(userId: string, limit = 8): Promise<ResultFeedItem[]> {
  const now = new Date();
  const since = new Date(now.getTime() - FEED_DAYS * 86_400_000);

  const [activities, contracts] = await Promise.all([
    prisma.activity.findMany({
      where: {
        userId,
        date: { gte: since, lte: now },
        OR: [
          { resultat: "RDV_PRIS" },
          { type: { in: RDV_TYPES }, prospectId: { not: null }, statut: "FAIT" },
        ],
      },
      select: {
        id: true,
        type: true,
        date: true,
        statut: true,
        resultat: true,
        sujet: true,
        prospectId: true,
        prospect: { select: { raisonSociale: true } },
      },
      orderBy: { date: "desc" },
      take: limit,
    }),
    prisma.contract.findMany({
      where: {
        assigneAId: userId,
        OR: [
          { createdAt: { gte: since, lte: now } },
          {
            dateSignature: { gte: since, lte: now },
            statut: { notIn: [...STATUTS_NON_SIGNES] },
          },
        ],
      },
      select: {
        id: true,
        numero: true,
        createdAt: true,
        dateSignature: true,
        statut: true,
        montantMensuel: true,
        montantOneShot: true,
        prospect: { select: { raisonSociale: true } },
      },
      // Pas de `take` : la fenêtre de 30 jours borne déjà le volume, et un
      // tri sur updatedAt pouvait écarter une signature récente.
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const items: ResultFeedItem[] = [];

  for (const a of activities) {
    const qui = a.prospect?.raisonSociale ?? null;
    const href = a.prospectId ? `/prospects/${a.prospectId}` : null;
    const isRdvEffectue =
      RDV_TYPES.includes(a.type) && a.prospectId !== null && a.statut === "FAIT";
    if (isRdvEffectue) {
      items.push({
        id: a.id,
        at: a.date.toISOString(),
        kind: "rdvEffectue",
        title: qui ? `RDV effectué avec ${qui}` : "RDV effectué",
        detail: getActivityTypeLabel(a.type),
        href,
        montant: null,
      });
    } else if (a.resultat === "RDV_PRIS") {
      items.push({
        id: a.id,
        at: a.date.toISOString(),
        kind: "rdvPris",
        title: qui ? `RDV pris avec ${qui}` : "RDV pris",
        detail:
          a.type === "APPEL_SORTANT" || a.type === "APPEL_ENTRANT"
            ? "Décroché au téléphone"
            : cleanText(a.sujet) || null,
        href,
        montant: null,
      });
    }
  }

  for (const c of contracts) {
    const qui = c.prospect.raisonSociale;
    const href = `/contrats/${c.id}`;
    const montant = {
      mensuel: Math.max(0, Number(c.montantMensuel) || 0),
      oneShot: Math.max(0, Number(c.montantOneShot) || 0),
    };
    // Contrats importés a posteriori (signés bien avant leur saisie) : pas une
    // proposition récente (même exclusion que lib/gamification).
    const importe =
      c.dateSignature !== null &&
      c.dateSignature.getTime() < c.createdAt.getTime() - 7 * 86_400_000;
    if (c.createdAt >= since && c.createdAt <= now && !importe) {
      items.push({
        id: `${c.id}-proposition`,
        at: c.createdAt.toISOString(),
        kind: "proposition",
        title: `Proposition créée · ${qui}`,
        detail: c.numero,
        href,
        montant,
      });
    }
    const signe = !(STATUTS_NON_SIGNES as readonly string[]).includes(c.statut);
    if (signe && c.dateSignature && c.dateSignature >= since && c.dateSignature <= now) {
      items.push({
        id: `${c.id}-signature`,
        at: c.dateSignature.toISOString(),
        kind: "signature",
        title: `Contrat signé · ${qui}`,
        detail: c.numero,
        href,
        montant,
      });
    }
  }

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
