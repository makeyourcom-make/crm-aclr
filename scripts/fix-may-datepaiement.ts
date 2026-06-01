/**
 * Corrige les datePaiement manquantes sur les factures clients déjà
 * en statut PAYEE mais sans date renseignée — correspondance avec les
 * virements du relevé Mai 2026.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Passeport Beauté : 2 paiements Sigma 1000 du 05.05 → factures Mars et Avril
  const passeport = await prisma.prospect.findFirst({
    where: { raisonSociale: { equals: "Passeport Beauté", mode: "insensitive" } },
  });
  if (passeport) {
    const f70 = await prisma.clientInvoice.findFirst({
      where: { contract: { prospectId: passeport.id }, numero: "26-70" },
    });
    if (f70 && !f70.datePaiement) {
      await prisma.clientInvoice.update({
        where: { id: f70.id },
        data: {
          datePaiement: new Date("2026-05-05"),
          modeReglement: "VIREMENT",
          referenceVirement: "Sigma Consulting SA #2 (Passeport Beauté)",
        },
      });
      console.log(`✓ Passeport Beauté 26-70 (Avril) → datePaiement 05.05`);
    }
    const f58 = await prisma.clientInvoice.findFirst({
      where: { contract: { prospectId: passeport.id }, numero: "26-58" },
    });
    if (f58 && !f58.datePaiement) {
      await prisma.clientInvoice.update({
        where: { id: f58.id },
        data: {
          datePaiement: new Date("2026-05-05"),
          modeReglement: "VIREMENT",
          referenceVirement: "Sigma Consulting SA #3 (Passeport Beauté)",
        },
      });
      console.log(`✓ Passeport Beauté 26-58 (Mars) → datePaiement 05.05`);
    }
  }

  // L&L Coiffure : paiement +39 du 04.05 → facture Mars 26-57
  const llcoiffure = await prisma.prospect.findFirst({
    where: { raisonSociale: { equals: "L&L Coiffure Sàrl", mode: "insensitive" } },
  });
  if (llcoiffure) {
    const f57 = await prisma.clientInvoice.findFirst({
      where: { contract: { prospectId: llcoiffure.id }, numero: "26-57" },
    });
    if (f57 && !f57.datePaiement) {
      await prisma.clientInvoice.update({
        where: { id: f57.id },
        data: {
          datePaiement: new Date("2026-05-04"),
          modeReglement: "VIREMENT",
          referenceVirement: "LL Coiffure Chaar, Ibrahim Chaar",
        },
      });
      console.log(`✓ L&L Coiffure 26-57 (Mars) → datePaiement 04.05`);
    }
  }

  console.log("\n✓ Ajustements datePaiement terminés.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
