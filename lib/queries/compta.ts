/**
 * Comptabilité — P&L (Profit & Loss) mois par mois.
 *
 * Calcule pour chaque mois :
 *   - CA facturé   = ClientInvoice avec dateEmission dans le mois
 *                    (= revenue accrual basis, ce qu'on facture au client)
 *   - CA encaissé  = ClientInvoice PAYEE dont la date de paiement effective
 *                    tombe dans le mois (= revenue cash basis)
 *   - Charges      = Expense (TTC) dans le mois
 *   - Salaires     = Invoice (factures Sophie) montantTotal dans le mois
 *                    + salaireBase des employés non-commerciaux actifs
 *   - Marge réelle = encaissé - charges - salaires (vision trésorerie)
 *   - Marge proj.  = facturé  - charges - salaires (vision comptable)
 *
 * Pour les mois futurs :
 *   - CA facturé   = factures déjà émises pour les mois à venir (contrats
 *                    récurrents auto-facturés à l'avance)
 *   - Charges      = projection = moyenne des 6 derniers mois (info)
 *   - Salaires     = projection garantie+frais+salaireBase théorique
 *
 * Tout est en CHF, en valeurs TTC (vision trésorerie nette hors impôts).
 */
import { prisma } from "@/lib/db";

export interface MonthlyPnL {
  /** 1er du mois (YYYY-MM-01 00:00:00). */
  monthStart: Date;
  /** Étiquette courte "mai 26". */
  label: string;
  /** Mois passé / en cours / futur. */
  phase: "past" | "current" | "future";

  // Revenue
  caFacture: number;
  caEncaisse: number;

  // Coûts
  charges: number;
  salaires: number;

  // Marges
  /** caEncaisse - charges - salaires (cash basis, "argent dispo"). */
  margeReelle: number;
  /** caFacture - charges - salaires (accrual basis, vision comptable). */
  margeProjetee: number;
}

export interface ComptaCockpit {
  months: MonthlyPnL[];
  totals: {
    caFactureYTD: number;
    caEncaisseYTD: number;
    chargesYTD: number;
    salairesYTD: number;
    margeReelleYTD: number;
    margeProjeteeYTD: number;
  };
  /** Moyennes des 6 derniers mois — utilisées pour projeter les mois à venir. */
  averages: {
    chargesMoyennes6m: number;
    salairesMoyens6m: number;
  };
}

/**
 * Renvoie la grille P&L sur les `monthsBack` mois passés + le mois en cours
 * + `monthsForward` mois projetés.
 */
