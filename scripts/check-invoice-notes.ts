/**
 * Audite les notesClient sur les ClientInvoice pour identifier celles qui
 * contiennent des métadonnées techniques inutiles à afficher sur la facture.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const all = await prisma.clientInvoice.findMany({
    where: { notesClient: { not: null } },
    select: {
      numero: true,
      notesClient: true,
      contract: { select: { prospect: { select: { raisonSociale: true } } } },
    },
    orderBy: { numero: "asc" },
  });
  console.log(`${all.length} factures avec notesClient :\n`);
  for (const f of all) {
    console.log(
      `${f.numero.padEnd(22)} ${f.contract.prospect.raisonSociale.padEnd(28)} `,
    );
    console.log(`  → ${f.notesClient}\n`);
  }
}
main().finally(() => prisma.$disconnect());
