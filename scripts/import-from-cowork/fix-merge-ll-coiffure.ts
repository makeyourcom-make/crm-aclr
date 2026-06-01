/**
 * Fusion : "L&L Coiffure Chaar" → "L&L Coiffure Sàrl" (même client).
 *
 * Actions :
 *  - Bascule les factures du placeholder vers le vrai contrat CTR-2609
 *  - Supprime le contrat placeholder
 *  - Supprime le prospect doublon "L&L Coiffure Chaar"
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Trouve les deux prospects
  const realProspect = await prisma.prospect.findFirst({
    where: { raisonSociale: "L&L Coiffure Sàrl" },
    include: {
      contracts: { include: { clientInvoices: { select: { id: true, numero: true } } } },
    },
  });
  const dup = await prisma.prospect.findFirst({
    where: { raisonSociale: "L&L Coiffure Chaar" },
    include: {
      contracts: { include: { clientInvoices: { select: { id: true, numero: true } } } },
    },
  });

  if (!realProspect) {
    console.log("L&L Coiffure Sàrl introuvable. Abort.");
    return;
  }
  if (!dup) {
    console.log("L&L Coiffure Chaar introuvable — déjà fusionné ?");
    return;
  }

  console.log(`Prospect cible  : ${realProspect.raisonSociale} (${realProspect.contracts.length} contrat(s))`);
  console.log(`Prospect doublon: ${dup.raisonSociale} (${dup.contracts.length} contrat(s))`);

  const realContract = realProspect.contracts.find((c) => c.numero === "CTR-2609");
  if (!realContract) {
    console.log("Contrat CTR-2609 introuvable sur L&L Coiffure Sàrl. Abort.");
    return;
  }

  // 2. Bascule les factures du placeholder
  for (const dupCt of dup.contracts) {
    if (dupCt.clientInvoices.length > 0) {
      console.log(
        `  Bascule de ${dupCt.clientInvoices.length} facture(s) (${dupCt.clientInvoices.map((i) => i.numero).join(", ")}) du contrat ${dupCt.numero} vers ${realContract.numero}`,
      );
      await prisma.clientInvoice.updateMany({
        where: { contractId: dupCt.id },
        data: { contractId: realContract.id },
      });
    }
    // Bascule aussi les paiements éventuels
    await prisma.payment.updateMany({
      where: { contractId: dupCt.id },
      data: { contractId: realContract.id },
    });
  }

  // 3. Supprime les contrats placeholder (n'ont plus de factures attachées)
  for (const dupCt of dup.contracts) {
    await prisma.contract.delete({ where: { id: dupCt.id } });
    console.log(`  ✓ Contrat ${dupCt.numero} supprimé`);
  }

  // 4. Supprime le prospect doublon
  await prisma.prospect.delete({ where: { id: dup.id } });
  console.log(`  ✓ Prospect doublon "L&L Coiffure Chaar" supprimé`);

  console.log("\n✓ Fusion terminée.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
