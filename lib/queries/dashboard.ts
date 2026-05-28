/**
 * Requêtes pour le Dashboard (étape 16).
 */
import { prisma } from "@/lib/db";
import { type SessionUser } from "@/lib/session";

export interface DashboardData {
  // KPI du mois
  signaturesMois: { count: number; montant: number };
  commissionsAcquisesMois: number;
  /** = MAX(commissions du mois, garantie) + frais */
  salairePrevuMois: number;
  garantieActiveMois: boolean;

  // Évolution 12 mois (commissions acquises par mois)
  evolutionCommissions: Array<{ label: string; montant: number }>;

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

  // Renouvellements à venir (60 jours)
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

  // 4. Évolution 12 mois en arrière (en passant par groupBy mois)
  const start12 = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const allPaye = await prisma.commissionPayment.findMany({
    where: {
      ...scopeCommission,
      statut: "PAYE",
      dateVersement: { gte: start12 },
    },
    select: { dateVersement: true, montant: true },
  });
  const monthMap = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthMap.set(key, 0);
  }
  for (const p of allPaye) {
    if (!p.dateVersement) continue;
    const key = `${p.dateVersement.getFullYear()}-${p.dateVersement.getMonth()}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + Number(p.montant));
  }
  const evolutionCommissions: DashboardData["evolutionCommissions"] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    evolutionCommissions.push({
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

  // 7. Renouvellements à venir 60 jours (anniversaires de contrats actifs)
  const in60Days = new Date(now);
  in60Days.setDate(in60Days.getDate() + 60);
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
    .filter((r) => r.dateAnniversaire <= in60Days)
    .sort((a, b) => a.dateAnniversaire.getTime() - b.dateAnniversaire.getTime());

  // 8. Vue admin
  let caAgenceMois: number | undefined;
  let montantAVerserCommerciales: number | undefined;
  let caRecurrentTotalMensuel: number | undefined;

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
  }

  return {
    signaturesMois: {
      count: signaturesMoisRaw._count,
      montant: Number(signaturesMoisRaw._sum.valeurAn1 ?? 0),
    },
    commissionsAcquisesMois: comMois,
    salairePrevuMois,
    garantieActiveMois,
    evolutionCommissions,
    pipelineParStage,
    topDeals,
    renouvellementsAVenir,
    caAgenceMois,
    montantAVerserCommerciales,
    caRecurrentTotalMensuel,
  };
}
