/**
 * Calcul d'un bulletin de salaire commercial (fiche de paye suisse).
 *
 * Taux repris du bulletin de référence validé par Arthur (indemnités +
 * cotisations sociales + impôt à la source frontalier). Toutes les lignes sont
 * arrondies au centime, comme sur une vraie fiche de paye.
 *
 * Structure :
 *   SALAIRE DE BASE (= prime / commissions du mois)
 *   + Indemnité vacances (8.33 %)
 *   + Indemnité jours fériés (3.00 %)
 *   = BRUT
 *   - Cotisation AVS/AI/APG (5.30 %)
 *   - Contribution CAF (0.131 %)
 *   - Cotisation AC (1.10 %)
 *   - Retenue impôt à la source (5.00 %)
 *   = NET
 *   + Frais de déplacement (forfait, non soumis aux cotisations)
 *   = MONTANT VERSÉ
 */

export const PAYSLIP_RATES = {
  /** Indemnité vacances (% du salaire de base). */
  vacances: 0.0833,
  /** Indemnité jours fériés (% du salaire de base). */
  feries: 0.03,
  /** Cotisation AVS/AI/APG (% du brut). */
  avs: 0.053,
  /** Contribution CAF (% du brut). */
  caf: 0.00131,
  /** Cotisation AC - assurance chômage (% du brut). */
  ac: 0.011,
  /** Retenue impôt à la source (% du brut) - frontalier. */
  impotSource: 0.05,
} as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PayslipInput {
  /** Salaire de base = somme des commissions dues ce mois (prime). */
  baseCommission: number;
  /** Frais de déplacement forfaitaires (non soumis aux cotisations). */
  frais: number;
  /**
   * Taux d'impôt à la source (ratio, ex. 0.05). 0 pour un résident suisse
   * (aucune retenue à la source, ex. le patron). Défaut : 5 % (frontalier).
   */
  impotSourceRate?: number;
}

export interface PayslipLine {
  /** Code genre de salaire (ex. "5010"). */
  gs?: string;
  label: string;
  /** Texte de la colonne « Déterminant » (base de calcul). */
  determinant?: string;
  /** Taux en % affiché (ex. "8.33", "5.30"). */
  taux?: string;
  montant: number;
}

export interface PayslipResult {
  base: number;
  indemniteVacances: number;
  indemniteFeries: number;
  brut: number;
  cotisationAVS: number;
  contributionCAF: number;
  cotisationAC: number;
  impotSource: number;
  totalDeductions: number;
  net: number;
  frais: number;
  montantVerse: number;
  gains: PayslipLine[];
  deductions: PayslipLine[];
}

/** Taux en % avec 2 décimales (ex. 0.053 → "5.30", 0.00131 → "0.131"). */
function pct(r: number): string {
  // La CAF a 3 décimales (0.131 %), les autres 2.
  const v = r * 100;
  return v < 1 ? v.toFixed(3) : v.toFixed(2);
}

export function computePayslip({
  baseCommission,
  frais,
  impotSourceRate = PAYSLIP_RATES.impotSource,
}: PayslipInput): PayslipResult {
  const base = round2(baseCommission);
  const indemniteVacances = round2(base * PAYSLIP_RATES.vacances);
  const indemniteFeries = round2(base * PAYSLIP_RATES.feries);
  const brut = round2(base + indemniteVacances + indemniteFeries);

  const cotisationAVS = round2(brut * PAYSLIP_RATES.avs);
  const contributionCAF = round2(brut * PAYSLIP_RATES.caf);
  const cotisationAC = round2(brut * PAYSLIP_RATES.ac);
  const impotSource = round2(brut * impotSourceRate);
  const totalDeductions = round2(
    cotisationAVS + contributionCAF + cotisationAC + impotSource,
  );

  const net = round2(brut - totalDeductions);
  const fraisR = round2(frais);
  const montantVerse = round2(net + fraisR);

  const gains: PayslipLine[] = [
    { label: "Salaire de base", montant: base },
    {
      label: "Indemnité vacances",
      determinant: base.toFixed(2),
      taux: pct(PAYSLIP_RATES.vacances),
      montant: indemniteVacances,
    },
    {
      label: "Indemnité jours fériés",
      determinant: base.toFixed(2),
      taux: pct(PAYSLIP_RATES.feries),
      montant: indemniteFeries,
    },
  ];

  const deductions: PayslipLine[] = [
    {
      gs: "5010",
      label: "Cotisation AVS/AI/APG",
      determinant: brut.toFixed(2),
      taux: pct(PAYSLIP_RATES.avs),
      montant: -cotisationAVS,
    },
    {
      gs: "5011",
      label: "Contribution CAF",
      determinant: brut.toFixed(2),
      taux: pct(PAYSLIP_RATES.caf),
      montant: -contributionCAF,
    },
    {
      gs: "5020",
      label: "Cotisation AC (chômage)",
      determinant: brut.toFixed(2),
      taux: pct(PAYSLIP_RATES.ac),
      montant: -cotisationAC,
    },
  ];
  // Impôt à la source : uniquement pour les frontaliers (taux > 0). Le patron
  // résident suisse (taux 0) n'a pas de retenue à la source.
  if (impotSourceRate > 0) {
    deductions.push({
      gs: "5060",
      label: "Retenue impôt à la source",
      determinant: brut.toFixed(2),
      taux: pct(impotSourceRate),
      montant: -impotSource,
    });
  }

  return {
    base,
    indemniteVacances,
    indemniteFeries,
    brut,
    cotisationAVS,
    contributionCAF,
    cotisationAC,
    impotSource,
    totalDeductions,
    net,
    frais: fraisR,
    montantVerse,
    gains,
    deductions,
  };
}

/** Libellé détaillé du type de versement d'une commission (page 2). */
export function payslipLineLabel(
  typePart: string,
  numeroMois: number | null,
): string {
  switch (typePart) {
    case "SIGNATURE":
      return "1er versement - 50 % de la commission (acompte signature)";
    case "ETALEMENT":
      return numeroMois
        ? `Étalement - solde des 50 % (mois ${numeroMois})`
        : "Étalement - solde des 50 %";
    case "RENOUVELLEMENT":
      return "Renouvellement - 10 % du mensuel récurrent";
    default:
      return typePart;
  }
}
