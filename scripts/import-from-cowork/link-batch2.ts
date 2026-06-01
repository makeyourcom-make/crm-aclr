/**
 * Lot #2 :
 *   - GCFRD0012643051.pdf       → complément Workspace Avril
 *   - Invoice-GJYLUZ-00007 .pdf  → complément Netlify Crédit 23/04
 *   - Invoice-GJYLUZ-00008 .pdf  → complément Netlify Crédit 28/04
 *   - Invoice-GJYLUZ-00009 .pdf  → complément Netlify Crédit 3000 28/04
 *   - Invoice-GJYLUZ-00010 .pdf  → ticket principal Netlify Base Plan Mai
 *   - facture-2701672.pdf       → NOUVELLE charge LWS marketing-externe.com
 */
import { PrismaClient } from "@prisma/client";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

const prisma = new PrismaClient();
const SOURCE = "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\09. Charges";
const PUBLIC = "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\04. Make Your Com\\CRM\\public\\expenses";

async function attach(expenseId: string, filename: string, kind: string) {
  const src = join(SOURCE, filename);
  const s = await stat(src);
  const dir = join(PUBLIC, expenseId);
  await mkdir(dir, { recursive: true });
  await copyFile(src, join(dir, filename));
  await prisma.expenseAttachment.create({
    data: {
      expenseId,
      fileUrl: `/expenses/${expenseId}/${filename}`,
      fileName: filename,
      fileSize: s.size,
      kind,
    },
  });
  console.log(`  + ATTACH  ${filename}  (${kind})`);
}

async function linkPrimary(expenseId: string, filename: string) {
  const src = join(SOURCE, filename);
  const dir = join(PUBLIC, expenseId);
  await mkdir(dir, { recursive: true });
  await copyFile(src, join(dir, filename));
  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      ticketUrl: `/expenses/${expenseId}/${filename}`,
      ticketName: filename,
    },
  });
  console.log(`  ✓ MAIN    ${filename}`);
}

async function main() {
  // === Complément Workspace Avril (GCFRD0012643051)
  const wsAvril = await prisma.expense.findFirst({
    where: { description: "Google Workspace Business Standard (Avril 2026)" },
  });
  if (wsAvril) {
    console.log(`→ Workspace Avril :`);
    await attach(wsAvril.id, "GCFRD0012643051.pdf", "FACTURE");
  }

  // === Compléments Netlify Crédit 8.95 du 23/04 (GJYLUZ-00007)
  // Il y a 2 entrées "Netlify - Crédit achat (Avril 2026)" 8.95 CHF
  // (dates 23/04 et 28/04). On les distingue par date.
  const netlify_23_04 = await prisma.expense.findFirst({
    where: {
      description: "Netlify - Crédit achat (Avril 2026)",
      date: new Date("2026-04-23T00:00:00Z"),
    },
  });
  if (netlify_23_04) {
    console.log(`→ Netlify Crédit 8.95 (23/04) :`);
    await attach(
      netlify_23_04.id,
      "Invoice-GJYLUZ-00007 - Netlify.pdf",
      "FACTURE",
    );
  }

  const netlify_28_04 = await prisma.expense.findFirst({
    where: {
      description: "Netlify - Crédit achat (Avril 2026)",
      date: new Date("2026-04-28T00:00:00Z"),
    },
  });
  if (netlify_28_04) {
    console.log(`→ Netlify Crédit 8.95 (28/04) :`);
    await attach(
      netlify_28_04.id,
      "Invoice-GJYLUZ-00008 Netlify.pdf",
      "FACTURE",
    );
  }

  const netlify3000_28_04 = await prisma.expense.findFirst({
    where: {
      description: "Netlify - Crédit achat 3000 (Avril 2026)",
      date: new Date("2026-04-28T00:00:00Z"),
    },
  });
  if (netlify3000_28_04) {
    console.log(`→ Netlify Crédit 3000 (28/04) :`);
    await attach(
      netlify3000_28_04.id,
      "Invoice-GJYLUZ-00009.pdf",
      "FACTURE",
    );
  }

  // === Ticket principal Netlify Base Plan Mai (GJYLUZ-00010, $20.00)
  const netlifyBase = await prisma.expense.findFirst({
    where: { description: "Netlify - Base Plan + crédits (Mai 2026)" },
  });
  if (netlifyBase) {
    console.log(`→ Netlify Base Plan Mai :`);
    await linkPrimary(netlifyBase.id, "Invoice-GJYLUZ-00010.pdf");
  }

  // === NOUVELLE charge LWS marketing-externe.com
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const montant = Math.round(13.99 * 0.95 * 100) / 100; // 13.29
  const newLws = await prisma.expense.create({
    data: {
      date: new Date("2026-05-15T00:00:00Z"),
      categorie: "SOFTWARE_SAAS",
      fournisseur: "LWS",
      description: "LWS - Nom de domaine marketing-externe.com (12 mois)",
      reference: "FC-2701672",
      montantHT: montant,
      tauxTVA: 0,
      montantTVA: 0,
      montantTTC: montant,
      tvaRecuperable: false,
      methodPaiement: "CARTE_BANCAIRE",
      ocrUtilise: false,
      createdById: admin?.id ?? null,
    },
  });
  console.log(`\n+ NOUVELLE charge LWS marketing-externe.com (${montant} CHF)`);
  await linkPrimary(newLws.id, "facture-2701672.pdf");

  console.log("\n✓ Lot #2 terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