export async function getComptaCockpit(
  monthsBack: number,
  monthsForward: number,
): Promise<ComptaCockpit> {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  // Période totale à analyser
  const rangeStart = new Date(currentMonthStart);
  rangeStart.setMonth(rangeStart.getMonth() - monthsBack);
  const rangeEnd = new Date(currentMonthStart);
  rangeEnd.setMonth(rangeEnd.getMonth() + monthsForward + 1); // inclus

  // --------------------------------------------------------------------
  // Chargements de masse (1 requête par dataset, on agrège ensuite en JS)
  // --------------------------------------------------------------------
  const [
    clientInvoices,
    expenses,
    salaryInvoices,
    activeNonCommercials,
  ] = await Promise.all([
    // Factures clients sur la fenêtre
    prisma.clientInvoice.findMany({
      where: {
        dateEmission: { gte: rangeStart, lt: rangeEnd },
      },
      select: {
        dateEmission: true,
        statut: true,
        total: true,
        // Payment pour avoir la date d'encaissement réelle
        payments: {
          where: { statut: "ENCAISSE" },
          select: { date: true, montant: true },
          orderBy: { date: "asc" },
          take: 1,
        },
      },
    }),
    // Charges (expenses)
    prisma.expense.findMany({
      where: { date: { gte: rangeStart, lt: rangeEnd } },
      select: { date: true, montantTTC: true },
    }),
    // Salaires versés (Invoice = facture mensuelle commerciale)
    prisma.invoice.findMany({
      where: { mois: { gte: rangeStart, lt: rangeEnd } },
      select: { mois: true, montantTotal: true },
    }),
    // Pour la projection des salaires : tous les actifs (commerciaux + autres)
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        role: true,
        garantieMensuelle: true,
        forfaitFrais: true,
        salaireBase: true,
      },
    }),
  ]);

  // Construit le squelette des mois
  const monthMap = new Map<string, MonthlyPnL>();
  const total = monthsBack + monthsForward + 1;
  for (let i = 0; i < total; i++) {
    const d = new Date(currentMonthStart);
    d.setMonth(d.getMonth() + (i - monthsBack));
    const key = monthKey(d);
    const phase: MonthlyPnL["phase"] =
      d.getTime() === currentMonthStart.getTime()
        ? "current"
        : d.getTime() < currentMonthStart.getTime()
          ? "past"
          : "future";
    monthMap.set(key, {
      monthStart: d,
      label: d
        .toLocaleDateString("fr-CH", { month: "short", year: "2-digit" })
        .replace(/\./g, ""),
      phase,
      caFacture: 0,
      caEncaisse: 0,
      charges: 0,
      salaires: 0,
      margeReelle: 0,
      margeProjetee: 0,
    });
  }

  // ----- CA facturé (basé sur dateEmission)
  for (const inv of clientInvoices) {
    const key = monthKey(inv.dateEmission);
    const slot = monthMap.get(key);
    if (slot) slot.caFacture += Number(inv.total);
  }

  // ----- CA encaissé (basé sur date du Payment ENCAISSE, fallback dateEmission)
  for (const inv of clientInvoices) {
    if (inv.statut !== "PAYEE") continue;
    const dateEnc = inv.payments[0]?.date ?? inv.dateEmission;
    const key = monthKey(dateEnc);
    const slot = monthMap.get(key);
    if (slot) slot.caEncaisse += Number(inv.total);
  }

  // ----- Charges (TTC pour vision trésorerie)
  for (const e of expenses) {
    const key = monthKey(e.date);
    const slot = monthMap.get(key);
    if (slot) slot.charges += Number(e.montantTTC);
  }

  // ----- Salaires effectivement émis (Invoice commerciale)
  for (const inv of salaryInvoices) {
    const key = monthKey(inv.mois);
    const slot = monthMap.get(key);
    if (slot) slot.salaires += Number(inv.montantTotal);
  }

  // ----- Calcul des moyennes 6 mois passés (pour projection)
  const months = [...monthMap.values()].sort(
    (a, b) => a.monthStart.getTime() - b.monthStart.getTime(),
  );
  const past6 = months
    .filter((m) => m.phase === "past")
    .slice(-6);
  const chargesMoyennes6m =
    past6.length > 0
      ? past6.reduce((s, m) => s + m.charges, 0) / past6.length
      : 0;
  const salairesMoyens6m =
    past6.length > 0
      ? past6.reduce((s, m) => s + m.salaires, 0) / past6.length
      : 0;

  // ----- Projection des mois futurs
  // CA : on garde les factures déjà émises pour des mois futurs (récurrents)
  // Charges : moyenne des 6 mois passés (si rien d'autre)
  // Salaires : projection théorique (garantie + frais pour commerciaux,
  //            salaireBase pour autres)
  let salaireProjete = 0;
  for (const u of activeNonCommercials) {
    if (u.role === "COMMERCIAL") {
      // commercial : on minimum garantie + frais (perf en plus n'est pas projetée
      // par défaut, car incertaine ; vue conservatrice)
      salaireProjete +=
        Number(u.garantieMensuelle) + Number(u.forfaitFrais);
    } else {
      salaireProjete += Number(u.salaireBase ?? 0);
    }
  }

  for (const m of months) {
    if (m.phase === "future") {
      if (m.charges === 0) m.charges = chargesMoyennes6m;
      if (m.salaires === 0) m.salaires = salaireProjete;
    }
    // Calcul des marges
    m.margeReelle = m.caEncaisse - m.charges - m.salaires;
    m.margeProjetee = m.caFacture - m.charges - m.salaires;
  }

  // ----- Totaux YTD (year-to-date, du 1er janvier au mois en cours inclus)
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const ytdMonths = months.filter(
    (m) =>
      m.monthStart >= startOfYear &&
      m.monthStart <= currentMonthStart &&
      (m.phase === "past" || m.phase === "current"),
  );
  const totals = {
    caFactureYTD: ytdMonths.reduce((s, m) => s + m.caFacture, 0),
    caEncaisseYTD: ytdMonths.reduce((s, m) => s + m.caEncaisse, 0),
    chargesYTD: ytdMonths.reduce((s, m) => s + m.charges, 0),
    salairesYTD: ytdMonths.reduce((s, m) => s + m.salaires, 0),
    margeReelleYTD: ytdMonths.reduce((s, m) => s + m.margeReelle, 0),
    margeProjeteeYTD: ytdMonths.reduce((s, m) => s + m.margeProjetee, 0),
  };

  return {
    months,
    totals,
    averages: { chargesMoyennes6m, salairesMoyens6m },
  };
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}
