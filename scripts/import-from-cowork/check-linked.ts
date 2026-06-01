import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const all = await p.expense.findMany({
    select: { ticketUrl: true, description: true, date: true, montantTTC: true },
    orderBy: { date: "asc" },
  });
  const linked = all.filter((e) => e.ticketUrl).length;
  const unlinked = all.filter((e) => !e.ticketUrl);
  console.log(`Total charges : ${all.length}`);
  console.log(`  ✓ Avec ticket : ${linked}`);
  console.log(`  ⊘ Sans ticket : ${unlinked.length}`);
  console.log(`\nCharges encore sans ticket :`);
  for (const e of unlinked) {
    console.log(
      `  ${e.date.toISOString().slice(0, 10)}  ${Number(e.montantTTC).toFixed(2).padStart(8)} CHF  ${e.description}`,
    );
  }
}
main().finally(() => p.$disconnect());
