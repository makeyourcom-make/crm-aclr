/**
 * Ajoute la charge Lucas Carlin (Community Manager) Mai 2026.
 *
 * Facture N° 155 du 01/06/2026 :
 *   - 480 EUR HT (TVA 0% — art. 259-1 CGI)
 *   - Conversion EUR → CHF : ×0.95 = 456 CHF
 *
 * Allocations multi-clients :
 *   - Sp Industriel    : 200 EUR (Forfait base)     = 190 CHF HT
 *   - Passeport Beauté : 280 EUR (4 reels/carr/sto) = 266 CHF HT
 *   - LocFactory       : 0 EUR (pas de presta ce mois)
 *
 * Upload du PDF vers Vercel Blob (STORAGE_MODE=blob) ou local sinon.
 */
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

import { uploadFile } from "@/lib/file-storage";

const prisma = new PrismaClient();
const SOURCE_PDF =
  "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\09. Charges\\Facture_155_ACLR.pdf";

async function main() {
  // 1. Lookup admin + prospects
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const spIndustriel = await prisma.prospect.findFirst({
    where: { raisonSociale: { equals: "SP Industriel", mode: "insensitive" } },
  });
  const passeport = await prisma.prospect.findFirst({
    where: { raisonSociale: { equals: "Passeport Beauté", mode: "insensitive" } },
  });
  if (!spIndustriel || !passeport)
    throw new Error("Prospect Sp Industriel ou Passeport Beauté introuvable.");

  // 2. Idempotence : si la charge existe déjà, on skip
  const existing = await prisma.expense.findFirst({
    where: { description: { contains: "Lucas - Community Manager (Mai 2026)" } },
  });
  if (existing) {
    console.log(`⊘ Charge déjà existante : ${existing.id}. Rien à faire.`);
    return;
  }

  // 3. Création de la charge
  const ttcCHF = Math.round(480 * 0.95 * 100) / 100; // 456.00 CHF
  const charge = await prisma.expense.create({
    data: {
      date: new Date("2026-06-01T00:00:00Z"),
      categorie: "HONORAIRES",
      fournisseur: "Lucas Carlin (EI)",
      description: "Lucas - Community Manager (Mai 2026)",
      reference: "FAC-155",
      montantHT: ttcCHF,
      tauxTVA: 0,
      montantTVA: 0,
      montantTTC: ttcCHF,
      tvaRecuperable: false,
      methodPaiement: "VIREMENT",
      statutPaiement: "EN_ATTENTE", // pas encore débité au moment de l'enregistrement
      ocrUtilise: false,
      createdById: admin?.id ?? null,
    },
  });
  console.log(`✓ Charge créée : ${charge.id} (${ttcCHF} CHF TTC)`);

  // 4. Upload du PDF
  const pdfBuf = await readFile(SOURCE_PDF);
  const upload = await uploadFile({
    prefix: `expenses/${charge.id}`,
    filename: "Facture_155_ACLR.pdf",
    buffer: pdfBuf,
    contentType: "application/pdf",
  });
  await prisma.expense.update({
    where: { id: charge.id },
    data: { ticketUrl: upload.url, ticketName: "Facture_155_ACLR.pdf" },
  });
  console.log(`✓ Ticket uploadé : ${upload.url}`);

  // 5. Allocations
  // Pondération basée sur les détails de la facture :
  // 200/480 → SP Industriel (Forfait)  → 41.67 % → 190.00 CHF
  // 280/480 → Passeport Beauté          → 58.33 % → 266.00 CHF
  const allocSP = Math.round((200 / 480) * ttcCHF * 100) / 100; // 190.00
  const allocPP = Math.round((ttcCHF - allocSP) * 100) / 100;    // 266.00

  await prisma.expenseAllocation.createMany({
    data: [
      {
        expenseId: charge.id,
        prospectId: spIndustriel.id,
        montantHT: allocSP,
        note: "Forfait (200 EUR HT / 480 détaillés)",
      },
      {
        expenseId: charge.id,
        prospectId: passeport.id,
        montantHT: allocPP,
        note: "4 reels x 2 réseaux + 4 carrousels x 2 réseaux + 4 story (280 EUR HT)",
      },
    ],
  });
  console.log(`✓ Allocations : SP=${allocSP} / PP=${allocPP} (total=${allocSP + allocPP})`);

  // 6. Affichage final
  const final = await prisma.expense.findUnique({
    where: { id: charge.id },
    include: {
      allocations: { include: { prospect: { select: { raisonSociale: true } } } },
    },
  });
  console.log(`\n=== Charge Lucas Mai 2026 ===`);
  console.log(`  ID : ${final?.id}`);
  console.log(`  Description : ${final?.description}`);
  console.log(`  Montant TTC : ${Number(final?.montantTTC).toFixed(2)} CHF`);
  console.log(`  Statut : ${final?.statutPaiement}`);
  console.log(`  Ticket : ${final?.ticketUrl}`);
  console.log(`  Allocations :`);
  for (const a of final?.allocations ?? []) {
    console.log(
      `    - ${a.prospect.raisonSociale.padEnd(20)} ${Number(a.montantHT).toFixed(2).padStart(8)} CHF`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
