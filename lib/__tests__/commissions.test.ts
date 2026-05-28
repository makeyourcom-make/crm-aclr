/**
 * Suite de tests du moteur de commissions.
 *
 * Cette zone est zéro-bug-toléré : tout calcul de rémunération doit être
 * couvert. Chaque cas tordu (arrondi, résiliation, garantie absorbée) a son
 * test isolé.
 */

import { describe, expect, it } from "vitest";

import {
  addMonthsKeepEndOfMonth,
  applyResiliation,
  buildRenewalPaymentPlan,
  buildSignaturePaymentPlan,
  centsToChf,
  chfToCents,
  computeCommissionSignature,
  computeMonthlyInvoice,
  computeRenewalMonthly,
  computeValeurAn1,
  type CommissionPaymentSnapshot,
} from "../commissions";

// ===========================================================================
// CONVERSIONS CHF ↔ CENTS
// ===========================================================================

describe("chfToCents / centsToChf", () => {
  it("round-trip pour les montants standards", () => {
    expect(centsToChf(chfToCents(2500))).toBe(2500);
    expect(centsToChf(chfToCents(1490))).toBe(1490);
    expect(centsToChf(chfToCents(0))).toBe(0);
  });

  it("gère les centimes (2 décimales)", () => {
    expect(chfToCents(56.81)).toBe(5681);
    expect(chfToCents(56.91)).toBe(5691);
    expect(centsToChf(5681)).toBe(56.81);
  });

  it("évite le piège 0.1 + 0.2", () => {
    // Si on faisait 0.1 + 0.2 en float, on aurait 0.30000000000000004
    // En cents : 10 + 20 = 30 exactement
    expect(chfToCents(0.1) + chfToCents(0.2)).toBe(30);
    expect(centsToChf(30)).toBe(0.3);
  });

  it("arrondit correctement au centime le plus proche", () => {
    expect(chfToCents(56.815)).toBe(5682); // banker's rounding (.5 → up sur 1)
    expect(chfToCents(56.814)).toBe(5681);
  });

  it("rejette les entrées invalides", () => {
    expect(() => chfToCents(NaN)).toThrow();
    expect(() => chfToCents(Infinity)).toThrow();
    expect(() => centsToChf(1.5)).toThrow(); // non entier
  });
});

// ===========================================================================
// COMMISSION SIGNATURE
// ===========================================================================

