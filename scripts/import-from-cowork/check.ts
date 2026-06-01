import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const [
    prospects,
    contracts,
    invoices,
    payments,
    expenses,
    counter,
    byInvoiceStatus,
    byExpenseCat,
  ] = await Promise.all([
    prisma.prospect.count(),
    prisma.contract.count(),
    prisma.clientInvoice.count(),
    prisma.payment.count(),
    prisma.expense.count(),
    prisma.counter.findFirst({
      where: { scope: "client_invoice", year: 2026 },
    }),
    prisma.clientInvoice.groupBy({
      by: ["statut"],
      _count: true,
      _sum: { total: true },
    }),
    prisma.expense.groupBy({
      by: ["categorie"],
      _count: true,
      _sum: { montantTTC: true },
    }),
  ]);

  console.log("=".repeat(60));
  console.log("ÉTAT DE LA DB APRÈS IMPORT");
  console.log("=".repeat(60));
  console.log(`Prospects        : ${prospects}`);
  console.log(`Contrats         : ${contracts}`);
  console.log(`Factures clients : ${invoices}`);
  console.log(`Paiements        : ${payments}`);
  console.log(`Charges          : ${expenses}`);
  console.log(`Counter 26-XX    : ${counter?.value ?? 0}`);

  console.log("\nFactures par statut :");
  for (const s of byInvoiceStatus) {
    const sum = Number(s._sum.total ?? 0).toFixed(2);
    console.log(`  ${s.statut.padEnd(15)} ${s._count} factures  total ${sum} CHF`);
  }

  console.log("\nCharges par catégorie :");
  for (const c of byExpenseCat) {
    const sum = Number(c._sum.montantTTC ?? 0).toFixed(2);
    console.log(`  ${c.categorie.padEnd(20)} ${c._count} charges  total ${sum} CHF`);
  }
}
main().finally(() => prisma.$disconnect());
