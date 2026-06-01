/**
 * Identifie les factures Google ADS de mai 2026 et leurs clients.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const invoices = await prisma.clientInvoice.findMany({
    where: {
      OR: [
        { notesClient: { contains: "Google ADS", mode: "insensitive" } },
        { notesClient: { contains: "Google Ads", mode: "insensitive" } },
        { lignes: { some: { designation: { contains: "Google", mode: "insensitive" } } } },
      ],
    },
    include: {
      lignes: true,
      contract: { select: { numero: true, prospect: { select: { raisonSociale: true } } } },
    },
    orderBy: { numero: "asc" },
  });

  console.log(`${invoices.length} factures Google ADS dans le CRM :\n`);
  for (const f of invoices) {
    console.log(`${f.numero.padEnd(10)} | ${f.contract.prospect.raisonSociale.padEnd(28)} | ${Number(f.total).toFixed(2).padStart(10)} | ${f.lignes[0]?.designation ?? "(sans ligne)"}`);
  }
}
main().finally(() => prisma.$disconnect());
