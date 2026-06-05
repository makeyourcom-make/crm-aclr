/**
 * Moteur de calcul des commissions — fonctions pures, sans DB.
 *
 * ZONE ZÉRO BUG TOLÉRÉ.
 *
 * Stratégie : tous les montants sont manipulés en **centimes** (entiers) en
 * interne. On convertit aux frontières seulement. Ainsi 0.1 + 0.2 = 0.3
 * (exactement), et les divisions par 11 ne génèrent jamais de centime perdu.
 *
 * Convention :
 *   - chf : nombre en CHF (peut avoir 2 décimales)
 *   - cents : entier (CHF * 100)
 *   - taux : ratio entre 0 et 1 (ex. 0.25 pour 25 %)
 *
 * Règles métier implémentées (cf docs/Prompt_Claude_Code_CRM_MYC.md) :
 *   1. Commission signature  : 25 % de la valeur an 1
 *   2. Versement              : 50 % à la signature + 50 % étalé sur 11 mois
 *   3. Commission renouvel.   : 10 % du mensuel, versé chaque mois (an 2+)
 *   4. Résiliation anticipée : les versements PREVU → ANNULE, PAYE reste acquis
 *   5. Garantie absorbable   : si commissions < seuil → ACLR complète
 *   6. Facture commerciale    : MAX(commissions, garantie) + forfait frais
 */

import {
  COMMISSION_SIGNATURE_NB_MOIS_ETALEMENT,
  COMMISSION_SIGNATURE_PART_INITIALE_DENOMINATEUR,
  FORFAIT_FRAIS_MENSUEL_DEFAULT_CHF,
  GARANTIE_MENSUELLE_DEFAULT_CHF,
  TAUX_COMMISSION_RENOUVELLEMENT_DEFAULT,
  TAUX_COMMISSION_SIGNATURE_DEFAULT,
} from "./constants";

// ===========================================================================
// CONVERSIONS CHF ↔ CENTIMES
// ===========================================================================

export type Cents = number;

/** Convertit un montant en CHF vers les centimes (arrondi à l'entier le plus proche). */
export function chfToCents(chf: number): Cents {
  if (!Number.isFinite(chf)) {
    throw new RangeError(`Montant CHF invalide : ${chf}`);
  }
  return Math.round(chf * 100);
}

/** Convertit des centimes vers CHF. */
export function centsToChf(cents: Cents): number {
  if (!Number.isInteger(cents)) {
    throw new RangeError(`Centimes doivent être entiers : ${cents}`);
  }
  return cents / 100;
}

// ===========================================================================
// 1. CALCUL COMMISSION SIGNATURE
// ===========================================================================

export interface CommissionSignatureInput {
  /** Valeur an 1 du contrat en cents (= oneShot + mensuel * 12) */
  valeurAn1Cents: Cents;
  /** Taux de commission (0.25 par défaut) */
  taux?: number;
}

export interface CommissionSignatureResult {
  /** Montant total dû au commercial (cents) */
  totalCents: Cents;
  /** Part versée à la signature (moitié du total) */
  partSignatureCents: Cents;
  /** Total cumulé des 11 versements mensuels (l'autre moitié) */
  totalEtalementsCents: Cents;
  /** Détail des 11 versements mensuels (le 11e absorbe l'éventuel reste de division) */
  etalementsCents: Cents[];
}

/**
 * Calcule la commission de signature et son plan de versement.
 *
 * - Le total est arrondi au centime le plus proche
 * - La part signature = floor(total / 2) — le 11e étalement absorbe le reste
 * - Cela garantit que partSignature + sum(etalements) === total exactement
 *
 * @example
 *   computeCommissionSignature({ valeurAn1Cents: 500000, taux: 0.25 })
 *   // valeurAn1 = 5000 CHF, commission = 1250 CHF
 *   // → totalCents: 125000
 *   //   partSignatureCents: 62500 (= 625 CHF)
 *   //   etalementsCents: [5681, 5681, 5681, 5681, 5681, 5681, 5681, 5681, 5681, 5681, 5691]
 *   //                    (= 56.81 × 10 + 56.91 = 625 CHF)
 */
