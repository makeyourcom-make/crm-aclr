/**
 * Requêtes pour le Dashboard (étape 16).
 */
import { prisma } from "@/lib/db";
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
  /** = MAX(commissions du mois, garantie) + frais */
  salairePrevuMois: number;
  garantieActiveMois: boolean;

  // Objectifs du mois (étape 20)
  monthlyProgress: MonthlyObjectiveProgress;

  // Évolution 12 mois (CA signé par mois — somme valeurAn1 des contrats signés)
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
}

/** Valeur TOTALE d'un contrat sur sa durée réelle : one-shot + mensuel × durée.
 *  Contrairement à `valeurAn1` (plafonnée à 12 mois), reflète la vraie valeur
 *  d'un contrat pluriannuel — utilisée pour le CA agence et le CA annuel. */
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
    // 1. Signatures ce mois (valeur TOTALE, pas an 1)
    prisma.contract.findMany({
      where: {
        ...scopeContract,
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
    // 4. Évolution 12 mois (CA signé par mois — valeur TOTALE des contrats)
    prisma.contract.findMany({
      where: { ...scopeContract, dateSignature: { gte: start12 } },
      select: {
        dateSignature: true,
        montantOneShot: true,
        montantMensuel: true,
        dureeMois: true,
      },
    }),
    // 5. Pipeline résumé
    prisma.deal.groupBy({
      by: ["stage"],
      where: scopeDeal,
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
  const salairePrevuMois = Math.max(comMois, garantieMensuelle) + forfaitFrais;
  const garantieActiveMois = comMois < garantieMensuelle;

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
  // Évolution 12 mois — agrégation in-memory du résultat de la query 4
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

  // Pipeline résumé — agrégé du résultat de la query 5
  const stages = ["DECOUVERTE", "PROPOSITION", "NEGOCIATION", "SIGNE", "PERDU"];
  const pipelineParStage = stages.map((s) => {
    const found = dealsAggregated.find((d) => d.stage === s);
    return {
      stage: s,
      count: found?._count ?? 0,
      montant: Number(found?._sum.montantPrevu ?? 0),
    };
  });

  // Top deals — calcul du résultat de la query 6
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

  // Renouvellements à venir — calcul du résultat de la query 7
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
    const [allComMois, allActiveContracts, sigsAValider, annualCourant, annualPrecedent] =
      await Promise.all([
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
          where: { dateSignature: { gte: yearStart, lte: now } },
          select: { montantOneShot: true, montantMensuel: true, dureeMois: true },
        }),
        prisma.contract.findMany({
          where: { dateSignature: { gte: prevYearStart, lte: prevYearSameDate } },
          select: { montantOneShot: true, montantMensuel: true, dureeMois: true },
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
      commercialeName: s.contract.assigneA?.name ?? "—",
    }));
  }

  return {
    signaturesMois: {
      count: signaturesMoisCount,
      montant: signaturesMoisMontant,
    },
    commissionsAcquisesMois: comMois,
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
  };
}

// ---------------------------------------------------------------------------
// HELPER — Progression objectifs du mois
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
        date: { gte: startMonth, lte: endMonth },
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
