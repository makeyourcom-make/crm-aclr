/**
 * Calcule la rentabilité par client (Prospect) pour une période donnée.
 *
 * Pour chaque prospect ayant au moins un contrat OU une charge associée :
 *   - CA facturé (toutes ClientInvoice émises, sauf BROUILLON/ANNULEE)
 *   - CA encaissé (statut = PAYEE)
 *   - Charges directes (Expense.prospectId === prospect)
 *   - Charges allouées (ExpenseAllocation, multi-clients)
 *   - Marge brute = CA facturé - charges totales
 *   - Marge % = marge / CA facturé
 */
import { prisma } from "@/lib/db";

export interface RentabiliteRow {
  prospectId: string;
  raisonSociale: string;
  statut: string;
  // CA
  caFacture: number;
  caEncaisse: number;
  caEnAttente: number; // facturé non encore encaissé
  nbFactures: number;
  // Charges
  chargesDirectes: number;
  chargesAllouees: number;
  chargesTotal: number;
  nbCharges: number;
  // Marge
  margeBrute: number;
  margePct: number | null; // null si caFacture = 0
}

export interface RentabiliteResult {
  rows: RentabiliteRow[];
  totals: {
    caFacture: number;
    caEncaisse: number;
    chargesTotal: number;
    margeBrute: number;
    margePct: number | null;
  };
  // Charges sans rattachement client (frais généraux)
  chargesInternes: {
    total: number;
    count: number;
  };
  periode: { from: Date; to: Date };
}

export async function getRentabilite(opts?: {
  from?: Date;
  to?: Date;
}): Promise<RentabiliteResult> {
  const now = new Date();
  const from = opts?.from ?? new Date(now.getFullYear(), 0, 1); // YTD par défaut
  const to = opts?.to ?? new Date(now.getFullYear() + 1, 0, 1);

  // 1. Toutes les factures clients de la période, groupées par prospect
  const facturesGrouped = await prisma.clientInvoice.findMany({
    where: {
      dateEmission: { gte: from, lt: to },
      statut: { in: ["ENVOYEE", "PAYEE", "EN_RETARD"] },
    },
    select: {
      total: true,
      statut: true,
      contract: { select: { prospectId: true } },
    },
  });

  // 2. Charges directes par prospect
  const chargesDirectes = await prisma.expense.groupBy({
    by: ["prospectId"],
    where: {
      prospectId: { not: null },
      date: { gte: from, lt: to },
    },
    _sum: { montantTTC: true },
    _count: true,
  });

  // 3. Allocations multi-clients par prospect
  const allocations = await prisma.expenseAllocation.groupBy({
    by: ["prospectId"],
    where: {
      expense: { date: { gte: from, lt: to } },
    },
    _sum: { montantHT: true },
    _count: true,
  });

  // 4. Charges internes (sans prospect + sans allocations) — frais généraux
  const chargesInternesAgg = await prisma.expense.aggregate({
    where: {
      prospectId: null,
      date: { gte: from, lt: to },
      allocations: { none: {} },
    },
    _sum: { montantTTC: true },
    _count: true,
  });

  // 5. Collecte tous les prospectIds impliqués
  const prospectIds = new Set<string>();
  for (const f of facturesGrouped) prospectIds.add(f.contract.prospectId);
  for (const c of chargesDirectes) if (c.prospectId) prospectIds.add(c.prospectId);
  for (const a of allocations) prospectIds.add(a.prospectId);

  if (prospectIds.size === 0) {
    return {
      rows: [],
      totals: { caFacture: 0, caEncaisse: 0, chargesTotal: 0, margeBrute: 0, margePct: null },
      chargesInternes: {
        total: Number(chargesInternesAgg._sum.montantTTC ?? 0),
        count: chargesInternesAgg._count,
      },
      periode: { from, to },
    };
  }

  // 6. Charge les infos prospects
  const prospects = await prisma.prospect.findMany({
    where: { id: { in: Array.from(prospectIds) } },
    select: { id: true, raisonSociale: true, statut: true },
  });
  const prospectMap = new Map(prospects.map((p) => [p.id, p]));

  // 7. Construit les lignes
  const rows: RentabiliteRow[] = [];
  for (const pid of prospectIds) {
    const p = prospectMap.get(pid);
    if (!p) continue;

    const factPid = facturesGrouped.filter((f) => f.contract.prospectId === pid);
    const caFacture = factPid.reduce((s, f) => s + Number(f.total), 0);
    const caEncaisse = factPid
      .filter((f) => f.statut === "PAYEE")
      .reduce((s, f) => s + Number(f.total), 0);
    const caEnAttente = caFacture - caEncaisse;
    const nbFactures = factPid.length;

    const cDir = chargesDirectes.find((c) => c.prospectId === pid);
    const chargesDir = Number(cDir?._sum.montantTTC ?? 0);
    const nbDir = cDir?._count ?? 0;

    const cAlloc = allocations.find((a) => a.prospectId === pid);
    const chargesAlloc = Number(cAlloc?._sum.montantHT ?? 0);
    const nbAlloc = cAlloc?._count ?? 0;

    const chargesTotal = chargesDir + chargesAlloc;
    const margeBrute = caFacture - chargesTotal;
    const margePct = caFacture > 0 ? margeBrute / caFacture : null;

    rows.push({
      prospectId: pid,
      raisonSociale: p.raisonSociale,
      statut: p.statut,
      caFacture,
      caEncaisse,
      caEnAttente,
      nbFactures,
      chargesDirectes: chargesDir,
      chargesAllouees: chargesAlloc,
      chargesTotal,
      nbCharges: nbDir + nbAlloc,
      margeBrute,
      margePct,
    });
  }

  // 8. Trie par CA décroissant
  rows.sort((a, b) => b.caFacture - a.caFacture);

  // 9. Totaux
  const totalCaFacture = rows.reduce((s, r) => s + r.caFacture, 0);
  const totalCaEncaisse = rows.reduce((s, r) => s + r.caEncaisse, 0);
  const totalCharges = rows.reduce((s, r) => s + r.chargesTotal, 0);
  const totalMarge = totalCaFacture - totalCharges;

  return {
    rows,
    totals: {
      caFacture: totalCaFacture,
      caEncaisse: totalCaEncaisse,
      chargesTotal: totalCharges,
      margeBrute: totalMarge,
      margePct: totalCaFacture > 0 ? totalMarge / totalCaFacture : null,
    },
    chargesInternes: {
      total: Number(chargesInternesAgg._sum.montantTTC ?? 0),
      count: chargesInternesAgg._count,
    },
    periode: { from, to },
  };
}