describe("computeCommissionSignature", () => {
  it("contrat standard 1'500 CHF → 25 % = 375 CHF", () => {
    const r = computeCommissionSignature({
      valeurAn1Cents: chfToCents(1500),
    });
    expect(centsToChf(r.totalCents)).toBe(375);
    expect(centsToChf(r.partSignatureCents)).toBe(187.5);
    expect(centsToChf(r.totalEtalementsCents)).toBe(187.5);
    expect(r.etalementsCents.length).toBe(11);
  });

  it("invariant : partSignature + sum(etalements) === total (cas pile divisible)", () => {
    // Contrat 44'000 CHF/an → commission 11'000 CHF → 5'500 + 5'500
    // 5'500 / 11 = 500 CHF exactement par mois
    const r = computeCommissionSignature({
      valeurAn1Cents: chfToCents(44000),
    });
    expect(r.totalCents).toBe(chfToCents(11000));
    expect(r.partSignatureCents).toBe(chfToCents(5500));
    expect(r.etalementsCents).toEqual(Array(11).fill(chfToCents(500)));
  });

  it("invariant : partSignature + sum(etalements) === total (cas non divisible)", () => {
    // Contrat 5'000 CHF/an → commission 1'250 CHF
    // Part1 = 625 CHF, totalEtalements = 625 CHF
    // 625 / 11 = 56.818... CHF → 56.81 × 10 + 56.91 = 625 CHF (le 11e absorbe)
    const r = computeCommissionSignature({
      valeurAn1Cents: chfToCents(5000),
    });
    expect(r.totalCents).toBe(chfToCents(1250));
    expect(r.partSignatureCents).toBe(chfToCents(625));

    const sumEtalements = r.etalementsCents.reduce((a, b) => a + b, 0);
    expect(sumEtalements).toBe(chfToCents(625));
    expect(r.partSignatureCents + sumEtalements).toBe(r.totalCents);

    // Les 10 premiers à 56.81, le 11e absorbe les 9 centimes de reste
    // (62500 - 5681 × 10 = 5690)
    expect(r.etalementsCents.slice(0, 10)).toEqual(Array(10).fill(5681));
    expect(r.etalementsCents[10]).toBe(5690);
  });

  it("taux personnalisé (ex. 30 % pour une commerciale senior)", () => {
    const r = computeCommissionSignature({
      valeurAn1Cents: chfToCents(10000),
      taux: 0.3,
    });
    expect(r.totalCents).toBe(chfToCents(3000));
  });

  it("valeurAn1 = 0 → commission 0, plan plein de zéros", () => {
    const r = computeCommissionSignature({ valeurAn1Cents: 0 });
    expect(r.totalCents).toBe(0);
    expect(r.partSignatureCents).toBe(0);
    expect(r.totalEtalementsCents).toBe(0);
    expect(r.etalementsCents).toEqual(Array(11).fill(0));
  });

  it("rejette les entrées invalides", () => {
    expect(() =>
      computeCommissionSignature({ valeurAn1Cents: -100 }),
    ).toThrow();
    expect(() =>
      computeCommissionSignature({ valeurAn1Cents: 100, taux: -0.1 }),
    ).toThrow();
    expect(() =>
      computeCommissionSignature({ valeurAn1Cents: 100, taux: 1.5 }),
    ).toThrow();
  });

  it("invariant tenu sur 100 cas aléatoires (fuzz)", () => {
    for (let i = 0; i < 100; i++) {
      const valeurAn1Cents = Math.floor(Math.random() * 1_000_000); // 0 à 10'000 CHF
      const taux = Math.random() * 0.5; // 0 à 50 %
      const r = computeCommissionSignature({ valeurAn1Cents, taux });
      const sumEtalements = r.etalementsCents.reduce((a, b) => a + b, 0);
      expect(r.partSignatureCents + sumEtalements).toBe(r.totalCents);
      expect(r.etalementsCents.length).toBe(11);
      expect(r.etalementsCents.every((c) => Number.isInteger(c))).toBe(true);
    }
  });
});

// ===========================================================================
// PLAN DE VERSEMENT
// ===========================================================================

