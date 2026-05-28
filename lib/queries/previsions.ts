/**
 * Prévisions salaire & commission (étape 22).
 *
 * Combine pour chaque mois sur N mois à venir :
 *   - CommissionPayment PREVU (étalements + renouvellements)
 *   - Garantie absorbable (si total < garantieMensuelle)
 *   - Forfait frais
 * = salaire estimé par mois
 */
import { prisma } from "@/lib/db";
import { type SessionUser } from "@/lib/session";

export interface ForecastMonth {
  mois: Date;
  label: string;
  commissionsEtalement: number;
  commissionsRenouvellement: number;
  totalCommissions: number;
  garantieAbsorbee: number;
  forfaitFrais: number;
  total: number;
  garantieActive: boolean;
}

export interface PortfolioItem {
  contractId: string;
  numero: string;
  raisonSociale: string;
  montantMensuel: number;
  commissionMensuelle: number;
  dateRenouvellementProchain: Date;
}

export interface PipelinePondereItem {
  dealId: string;
  titre: string;
  raisonSociale: string;
  montantPrevu: number;
  probabilite: number;
  montantPondere: number;
  commissionPotentielle: number;
}

export interface ForecastData {
  mois12: ForecastMonth[];
  totalAnnuel: number;
  portfolio: PortfolioItem[];
  portfolioMensuelTotal: number;
  pipelinePondere: PipelinePondereItem[];
  pipelinePondereTotal: number;
  commissionPipelinePotentielle: number;
  // Objectif annuel
  objectifAnnuel?: number;
  realiseYTD: number;
}

export async function getForecast(user: SessionUser): Promise<ForecastData> {
  // Cibler l'utilisateur (admin = lui-même par défaut)
  const userId = user.id;

  const userFull = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      garantieMensuelle: true,
      forfaitFrais: true,
      tauxCommissionSignature: true,
      tauxCommissionRenouvellement: true,
    },
  });
  const garantie = Number(userFull?.garantieMensuelle ?? 2500);
  const forfait = Number(userFull?.forfaitFrais ?? 250);
  const tauxRenouv = Number(userFull?.tauxCommissionRenouvellement ?? 0.1);

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const end12 = new Date(now.getFullYear(), now.getMonth() + 12, 0, 23, 59, 59);

  // 1. CommissionPayment PREVU + PAYE des 12 prochains mois
  const payments = await prisma.commissionPayment.findMany({
    where: {
      commission: { userId },
      dateVersementPrevue: { gte: startMonth, lte: end12 },
      statut: { in: ["PREVU", "PAYE"] },
    },
    select: {
      montant: true,
      typePart: true,
      dateVersementPrevue: true,
      statut: true,
    },
  });

  // Group par mois
  const mois12: ForecastMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + i + 1,
      0,
      23,
      59,
      59,
    );
    let etalement = 0;
    let renouv = 0;
    for (const p of payments) {
      if (
        p.dateVersementPrevue >= monthStart &&
        p.dateVersementPrevue <= monthEnd
      ) {
        const m = Number(p.montant);
        if (p.typePart === "ETALEMENT" || p.typePart === "SIGNATURE") {
          etalement += m;
        } else if (p.typePart === "RENOUVELLEMENT") {
          renouv += m;
        }
      }
    }
    const totalCommissions = etalement + renouv;
    const garantieAbsorbee = Math.max(0, garantie - totalCommissions);
    const total = Math.max(totalCommissions, garantie) + forfait;
    mois12.push({
      mois: monthStart,
      label: monthStart
        .toLocaleDateString("fr-CH", { month: "short", year: "2-digit" })
        .replace(".", ""),
      commissionsEtalement: etalement,
      commissionsRenouvellement: renouv,
      totalCommissions,
      garantieAbsorbee,
      forfaitFrais: forfait,
      total,
      garantieActive: garantieAbsorbee > 0,
    });
  }
  const totalAnnuel = mois12.reduce((s, m) => s + m.total, 0);

  // 2. Portfolio récurrent (contrats actifs avec mensuel)
  const contracts = await prisma.contract.findMany({
    where: { assigneAId: userId, statut: "ACTIF", montantMensuel: { gt: 0 } },
    select: {
      id: true,
      numero: true,
      montantMensuel: true,
      dateSignature: true,
      prospect: { select: { raisonSociale: true } },
    },
  });
  const portfolio: PortfolioItem[] = contracts.map((c) => {
    const next = new Date(c.dateSignature);
    while (next <= now) next.setFullYear(next.getFullYear() + 1);
    return {
      contractId: c.id,
      numero: c.numero,
      raisonSociale: c.prospect.raisonSociale,
      montantMensuel: Number(c.montantMensuel),
      commissionMensuelle: Number(c.montantMensuel) * tauxRenouv,
      dateRenouvellementProchain: next,
    };
  });
  const portfolioMensuelTotal = portfolio.reduce(
    (s, p) => s + p.commissionMensuelle,
    0,
  );

  // 3. Pipeline pondéré
  const deals = await prisma.deal.findMany({
    where: {
      assigneAId: userId,
      stage: { in: ["PROPOSITION", "NEGOCIATION"] },
    },
    select: {
      id: true,
      titre: true,
      montantPrevu: true,
      probabilite: true,
      prospect: { select: { raisonSociale: true } },
    },
  });
  const tauxSig = Number(userFull?.tauxCommissionSignature ?? 0.25);
  const pipelinePondere: PipelinePondereItem[] = deals
    .map((d) => {
      const pondere = (Number(d.montantPrevu) * d.probabilite) / 100;
      return {
        dealId: d.id,
        titre: d.titre,
        raisonSociale: d.prospect.raisonSociale,
        montantPrevu: Number(d.montantPrevu),
        probabilite: d.probabilite,
        montantPondere: pondere,
        commissionPotentielle: pondere * tauxSig,
      };
    })
    .sort((a, b) => b.montantPondere - a.montantPondere);

  const pipelinePondereTotal = pipelinePondere.reduce(
    (s, d) => s + d.montantPondere,
    0,
  );
  const commissionPipelinePotentielle = pipelinePondere.reduce(
    (s, d) => s + d.commissionPotentielle,
    0,
  );

  // 4. Objectif annuel + YTD
  const startYear = new Date(now.getFullYear(), 0, 1);
  const objectif = await prisma.objective.findFirst({
    where: { userId, periode: "ANNUEL", isActif: true, dateDebut: { lte: now }, dateFin: { gte: now } },
    select: { commissionObjectif: true },
  });
  const realiseYTDAgg = await prisma.commissionPayment.aggregate({
    where: {
      commission: { userId },
      statut: "PAYE",
      dateVersement: { gte: startYear },
    },
    _sum: { montant: true },
  });

  return {
    mois12,
    totalAnnuel,
    portfolio,
    portfolioMensuelTotal,
    pipelinePondere,
    pipelinePondereTotal,
    commissionPipelinePotentielle,
    objectifAnnuel: objectif?.commissionObjectif
      ? Number(objectif.commissionObjectif)
      : undefined,
    realiseYTD: Number(realiseYTDAgg._sum.montant ?? 0),
  };
}