export function computeCommissionSignature(
  input: CommissionSignatureInput,
): CommissionSignatureResult {
  const taux = input.taux ?? TAUX_COMMISSION_SIGNATURE_DEFAULT;

  if (input.valeurAn1Cents < 0) {
    throw new RangeError(`valeurAn1Cents doit être ≥ 0`);
  }
  if (taux < 0 || taux > 1) {
    throw new RangeError(`taux doit être entre 0 et 1 (reçu ${taux})`);
  }

  const totalCents = Math.round(input.valeurAn1Cents * taux);

  const partSignatureCents = Math.floor(
    totalCents / COMMISSION_SIGNATURE_PART_INITIALE_DENOMINATEUR,
  );
  const totalEtalementsCents = totalCents - partSignatureCents;

  // Répartit totalEtalementsCents en 11 parts égales ; le dernier mois absorbe le reste.
  const n = COMMISSION_SIGNATURE_NB_MOIS_ETALEMENT;
  const partBase = Math.floor(totalEtalementsCents / n);
  const etalementsCents: Cents[] = Array(n).fill(partBase);
  const reste = totalEtalementsCents - partBase * n;
  etalementsCents[n - 1] += reste;

  return {
    totalCents,
    partSignatureCents,
    totalEtalementsCents,
    etalementsCents,
  };
}

// ===========================================================================
// 2. PLAN DE VERSEMENT — génération des 12 CommissionPayment
// ===========================================================================

export interface PlanSignatureItem {
  numeroMois: number | null; // null pour SIGNATURE, 1..11 pour ETALEMENT
  typePart: "SIGNATURE" | "ETALEMENT";
  montantCents: Cents;
  /** Date où ce versement doit tomber (planifié) */
  dateVersementPrevue: Date;
}

/**
 * Construit le plan de versement complet d'une commission signature.
 *
 * - 1 paiement SIGNATURE à la date de signature
 * - 11 paiements ETALEMENT, un par mois, au même jour du mois que la signature
 *
 * Important : si le jour de signature n'existe pas dans le mois cible (ex.
 * signature le 31, mois cible février), date-fns `addMonths` ramène au dernier
 * jour du mois — comportement standard et acceptable côté métier.
 */
export function buildSignaturePaymentPlan(
  input: CommissionSignatureInput & { dateSignature: Date },
): PlanSignatureItem[] {
  const calc = computeCommissionSignature(input);
  const plan: PlanSignatureItem[] = [
    {
      numeroMois: null,
      typePart: "SIGNATURE",
      montantCents: calc.partSignatureCents,
      dateVersementPrevue: input.dateSignature,
    },
  ];
  for (let i = 0; i < calc.etalementsCents.length; i++) {
    plan.push({
      numeroMois: i + 1,
      typePart: "ETALEMENT",
      montantCents: calc.etalementsCents[i],
      dateVersementPrevue: addMonthsKeepEndOfMonth(input.dateSignature, i + 1),
    });
  }
  return plan;
}

// ===========================================================================
// 3. COMMISSION RENOUVELLEMENT (an 2+)
// ===========================================================================

export interface RenewalCommissionInput {
  /** Montant mensuel récurrent du contrat (cents) */
  montantMensuelCents: Cents;
  /** Taux de commission renouvellement (0.10 par défaut) */
  taux?: number;
}

export interface PlanRenewalItem {
  /** Mois du versement (1..12 pour l'an 2) */
  numeroMois: number;
  montantCents: Cents;
  dateVersementPrevue: Date;
}

/**
 * Calcule le montant mensuel de commission renouvellement.
 */
export function computeRenewalMonthly(
  input: RenewalCommissionInput,
): Cents {
  const taux = input.taux ?? TAUX_COMMISSION_RENOUVELLEMENT_DEFAULT;
  if (input.montantMensuelCents < 0)
    throw new RangeError("montantMensuelCents ≥ 0");
  if (taux < 0 || taux > 1) throw new RangeError("taux entre 0 et 1");
  return Math.round(input.montantMensuelCents * taux);
}

