/**
 * Audit final : charges sans ticket + charges potentiellement liées à un client.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.expense.count();
  const withTicket = await prisma.expense.count({
    where: { ticketUrl: { not: null } },
  });
  const sumYTD = await prisma.expense.aggregate({
    _sum: { montantTTC: true },
  });

  console.log(`=== Vue d'ensemble ===`);
  console.log(`Charges total YTD     : ${total}`);
  console.log(`  avec ticket         : ${withTicket}`);
  console.log(`  sans ticket         : ${total - withTicket}`);
  console.log(`Montant total TTC YTD : ${Number(sumYTD._sum.montantTTC ?? 0).toFixed(2)} CHF`);

  console.log(`\n=== Charges SANS ticket (10) ===`);
  const sans = await prisma.expense.findMany({
    where: { ticketUrl: null },
    orderBy: { date: "asc" },
    select: { date: true, description: true, fournisseur: true, montantTTC: true, categorie: true },
  });
  for (const e of sans) {
    console.log(
      `  ${e.date.toISOString().slice(0, 10)}  ${(e.fournisseur ?? "?").padEnd(20)}  ${(e.description ?? "?").slice(0, 55).padEnd(55)}  ${Number(e.montantTTC).toFixed(2).padStart(9)} CHF`,
    );
  }

  console.log(`\n=== Charges potentiellement liées à un client ===`);
  const perClient = await prisma.expense.findMany({
    where: {
      OR: [
        { description: { contains: "Google ADS", mode: "insensitive" } },
        { description: { contains: "LWS - Nom de domaine", mode: "insensitive" } },
        { description: { contains: "Infomaniak - Domaine", mode: "insensitive" } },
        { description: { contains: "Lucas", mode: "insensitive" } },
      ],
    },
    orderBy: { date: "asc" },
    select: { date: true, description: true, montantTTC: true },
  });
  let totalRefac = 0;
  for (const e of perClient) {
    console.log(
      `  ${e.date.toISOString().slice(0, 10)}  ${(e.description ?? "?").slice(0, 70).padEnd(70)}  ${Number(e.montantTTC).toFixed(2).padStart(9)} CHF`,
    );
    totalRefac += Number(e.montantTTC);
  }
  console.log(
    `\n  Total charges « refacturables / par client » : ${totalRefac.toFixed(2)} CHF`,
  );

  console.log(`\n=== Répartition par catégorie ===`);
  const byCat = await prisma.expense.groupBy({
    by: ["categorie"],
    _sum: { montantTTC: true },
    _count: true,
    orderBy: { _sum: { montantTTC: "desc" } },
  });
  for (const c of byCat) {
    console.log(
      `  ${c.categorie.padEnd(20)} ${String(c._count).padStart(3)}× ${Number(c._sum.montantTTC ?? 0).toFixed(2).padStart(10)} CHF`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
