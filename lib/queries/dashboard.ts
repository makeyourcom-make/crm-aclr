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

export async function getDashboard(user: SessionUser): Promise<DashboardData> {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const scopeContract =
    user.role === "ADMIN" ? {} : { assigneAId: user.id };
  const scopeCommission =
    user.role === "ADMIN" ? {} : { commission: { userId: user.id } };
  const scopeDeal = user.role === "ADMIN" ? {} : { assigneAId: user.id };

  // 1. Signatures ce mois
  const signaturesMoisRaw = await prisma.contract.aggregate({
    where: {
      ...scopeContract,
      dateSignature: { gte: startMonth, lte: endMonth },
    },
    _count: true,
    _sum: { valeurAn1: true },
  });

  // 2. Commissions acquises ce mois
  const comAcquisesMois = await prisma.commissionPayment.aggregate({
    where: {
      ...scopeCommission,
      statut: "PAYE",
      dateVersement: { gte: startMonth, lte: endMonth },
    },
    _sum: { montant: true },
  });

  // 3. Charge le user pour garantie/frais
  let garantieMensuelle = 2500;
  let forfaitFrais = 250;
  if (user.role !== "ADMIN") {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { garantieMensuelle: true, forfaitFrais: true },
    });
    if (u) {
      garantieMensuelle = Number(u.garantieMensuelle);
      forfaitFrais = Number(u.forfaitFrais);
    }
  }
  const comMois = Number(comAcquisesMois._sum.montant ?? 0);
  const salairePrevuMois = Math.max(comMois, garantieMensuelle) + forfaitFrais;
  const garantieActiveMois = comMois < garantieMensuelle;

  // 3.b Objectif mensuel actif (pour la commerciale ou le user filtré admin)
  const monthlyProgress = await computeMonthlyProgress(
    user,
    startMonth,
    endMonth,
    signaturesMoisRaw,
  );

  // 4. Évolution 12 mois en arrière — CA signé (somme valeurAn1 par mois de signature)
  const start12 = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const contractsLast12 = await prisma.contract.findMany({
    where: {
      ...scopeContract,
      dateSignature: { gte: start12 },
    },
    select: { dateSignature: true, valeurAn1: true },
  });
  const monthMap = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthMap.set(key, 0);
  }
  for (const c of contractsLast12) {
    if (!c.dateSignature) continue;
    const key = `${c.dateSignature.getFullYear()}-${c.dateSignature.getMonth()}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + Number(c.valeurAn1));
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

  // 5. Pipeline résumé
  const dealsAggregated = await prisma.deal.groupBy({
    by: ["stage"],
    where: scopeDeal,
    _count: true,
    _sum: { montantPrevu: true },
  });
  const stages = ["DECOUVERTE", "PROPOSITION", "NEGOCIATION", "SIGNE", "PERDU"];
  const pipelineParStage = stages.map((s) => {
    const found = dealsAggregated.find((d) => d.stage === s);
    return {
      stage: s,
      count: found?._count ?? 0,
      montant: Number(found?._sum.montantPrevu ?? 0),
    };
  });

  // 6. Top deals chauds (Proposition + Négociation, triés par montant pondéré)
  const hotDeals = await prisma.deal.findMany({
    where: {
      ...scopeDeal,
      stage: { in: ["PROPOSITION", "NEGOCIATION"] },
    },
    include: {
      prospect: { select: { raisonSociale: true } },
    },
  });
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

  // 7. Renouvellements à venir 90 jours (anniversaires de contrats actifs)
  // Fenêtre alignée sur le préavis de 30 jours des CGV (art. 3.2) +
  // 60 j d'anticipation commerciale → 90 j total.
  const in90Days = new Date(now);
  in90Days.setDate(in90Days.getDate() + 90);
  const contractsForRenewal = await prisma.contract.findMany({
    where: { ...scopeContract, statut: "ACTIF", montantMensuel: { gt: 0 } },
    select: {
      id: true,
      numero: true,
      dateSignature: true,
      montantMensuel: true,
      prospect: { select: { raisonSociale: true } },
      assigneA: { select: { tauxCommissionRenouvellement: true } },
    },
  });
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
  let contratsAValider: DashboardData["contratsAValider"];

  if (user.role === "ADMIN") {
    const allSignaturesMois = await prisma.contract.aggregate({
      where: { dateSignature: { gte: startMonth, lte: endMonth } },
      _sum: { valeurAn1: true },
    });
    caAgenceMois = Number(allSignaturesMois._sum.valeurAn1 ?? 0);

    const allComMois = await prisma.commissionPayment.aggregate({
      where: {
        statut: "PAYE",
        dateVersement: { gte: startMonth, lte: endMonth },
      },
      _sum: { montant: true },
    });
    montantAVerserCommerciales = Number(allComMois._sum.montant ?? 0);

    const allActiveContracts = await prisma.contract.aggregate({
      where: { statut: "ACTIF" },
      _sum: { montantMensuel: true },
    });
    caRecurrentTotalMensuel = Number(allActiveContracts._sum.montantMensuel ?? 0);

    // Contrats signés par le client mais pas encore contre-signés par ACLR
    const sigsAValider = await prisma.signature.findMany({
      where: { signeParClient: true, signeParAclr: false },
      include: {
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
    });
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
      count: signaturesMoisRaw._count,
      montant: Number(signaturesMoisRaw._sum.valeurAn1 ?? 0),
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
    contratsAValider,
  };
}

// ---------------------------------------------------------------------------
// HELPER — Progression objectifs du mois
// ---------------------------------------------------------------------------

async function computeMonthlyProgress(
  user: SessionUser,
  startMonth: Date,
  endMonth: Date,
  signaturesMoisRaw: {
    _count: number;
    _sum: { valeurAn1: import("@prisma/client").Prisma.Decimal | null };
  },
): Promise<MonthlyObjectiveProgress> {
  // L'admin n'a pas d'objectif personnel par défaut (sauf s'il en a fixé un).
  // On cherche son Objective MENSUEL actif qui couvre la date du jour.
  const userId = user.id;

  const objective = await prisma.objective.findFirst({
    where: {
      userId,
      periode: "MENSUEL",
      isActif: true,
      dateDebut: { lte: endMonth },
      dateFin: { gte: startMonth },
    },
    orderBy: { createdAt: "desc" },
  });

  // Activités réalisées ce mois
  const userScope = { userId };

  const [
    nbAppelsRealise,
    nbEmailsRealise,
    nbRsRealise,
    nbRdvRealise,
  ] = await Promise.all([
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
    // L'utilisateur souhaite suivre "contacts" = emails + RS.
    // On utilise le champ nbEmailsObjectif comme objectif "contacts asynchrones".
    nbContactsObjectif: objective?.nbEmailsObjectif ?? null,
    nbRdvObjectif: objective?.nbRdvObjectif ?? null,
    nbSignaturesObjectif: objective?.nbSignaturesObjectif ?? null,
    caObjectif:
      objective?.caObjectif != null ? Number(objective.caObjectif) : null,
    nbAppelsRealise,
    nbContactsRealise: nbEmailsRealise + nbRsRealise,
    nbRdvRealise,
    nbSignaturesRealise: signaturesMoisRaw._count,
    caRealise: Number(signaturesMoisRaw._sum.valeurAn1 ?? 0),
  };
}