/**
 * Construit le plan des 12 versements mensuels de commission renouvellement
 * pour la 2ème année d'un contrat reconduit.
 *
 * @param dateRenouvellement Date d'anniversaire du contrat (= début an 2)
 */
export function buildRenewalPaymentPlan(
  input: RenewalCommissionInput & { dateRenouvellement: Date },
): PlanRenewalItem[] {
  const montantMensuelCommissionCents = computeRenewalMonthly(input);
  const plan: PlanRenewalItem[] = [];
  for (let i = 0; i < 12; i++) {
    plan.push({
      numeroMois: i + 1,
      montantCents: montantMensuelCommissionCents,
      dateVersementPrevue: addMonthsKeepEndOfMonth(
        input.dateRenouvellement,
        i,
      ),
    });
  }
  return plan;
}

// ===========================================================================
// 4. RÉSILIATION ANTICIPÉE
// ===========================================================================

export interface CommissionPaymentSnapshot {
  id: string;
  statut: "PREVU" | "PAYE" | "ANNULE";
  dateVersementPrevue: Date;
}

export interface ResiliationResult {
  /** IDs des versements à annuler (étaient PREVU, deviennent ANNULE) */
  aAnnuler: string[];
  /** IDs des versements à laisser tels quels (déjà PAYE ou ANNULE) */
  intacts: string[];
}

/**
 * Détermine quels versements de commission annuler en cas de résiliation
 * anticipée. La règle : tous les PREVU passent à ANNULE, PAYE reste acquis.
 *
 * On ne tient PAS compte de la date du paiement : un PREVU dans le passé
 * (ex. retard de versement) est aussi annulé puisque la résiliation rompt
 * tout droit futur du commercial sur ce contrat.
 */
export function applyResiliation(
  payments: CommissionPaymentSnapshot[],
): ResiliationResult {
  const aAnnuler: string[] = [];
  const intacts: string[] = [];
  for (const p of payments) {
    if (p.statut === "PREVU") {
      aAnnuler.push(p.id);
    } else {
      intacts.push(p.id);
    }
  }
  return { aAnnuler, intacts };
}

// ===========================================================================
// 5. GARANTIE ABSORBABLE + FACTURE MENSUELLE COMMERCIALE
// ===========================================================================

export interface MonthlyInvoiceInput {
  /** Total des commissions PAYE du mois pour cette commerciale (cents) */
  commissionsEncaisseesCents: Cents;
  /** Garantie mensuelle de la commerciale (cents) — default 2'500 CHF */
  garantieMensuelleCents?: Cents;
  /** Forfait frais ajouté à toute facture (cents) — default 250 CHF */
  forfaitFraisCents?: Cents;
}

export interface MonthlyInvoiceResult {
  commissionsCents: Cents;
  garantieAbsorbeeCents: Cents;
  fraisCents: Cents;
  totalCents: Cents;
  /** true si la garantie a effectivement complété le manque */
  garantieActivee: boolean;
}

/**
 * Calcule la facture mensuelle interne d'une commerciale.
 *
 * Règles (cf spec, "Garantie absorbable") :
 *   - Si commissions < garantie  → ACLR complète jusqu'à la garantie
 *   - Total = MAX(commissions, garantie) + forfait frais
 *   - garantieAbsorbeeCents = MAX(0, garantie - commissions)
 */