describe("buildSignaturePaymentPlan", () => {
  it("génère 1 SIGNATURE + 11 ETALEMENT (12 items au total)", () => {
    const plan = buildSignaturePaymentPlan({
      valeurAn1Cents: chfToCents(10000),
      dateSignature: new Date("2026-01-15T10:00:00"),
    });
    expect(plan.length).toBe(12);
    expect(plan[0].typePart).toBe("SIGNATURE");
    expect(plan[0].numeroMois).toBeNull();
    expect(plan.slice(1).every((p) => p.typePart === "ETALEMENT")).toBe(true);
    expect(plan.slice(1).map((p) => p.numeroMois)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });

  it("les dates de versement progressent d'un mois à chaque fois", () => {
    const dateSignature = new Date("2026-03-10T14:00:00");
    const plan = buildSignaturePaymentPlan({
      valeurAn1Cents: chfToCents(12000),
      dateSignature,
    });

    expect(plan[0].dateVersementPrevue).toEqual(dateSignature);
    expect(plan[1].dateVersementPrevue).toEqual(
      new Date("2026-04-10T14:00:00"),
    );
    expect(plan[11].dateVersementPrevue).toEqual(
      new Date("2027-02-10T14:00:00"),
    );
  });

  it("gère le 31 → 28/29 février sans crash", () => {
    const plan = buildSignaturePaymentPlan({
      valeurAn1Cents: chfToCents(12000),
      dateSignature: new Date("2026-01-31T09:00:00"),
    });
    // Mois 1 = février 2026 (28 jours, 2026 non bissextile)
    expect(plan[1].dateVersementPrevue.getMonth()).toBe(1); // février
    expect(plan[1].dateVersementPrevue.getDate()).toBe(28);
  });

  it("la somme des montants est égale au total de commission", () => {
    const plan = buildSignaturePaymentPlan({
      valeurAn1Cents: chfToCents(7777),
      dateSignature: new Date(),
    });
    const sum = plan.reduce((acc, p) => acc + p.montantCents, 0);
    const calc = computeCommissionSignature({
      valeurAn1Cents: chfToCents(7777),
    });
    expect(sum).toBe(calc.totalCents);
  });
});

// ===========================================================================
// COMMISSION RENOUVELLEMENT
// ===========================================================================

describe("computeRenewalMonthly", () => {
  it("10 % du mensuel par défaut", () => {
    expect(computeRenewalMonthly({ montantMensuelCents: chfToCents(500) }))
      .toBe(chfToCents(50));
    expect(computeRenewalMonthly({ montantMensuelCents: chfToCents(249) }))
      .toBe(chfToCents(24.9));
  });

  it("arrondit au centime", () => {
    // 333 CHF * 10% = 33.30 CHF (exact)
    expect(computeRenewalMonthly({ montantMensuelCents: chfToCents(333) }))
      .toBe(chfToCents(33.3));
  });

  it("rejette les entrées invalides", () => {
    expect(() =>
      computeRenewalMonthly({ montantMensuelCents: -100 }),
    ).toThrow();
    expect(() =>
      computeRenewalMonthly({ montantMensuelCents: 100, taux: 2 }),
    ).toThrow();
  });
});

describe("buildRenewalPaymentPlan", () => {
  it("génère 12 versements mensuels", () => {
    const plan = buildRenewalPaymentPlan({
      montantMensuelCents: chfToCents(500),
      dateRenouvellement: new Date("2027-01-15"),
    });
    expect(plan.length).toBe(12);
    expect(plan[0].numeroMois).toBe(1);
    expect(plan[11].numeroMois).toBe(12);
    expect(plan.every((p) => p.montantCents === chfToCents(50))).toBe(true);
  });

  it("les dates progressent d'un mois", () => {
    const date = new Date("2027-06-01T00:00:00");
    const plan = buildRenewalPaymentPlan({
      montantMensuelCents: chfToCents(1000),
      dateRenouvellement: date,
    });
    expect(plan[0].dateVersementPrevue).toEqual(date);
    expect(plan[11].dateVersementPrevue).toEqual(
      new Date("2028-05-01T00:00:00"),
    );
  });
});

// ===========================================================================
// RÉSILIATION ANTICIPÉE
// ===========================================================================

describe("applyResiliation", () => {
  const baseDate = new Date("2026-01-01");
  const mk = (
    id: string,
    statut: CommissionPaymentSnapshot["statut"],
  ): CommissionPaymentSnapshot => ({
    id,
    statut,
    dateVersementPrevue: baseDate,
  });

  it("annule tous les PREVU, préserve les PAYE", () => {
    const payments = [
      mk("p1", "PAYE"),
      mk("p2", "PAYE"),
      mk("p3", "PREVU"),
      mk("p4", "PREVU"),
      mk("p5", "PREVU"),
    ];
    const r = applyResiliation(payments);
    expect(r.aAnnuler).toEqual(["p3", "p4", "p5"]);
    expect(r.intacts).toEqual(["p1", "p2"]);
  });

  it("préserve aussi les ANNULE déjà existants", () => {
    const payments = [mk("p1", "PAYE"), mk("p2", "ANNULE"), mk("p3", "PREVU")];
    const r = applyResiliation(payments);
    expect(r.aAnnuler).toEqual(["p3"]);
    expect(r.intacts).toEqual(["p1", "p2"]);
  });

  it("liste vide → tout vide", () => {
    const r = applyResiliation([]);
    expect(r.aAnnuler).toEqual([]);
    expect(r.intacts).toEqual([]);
  });
});

// ===========================================================================
// FACTURE MENSUELLE COMMERCIALE (garantie absorbable)
// ===========================================================================

describe("computeMonthlyInvoice", () => {
  it("commissions au-dessus de la garantie → pas d'absorption", () => {
    // 3'000 commissions ; garantie 2'500 ; frais 250
    // → total = 3'000 + 250 = 3'250
    const r = computeMonthlyInvoice({
      commissionsEncaisseesCents: chfToCents(3000),
    });
    expect(centsToChf(r.totalCents)).toBe(3250);
    expect(r.garantieActivee).toBe(false);
    expect(r.garantieAbsorbeeCents).toBe(0);
  });

  it("commissions = exactement garantie → pas d'absorption (limite)", () => {
    const r = computeMonthlyInvoice({
      commissionsEncaisseesCents: chfToCents(2500),
    });
    expect(centsToChf(r.totalCents)).toBe(2750);
    expect(r.garantieActivee).toBe(false);
  });

  it("commissions inférieures à la garantie → absorption partielle", () => {
    // 800 commissions ; garantie 2'500 ; frais 250
    // → absorbée = 2'500 - 800 = 1'700
    // → total = MAX(800, 2'500) + 250 = 2'750
    const r = computeMonthlyInvoice({
      commissionsEncaisseesCents: chfToCents(800),
    });
    expect(centsToChf(r.garantieAbsorbeeCents)).toBe(1700);
    expect(centsToChf(r.totalCents)).toBe(2750);
    expect(r.garantieActivee).toBe(true);
  });

  it("aucune commission → garantie complète absorbée", () => {
    const r = computeMonthlyInvoice({ commissionsEncaisseesCents: 0 });
    expect(centsToChf(r.garantieAbsorbeeCents)).toBe(2500);
    expect(centsToChf(r.totalCents)).toBe(2750);
    expect(r.garantieActivee).toBe(true);
  });

  it("taux garantie et frais personnalisés", () => {
    // Commerciale sénior : garantie 3'500, frais 400
    const r = computeMonthlyInvoice({
      commissionsEncaisseesCents: chfToCents(2000),
      garantieMensuelleCents: chfToCents(3500),
      forfaitFraisCents: chfToCents(400),
    });
    expect(centsToChf(r.garantieAbsorbeeCents)).toBe(1500);
    expect(centsToChf(r.totalCents)).toBe(3900);
  });

  it("rejette les entrées invalides", () => {
    expect(() =>
      computeMonthlyInvoice({ commissionsEncaisseesCents: -1 }),
    ).toThrow();
    expect(() =>
      computeMonthlyInvoice({
        commissionsEncaisseesCents: 100,
        garantieMensuelleCents: -1,
      }),
    ).toThrow();
  });
});

// ===========================================================================
// VALEUR AN 1
// ===========================================================================

describe("computeValeurAn1", () => {
  it("Pack Web : 1'000 oneShot + 59*12 = 1'708 CHF", () => {
    const v = computeValeurAn1({
      oneShotCents: chfToCents(1000),
      mensuelCents: chfToCents(59),
    });
    expect(centsToChf(v)).toBe(1708);
  });

  it("Pack Premium fictif : 5'000 + 1'500/mois = 23'000 CHF/an", () => {
    const v = computeValeurAn1({
      oneShotCents: chfToCents(5000),
      mensuelCents: chfToCents(1500),
    });
    expect(centsToChf(v)).toBe(23000);
  });

  it("Que du oneShot, pas de récurrent", () => {
    const v = computeValeurAn1({
      oneShotCents: chfToCents(400),
      mensuelCents: 0,
    });
    expect(centsToChf(v)).toBe(400);
  });

  it("Que du récurrent, pas de oneShot", () => {
    const v = computeValeurAn1({
      oneShotCents: 0,
      mensuelCents: chfToCents(249),
    });
    expect(centsToChf(v)).toBe(2988); // 249 × 12
  });

  it("rejette les entrées négatives", () => {
    expect(() =>
      computeValeurAn1({ oneShotCents: -1, mensuelCents: 0 }),
    ).toThrow();
    expect(() =>
      computeValeurAn1({ oneShotCents: 0, mensuelCents: -1 }),
    ).toThrow();
  });
});

// ===========================================================================
// HELPER addMonthsKeepEndOfMonth
// ===========================================================================

describe("addMonthsKeepEndOfMonth", () => {
  it("ajoute des mois normaux", () => {
    expect(addMonthsKeepEndOfMonth(new Date("2026-01-15"), 1)).toEqual(
      new Date("2026-02-15"),
    );
    expect(addMonthsKeepEndOfMonth(new Date("2026-01-15"), 12)).toEqual(
      new Date("2027-01-15"),
    );
  });

  it("31 janvier + 1 mois → 28 février (année non bissextile)", () => {
    const r = addMonthsKeepEndOfMonth(new Date("2026-01-31"), 1);
    expect(r.getMonth()).toBe(1); // février
    expect(r.getDate()).toBe(28);
  });

  it("31 janvier + 1 mois → 29 février (année bissextile)", () => {
    const r = addMonthsKeepEndOfMonth(new Date("2028-01-31"), 1);
    expect(r.getMonth()).toBe(1); // février
    expect(r.getDate()).toBe(29);
  });

  it("30 avril + 1 mois → 30 mai", () => {
    expect(addMonthsKeepEndOfMonth(new Date("2026-04-30"), 1)).toEqual(
      new Date("2026-05-30"),
    );
  });

  it("préserve l'heure", () => {
    const d = new Date("2026-01-15T14:30:45.123");
    const r = addMonthsKeepEndOfMonth(d, 2);
    expect(r.getHours()).toBe(14);
    expect(r.getMinutes()).toBe(30);
    expect(r.getSeconds()).toBe(45);
    expect(r.getMilliseconds()).toBe(123);
  });
});

// ===========================================================================
// SCÉNARIO COMPLET — un cas réel de bout en bout
// ===========================================================================

describe("Scénario : Pack Web Complet signé par Sophie", () => {
  // Pack Web Complet = site haut + SEO + Ads
  //   Site haut : 1'000 oneShot + 59/mois
  //   SEO       :              59/mois
  //   Ads       :  349 oneShot + 45/mois (part ACLR)
  // Total : 1'349 oneShot + 163/mois
  // ValeurAn1 = 1'349 + 163*12 = 3'305 CHF

  const oneShot = chfToCents(1349);
  const mensuel = chfToCents(163);
  const dateSignature = new Date("2026-05-28T10:00:00");

  it("calcule la valeur an 1 et la commission attendues", () => {
    const valeurAn1 = computeValeurAn1({
      oneShotCents: oneShot,
      mensuelCents: mensuel,
    });
    expect(centsToChf(valeurAn1)).toBe(3305);

    const commission = computeCommissionSignature({
      valeurAn1Cents: valeurAn1,
    });
    expect(centsToChf(commission.totalCents)).toBe(826.25); // 25 % de 3'305
    expect(centsToChf(commission.partSignatureCents)).toBe(413.12);
    // L'autre moitié vaut 413.13 (le ½ centime perdu va dans le dernier étalement)
    expect(centsToChf(commission.totalEtalementsCents)).toBe(413.13);
  });

  it("plan de versement : 1 signature + 11 étalements, dates correctes", () => {
    const valeurAn1 = computeValeurAn1({
      oneShotCents: oneShot,
      mensuelCents: mensuel,
    });
    const plan = buildSignaturePaymentPlan({
      valeurAn1Cents: valeurAn1,
      dateSignature,
    });
    expect(plan.length).toBe(12);
    expect(plan[0].dateVersementPrevue).toEqual(dateSignature);
    expect(plan[11].dateVersementPrevue.getFullYear()).toBe(2027);
    expect(plan[11].dateVersementPrevue.getMonth()).toBe(3); // avril 2027

    // Somme exacte de tous les versements
    const sum = plan.reduce((a, p) => a + p.montantCents, 0);
    expect(centsToChf(sum)).toBe(826.25);
  });

  it("renouvellement an 2 : 16.30 CHF/mois × 12 = 195.60 CHF", () => {
    const monthly = computeRenewalMonthly({ montantMensuelCents: mensuel });
    expect(centsToChf(monthly)).toBe(16.3);

    const plan = buildRenewalPaymentPlan({
      montantMensuelCents: mensuel,
      dateRenouvellement: new Date("2027-05-28"),
    });
    const sum = plan.reduce((a, p) => a + p.montantCents, 0);
    expect(centsToChf(sum)).toBe(195.6);
  });
});
