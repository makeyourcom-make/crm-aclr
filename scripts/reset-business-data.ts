/**
 * Script de reset des données métier.
 *
 * Vide toutes les données opérationnelles pour repartir d'une base
 * vierge prête à recevoir les données réelles.
 *
 * GARDE :
 *   - Users (Sophie, Arthur, et autres collaborateurs)
 *   - Products (catalogue)
 *   - Settings (paramètres entreprise)
 *
 * SUPPRIME :
 *   - Toutes les Activity, Email
 *   - Tous les Prospect, Deal, Contract et cascade (commissions, factures,
 *     signatures, paiements, renouvellements)
 *   - Toutes les Invoice (salaires) et Expense (charges)
 *   - Tous les EmployeeDocument
 *   - Tous les Objective
 *   - Compteurs remis à zéro
 *
 * ⚠ IRRÉVERSIBLE — fait un backup avant si nécessaire :
 *   pg_dump $DATABASE_URL > backup.sql
 *
 * Usage :
 *   npx tsx scripts/reset-business-data.ts
 *   npx tsx scripts/reset-business-data.ts --yes   # skip confirmation
 */
import { PrismaClient } from "@prisma/client";
import readline from "node:readline/promises";

const prisma = new PrismaClient();

async function confirm(): Promise<boolean> {
  if (process.argv.includes("--yes")) return true;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ans = await rl.question(
    'Confirmer la suppression de toutes les données métier ? Tape "RESET" : ',
  );
  rl.close();
  return ans.trim() === "RESET";
}

async function main() {
  console.log("=".repeat(60));
  console.log("RESET DES DONNÉES MÉTIER — base prête pour import réel");
  console.log("=".repeat(60));

  // Compte avant
  const before = {
    prospects: await prisma.prospect.count(),
    deals: await prisma.deal.count(),
    contracts: await prisma.contract.count(),
    signatures: await prisma.signature.count(),
    commissions: await prisma.commission.count(),
    commissionPayments: await prisma.commissionPayment.count(),
    clientInvoices: await prisma.clientInvoice.count(),
    payments: await prisma.payment.count(),
    invoices: await prisma.invoice.count(),
    activities: await prisma.activity.count(),
    emails: await prisma.email.count(),
    expenses: await prisma.expense.count(),
    employeeDocuments: await prisma.employeeDocument.count(),
    objectives: await prisma.objective.count(),
    renewals: await prisma.renewal.count(),
    counters: await prisma.counter.count(),
  };

  console.log("\nÉtat actuel :");
  for (const [k, v] of Object.entries(before)) {
    if (v > 0) console.log(`  • ${k.padEnd(22)} ${v}`);
  }

  // Garde
  const keep = {
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    settings: await prisma.setting.count(),
  };
  console.log("\nSera CONSERVÉ :");
  for (const [k, v] of Object.entries(keep)) {
    console.log(`  • ${k.padEnd(22)} ${v}`);
  }

  console.log("");
  const ok = await confirm();
  if (!ok) {
    console.log("Annulé.");
    return;
  }

  console.log("\nSuppression en cours...");

  // Ordre de suppression : respect des contraintes FK (enfants d'abord)
  // Note : la plupart ont onDelete: Cascade, mais on supprime explicitement
  // pour avoir le compte exact.
  await prisma.$transaction([
    // 1. Tables qui dépendent de Contract / Commission / Invoice
    prisma.commissionPayment.deleteMany({}),
    prisma.commission.deleteMany({}),
    prisma.renewal.deleteMany({}),
    prisma.clientInvoiceLine.deleteMany({}),
    prisma.clientInvoice.deleteMany({}),
    prisma.payment.deleteMany({}),
    prisma.signature.deleteMany({}),
    // 2. Contract → libère Deal et Prospect
    prisma.contract.deleteMany({}),
    // 3. Deal → libère Prospect
    prisma.deal.deleteMany({}),
    // 4. Activity / Email → libèrent Prospect
    prisma.activity.deleteMany({}),
    prisma.email.deleteMany({}),
    // 5. Prospect
    prisma.prospect.deleteMany({}),
    // 6. Invoice (salaire commercial)
    prisma.invoice.deleteMany({}),
    // 7. Expense (charges)
    prisma.expense.deleteMany({}),
    // 8. EmployeeDocument
    prisma.employeeDocument.deleteMany({}),
    // 9. Objective
    prisma.objective.deleteMany({}),
    // 10. Compteurs (remis à zéro)
    prisma.counter.deleteMany({}),
  ]);

  console.log("✓ Données supprimées.");

  // Vérif après
  const after = {
    prospects: await prisma.prospect.count(),
    deals: await prisma.deal.count(),
    contracts: await prisma.contract.count(),
    activities: await prisma.activity.count(),
    invoices: await prisma.invoice.count(),
    expenses: await prisma.expense.count(),
    users: await prisma.user.count(),
    products: await prisma.product.count(),
  };

  console.log("\nÉtat après reset :");
  for (const [k, v] of Object.entries(after)) {
    console.log(`  • ${k.padEnd(22)} ${v}`);
  }

  console.log("\n✓ Base prête pour l'import des données réelles.");
  console.log(
    "  Les compteurs de numérotation (contrats, factures) reprendront à 0001.",
  );
}

main()
  .catch((e) => {
    console.error("Erreur:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
