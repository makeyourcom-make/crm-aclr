import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const inv = await prisma.clientInvoice.findFirst({
    where: { numero: "26-51" },
    include: { lignes: true, contract: { select: { numero: true } } },
  });
  console.log("Invoice 26-51:");
  console.log("  notesClient:", inv?.notesClient);
  console.log("  contract:", inv?.contract.numero);
  console.log("  lignes:");
  for (const l of inv?.lignes ?? []) {
    console.log(`    [${l.ordre}] ${l.designation} (qte=${l.quantite}, pu=${l.prixUnitaire})`);
  }
}
main().finally(() => prisma.$disconnect());
