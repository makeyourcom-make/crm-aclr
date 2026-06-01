/**
 * Documente les écarts de conversion EUR↔CHF sur les factures Soverial et SRT
 * Formation reçues en Mai 2026, comme frais de change bancaires.
 *
 *   • Soverial 26-85 : 468 CHF facturé → 420.62 CHF reçu → 47.38 CHF de change
 *   • SRT Formation 26-90 : 150 CHF facturé → 145.48 EUR ≈ 138.21 CHF reçu → ~11.79 CHF de change
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Soverial
  const sov = await prisma.clientInvoice.findUnique({
    where: { numero: "26-85" },
  });
  if (sov) {
    await prisma.clientInvoice.update({
      where: { id: sov.id },
      data: {
        notesClient:
          (sov.notesClient ?? "").trim() +
          "\n— Paiement reçu 420.62 CHF (vs 468 CHF facturé) le 19.05.2026. Écart de 47.38 CHF imputé aux frais de conversion bancaire EUR/CHF côté client.",
        referenceVirement: "SAS SOVERIAL - 420.62 CHF reçu (47.38 CHF frais change)",
      },
    });
    console.log(`✓ Soverial 26-85 : note frais change ajoutée`);
  } else {
    console.log("⊘ Facture 26-85 (Soverial) introuvable");
  }

  // SRT Formation
  const srt = await prisma.clientInvoice.findUnique({
    where: { numero: "26-90" },
  });
  if (srt) {
    await prisma.clientInvoice.update({
      where: { id: srt.id },
      data: {
        notesClient:
          (srt.notesClient ?? "").trim() +
          "\n— Paiement reçu 145.48 EUR (≈ 138.21 CHF) le 12.05.2026 via Benjamin Bogaert (compte EUR 7560 Z). Écart ~11.79 CHF imputé aux frais de conversion bancaire EUR/CHF.",
        referenceVirement: "Benjamin Bogaert - 145.48 EUR reçu sur compte EUR",
      },
    });
    console.log(`✓ SRT Formation 26-90 : note frais change ajoutée`);
  } else {
    console.log("⊘ Facture 26-90 (SRT Formation) introuvable");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
