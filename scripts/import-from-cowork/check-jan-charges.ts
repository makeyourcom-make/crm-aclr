import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  // Cherche large autour de janvier 2026 pour repérer l'effet timezone
  const jan = await p.expense.findMany({
    where: {
      date: {
        gte: new Date("2025-12-30T00:00:00Z"),
        lt: new Date("2026-02-02T00:00:00Z"),
      },
    },
    orderBy: { date: "asc" },
  });
  console.log(`Charges trouvées dans la fenêtre élargie : ${jan.length}\n`);
  let total = 0;
  for (const c of jan) {
    const amt = Number(c.montantTTC);
    total += amt;
    console.log(
      `  UTC ${c.date.toISOString().slice(0, 19)}  ${amt.toFixed(2).padStart(8)} CHF  ${c.description}`,
    );
  }
  console.log(`\nTotal : ${total.toFixed(2)} CHF`);
}
main().finally(() => p.$disconnect());
