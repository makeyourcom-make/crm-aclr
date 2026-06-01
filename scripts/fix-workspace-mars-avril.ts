/**
 * Corrige les charges Google Workspace :
 *   - Charge "Workspace Mai 77.08" = en réalité PAIEMENT cumulé Mars + Avril
 *     → supprimer
 *   - Charge "Workspace Avril 13.99" (estim) → ajuster à 38.54 CHF + facture Avril
 *   - Créer "Workspace Mars 38.54" + facture Mars
 *
 * Les 2 charges sont rattachées au prospect "M A K E & Beyond" (refacturation
 * du Workspace make-marketing.ch).
 *
 * Conversion EUR→CHF taux jour 05.05.2026 : 0.991
 *   38.88 EUR × 0.991 = 38.54 CHF par mois
 *   Total 2 mois = 77.08 CHF (match exact débit UBS)
 */
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

import { uploadFile, deleteFile } from "@/lib/file-storage";

const prisma = new PrismaClient();

const FACTURE_MARS = "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\09. Charges\\GCFRD0012266710.pdf";
const FACTURE_AVRIL = "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\09. Charges\\GCFRD0012643051.pdf";

async function main() {
  // 1. Trouve le prospect M A K E & Beyond
  const beyond = await prisma.prospect.findFirst({
    where: { raisonSociale: { contains: "Beyond", mode: "insensitive" } },
  });
  if (!beyond) throw new Error("Prospect M A K E & Beyond introuvable");
  console.log(`Prospect cible : ${beyond.raisonSociale} (${beyond.id})`);

  // 2. Supprime la charge mal nommée "Workspace Mai 77.08"
  const workspaceMai = await prisma.expense.findFirst({
    where: {
      description: { contains: "Google Workspace Business Standard (Mai 2026)" },
    },
    include: { attachments: true },
  });
  if (workspaceMai) {
    console.log(`\nSuppression de "${workspaceMai.description}" (${workspaceMai.montantTTC} CHF)...`);
    if (workspaceMai.ticketUrl) await deleteFile(workspaceMai.ticketUrl);
    for (const a of workspaceMai.attachments) await deleteFile(a.fileUrl);
    await prisma.expense.delete({ where: { id: workspaceMai.id } });
    console.log(`  ✓ Supprimé`);
  } else {
    console.log(`  ⊘ Charge "Workspace Mai 77.08" non trouvée (peut-être déjà supprimée)`);
  }

  // 3. Ajuste la charge "Workspace Avril" existante (13.99 estim → 38.54 CHF)
  const workspaceAvril = await prisma.expense.findFirst({
    where: {
      description: { contains: "Google Workspace Business Standard (Avril 2026)" },
    },
    include: { attachments: true },
  });
  if (workspaceAvril) {
    console.log(`\nAjustement "Workspace Avril" : ${workspaceAvril.montantTTC} → 38.54 CHF`);
    await prisma.expense.update({
      where: { id: workspaceAvril.id },
      data: {
        date: new Date("2026-04-30"),
        dateReglement: new Date("2026-05-05"),
        statutPaiement: "PAYE",
        montantHT: 32.10, // 32.40 EUR × 0.991 = 32.10 CHF
        tauxTVA: 0.20,
        montantTVA: 6.44, // 6.48 EUR × 0.991 = 6.44 CHF
        montantTTC: 38.54,
        tvaRecuperable: false, // TVA française non récupérable côté CH
        description:
          "Google Workspace Business Standard - Avril 2026 (make-marketing.ch) — 38.88 EUR @ 0.991 = 38.54 CHF",
        reference: "GCFRD0012643051",
        prospectId: beyond.id,
      },
    });
    console.log(`  ✓ Montant ajusté + dateReglement 05.05 + rattaché M A K E & Beyond`);

    // Re-attache la facture Avril si elle a été supprimée
    const hasTicket = workspaceAvril.ticketUrl !== null;
    if (!hasTicket) {
      const buf = await readFile(FACTURE_AVRIL);
      const up = await uploadFile({
        prefix: `expenses/${workspaceAvril.id}`,
        filename: "GCFRD0012643051.pdf",
        buffer: buf,
        contentType: "application/pdf",
      });
      await prisma.expense.update({
        where: { id: workspaceAvril.id },
        data: { ticketUrl: up.url, ticketName: "GCFRD0012643051.pdf" },
      });
      console.log(`  ✓ Facture Avril GCFRD0012643051 attachée`);
    } else {
      console.log(`  ≡ Facture Avril déjà attachée (${workspaceAvril.ticketUrl})`);
    }
  } else {
    console.log(`  ⊘ Charge "Workspace Avril" non trouvée (à créer)`);
  }

  // 4. Crée la charge "Workspace Mars" (n'existait pas)
  const existingMars = await prisma.expense.findFirst({
    where: {
      description: { contains: "Google Workspace Business Standard - Mars 2026" },
    },
  });
  if (existingMars) {
    console.log(`\n≡ Workspace Mars existe déjà : ${existingMars.id}`);
  } else {
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    const mars = await prisma.expense.create({
      data: {
        date: new Date("2026-03-31"),
        dateReglement: new Date("2026-05-05"),
        statutPaiement: "PAYE",
        categorie: "SOFTWARE_SAAS",
        fournisseur: "Google",
        description:
          "Google Workspace Business Standard - Mars 2026 (make-marketing.ch) — 38.88 EUR @ 0.991 = 38.54 CHF",
        reference: "GCFRD0012266710",
        montantHT: 32.10,
        tauxTVA: 0.20,
        montantTVA: 6.44,
        montantTTC: 38.54,
        tvaRecuperable: false,
        methodPaiement: "CARTE_BANCAIRE",
        ocrUtilise: false,
        prospectId: beyond.id,
        createdById: admin?.id ?? null,
      },
    });
    console.log(`\n+ Workspace Mars créé : ${mars.id} (38.54 CHF) rattaché M A K E & Beyond`);

    // Upload facture Mars
    const buf = await readFile(FACTURE_MARS);
    const up = await uploadFile({
      prefix: `expenses/${mars.id}`,
      filename: "GCFRD0012266710.pdf",
      buffer: buf,
      contentType: "application/pdf",
    });
    await prisma.expense.update({
      where: { id: mars.id },
      data: { ticketUrl: up.url, ticketName: "GCFRD0012266710.pdf" },
    });
    console.log(`  ✓ Facture Mars GCFRD0012266710 attachée`);
  }

  // 5. Récap final
  console.log("\n=== Vérification finale ===");
  const allWorkspace = await prisma.expense.findMany({
    where: {
      description: { contains: "Google Workspace", mode: "insensitive" },
    },
    select: {
      id: true,
      description: true,
      montantTTC: true,
      dateReglement: true,
      statutPaiement: true,
      ticketUrl: true,
      prospect: { select: { raisonSociale: true } },
    },
    orderBy: { date: "asc" },
  });
  for (const w of allWorkspace) {
    console.log(
      `  ${w.description?.slice(0, 65).padEnd(65)} ${Number(w.montantTTC).toFixed(2).padStart(7)} CHF [${w.statutPaiement}] → ${w.prospect?.raisonSociale ?? "interne"}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
