import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const remaining = await p.contract.findMany({
    where: { numero: { startsWith: "PLACEHOLDER-" } },
    include: {
      prospect: { select: { raisonSociale: true } },
      clientInvoices: { select: { numero: true, total: true, statut: true } },
    },
    orderBy: { numero: "asc" },
  });
  console.log(`Placeholders restants : ${remaining.length}`);
  for (const c of remaining) {
    console.log(`  ${c.numero}  →  ${c.prospect.raisonSociale}`);
    for (const i of c.clientInvoices) {
      console.log(`    · ${i.numero}  ${Number(i.total).toFixed(2)} CHF  ${i.statut}`);
    }
  }
}
main().finally(() => p.$disconnect());
