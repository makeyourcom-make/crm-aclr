/**
 * Vérifie le calcul de la quote-part frais généraux par contrat.
 *
 * Formule : (chargesMoyennesMensuelles + salaireFixeNonCommercial) * 12 / nbContrats
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [expensesLast6m, nonCommercialsActifs, contracts] = await Promise.all([
    prisma.expense.findMany({
      where: { date: { gte: sixMonthsAgo } },
      select: { montantTTC: true, description: true, date: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { not: "COMMERCIAL" } },
      select: { name: true, salaireBase: true, role: true },
    }),
    prisma.contract.findMany({
      where: { statut: "ACTIF" },
      select: { numero: true },
    }),
  ]);

  const sumExpenses = expensesLast6m.reduce(
    (s, e) => s + Number(e.montantTTC),
    0,
  );
  const chargesMoyennesMensuelles = sumExpenses / 6;

  console.log("═══ DÉTAIL CALCUL QUOTE-PART FRAIS GÉNÉRAUX ═══\n");

  console.log(`📊 Charges (6 derniers mois)`);
  console.log(`   ${expensesLast6m.length} charges TTC trouvées`);
  console.log(`   Somme TTC 6 mois     : ${sumExpenses.toFixed(2)}`);
  console.log(`   ÷ 6 = moy. mensuelle : ${chargesMoyennesMensuelles.toFixed(2)}\n`);

  console.log(`👥 Salaires non-commerciaux (actifs)`);
  let salaireFixeNonCommercial = 0;
  for (const u of nonCommercialsActifs) {
    const s = Number(u.salaireBase ?? 0);
    salaireFixeNonCommercial += s;
    console.log(`   ${u.name.padEnd(20)} (${u.role}) → ${s.toFixed(2)}/mois`);
  }
  console.log(`   ── Total mensuel : ${salaireFixeNonCommercial.toFixed(2)}\n`);

  const fraisFixesMensuels =
    chargesMoyennesMensuelles + salaireFixeNonCommercial;
  console.log(`📅 Frais fixes mensuels totaux : ${fraisFixesMensuels.toFixed(2)}`);
  console.log(`   × 12 mois = ${(fraisFixesMensuels * 12).toFixed(2)} / an\n`);

  console.log(`📑 Contrats ACTIFS`);
  console.log(`   Nombre : ${contracts.length}`);
  console.log(`   ${contracts.map((c) => c.numero).join(", ")}\n`);

  const nbContrats = Math.max(contracts.length, 1);
  const quotePart = (fraisFixesMensuels * 12) / nbContrats;
  console.log(`═══ QUOTE-PART PAR CONTRAT ═══`);
  console.log(`   (${fraisFixesMensuels.toFixed(2)} × 12) / ${nbContrats}`);
  console.log(`   = ${(fraisFixesMensuels * 12).toFixed(2)} / ${nbContrats}`);
  console.log(`   = CHF ${quotePart.toFixed(2)} par contrat / an\n`);

  // Verdict
  const target = 881.18;
  const diff = Math.abs(quotePart - target);
  console.log(`🎯 Verdict vs CHF ${target.toFixed(2)} attendu`);
  if (diff < 0.5) {
    console.log(`   ✓ JUSTE (écart ${diff.toFixed(2)})`);
  } else {
    console.log(`   ✗ Écart : ${diff.toFixed(2)} (calculé=${quotePart.toFixed(2)})`);
  }
}
main().finally(() => prisma.$disconnect());