export function computeMonthlyInvoice(
  input: MonthlyInvoiceInput,
): MonthlyInvoiceResult {
  const garantie =
    input.garantieMensuelleCents ??
    chfToCents(GARANTIE_MENSUELLE_DEFAULT_CHF);
  const frais =
    input.forfaitFraisCents ?? chfToCents(FORFAIT_FRAIS_MENSUEL_DEFAULT_CHF);

  if (input.commissionsEncaisseesCents < 0)
    throw new RangeError("commissionsEncaisseesCents ≥ 0");
  if (garantie < 0) throw new RangeError("garantieMensuelleCents ≥ 0");
  if (frais < 0) throw new RangeError("forfaitFraisCents ≥ 0");

  const garantieAbsorbeeCents = Math.max(
    0,
    garantie - input.commissionsEncaisseesCents,
  );
  const base = Math.max(input.commissionsEncaisseesCents, garantie);
  const totalCents = base + frais;

  return {
    commissionsCents: input.commissionsEncaisseesCents,
    garantieAbsorbeeCents,
    fraisCents: frais,
    totalCents,
    garantieActivee: garantieAbsorbeeCents > 0,
  };
}

// ===========================================================================
// 6. VALEUR AN 1 D'UN CONTRAT
// ===========================================================================

export interface ValeurAn1Input {
  oneShotCents: Cents;
  mensuelCents: Cents;
  /**
   * Durée totale du contrat en mois. Default 12.
   *
   * Règle (depuis 2026-06) :
   *   - Si dureeMois >= 12 → assiette commission = oneShot + mensuel × 12
   *     (les mois 13+ sont rémunérés via le mécanisme renouvellement à 10 %).
   *   - Si dureeMois < 12  → assiette = oneShot + mensuel × dureeMois
   *     (on ne commissionne JAMAIS sur un revenu qui ne rentrera pas chez
   *     ACLR. Ex. contrat 3 mois Google Ads : commission sur ce qui est
   *     réellement encaissé pendant 3 mois, pas sur 12 mois fictifs.)
   */
  dureeMois?: number;
}

/**
 * Calcule l'assiette de la commission de signature.
 *
 * Nom historique « valeur an 1 » conservé pour compat (colonne DB, audit
 * comptable). En pratique : c'est le revenu RÉEL d'ACLR sur la durée du
 * contrat, plafonné à 12 mois (les années suivantes étant rémunérées via
 * le mécanisme renouvellement).
 *
 * Formule : oneShot + mensuel × min(dureeMois, 12)
 *
 * Exemples :
 *   - Contrat 12 mois @ 1000 setup + 100/mois → assiette 2 200
 *   - Contrat 24 mois @ 1000 setup + 100/mois → assiette 2 200 (cap 12, an2+
 *     via renouvellement)
 *   - Contrat 3 mois @ 349 setup + 600/mois (Google Ads gros budget) →
 *     assiette 2 149 (= revenu réel ACLR sur les 3 mois)
 */
export function computeValeurAn1(input: ValeurAn1Input): Cents {
  if (input.oneShotCents < 0) throw new RangeError("oneShotCents ≥ 0");
  if (input.mensuelCents < 0) throw new RangeError("mensuelCents ≥ 0");
  const duree = input.dureeMois ?? 12;
  if (duree <= 0 || !Number.isFinite(duree))
    throw new RangeError(`dureeMois doit être > 0 (reçu ${duree})`);
  const moisAssiette = Math.min(duree, 12);
  return input.oneShotCents + input.mensuelCents * moisAssiette;
}

// ===========================================================================
// HELPERS DATE
// ===========================================================================

/**
 * Ajoute N mois à une date en conservant le jour, ramené au dernier jour du
 * mois cible si le jour d'origine n'existe pas (ex. 31 → 28/29 février).
 *
 * On n'importe pas date-fns ici pour garder ce module 100% pur et facile à
 * tester en isolation.
 */
export function addMonthsKeepEndOfMonth(d: Date, months: number): Date {
  const year = d.getFullYear();
  const month = d.getMonth() + months;
  const day = d.getDate();

  // Date au 1er du mois cible
  const targetMonthStart = new Date(year, month, 1);
  // Dernier jour du mois cible : jour 0 du mois suivant
  const lastDay = new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth() + 1,
    0,
  ).getDate();

  const safeDay = Math.min(day, lastDay);
  return new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth(),
    safeDay,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
}
