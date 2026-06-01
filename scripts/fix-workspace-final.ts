/**
 * Corrige les 2 derniers problèmes Workspace :
 *   1. Supprime l'ancienne charge "Google Workspace Business Standard (Mars 2026)"
 *      36.94 CHF (interne) qui est un doublon de la nouvelle charge Mars 38.54.
 *   2. Sur la charge "Workspace Avril", la facture attachée est en réalité
 *      GCFRD0012266710 (Mars) — il faut la remplacer par GCFRD0012643051 (Avril).
 */
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

import { uploadFile, deleteFile } from "@/lib/file-storage";

const prisma = new PrismaClient();
const FACTURE_AVRIL =
  "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\09. Charges\\GCFRD0012643051.pdf";

async function main() {
  // 1. Trouve et supprime l'ancienne charge Workspace Mars (sans rattachement)
  const oldMars = await prisma.expense.findFirst({
    where: {
      description: "Google Workspace Business Standard (Mars 2026)",
      prospectId: null, // l'ancienne version "interne"
    },
    include: { attachments: true },
  });
  if (oldMars) {
    console.log(
      `Suppression ancienne charge "${oldMars.description}" (${Number(oldMars.montantTTC).toFixed(2)} CHF, interne)...`,
    );
    if (oldMars.ticketUrl) await deleteFile(oldMars.ticketUrl);
    for (const a of oldMars.attachments) await deleteFile(a.fileUrl);
    await prisma.expense.delete({ where: { id: oldMars.id } });
    console.log(`  ✓ Supprimé`);
  } else {
    console.log("  ⊘ Ancienne charge 'Workspace Mars interne' non trouvée (déjà supprimée ?)");
  }

  // 2. Corrige le ticket de la charge Workspace Avril
  const workspaceAvril = await prisma.expense.findFirst({
    where: {
      description: { contains: "Workspace Business Standard - Avril 2026" },
    },
  });
  if (!workspaceAvril) {
    console.log("⊘ Charge Workspace Avril non trouvée");
    return;
  }

  console.log(`\nCharge Workspace Avril : ${workspaceAvril.id}`);
  console.log(`  Ticket actuel : ${workspaceAvril.ticketUrl}`);

  // Si l'URL contient "GCFRD0012266710" ou "0012266710", c'est le mauvais (Mars)
  const isWrong =
    workspaceAvril.ticketUrl?.includes("0012266710") ||
    workspaceAvril.ticketName?.includes("0012266710");

  if (isWrong) {
    // Supprime le mauvais ticket
    if (workspaceAvril.ticketUrl) {
      await deleteFile(workspaceAvril.ticketUrl);
      console.log(`  ✓ Ancien ticket (Mars par erreur) supprimé du Blob`);
    }

    // Upload la vraie facture Avril
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
    console.log(`  ✓ Vraie facture Avril GCFRD0012643051 attachée`);
    console.log(`     ${up.url}`);
  } else {
    console.log(`  ≡ Le ticket actuel n'est pas le mauvais — rien à changer`);
  }

  // 3. Récap final
  console.log("\n=== État final Workspace ===");
  const all = await prisma.expense.findMany({
    where: { description: { contains: "Google Workspace", mode: "insensitive" } },
    select: {
      description: true,
      montantTTC: true,
      ticketName: true,
      statutPaiement: true,
      prospect: { select: { raisonSociale: true } },
    },
    orderBy: { date: "asc" },
  });
  for (const w of all) {
    console.log(
      `  ${(w.description ?? "").slice(0, 60).padEnd(62)} ${Number(w.montantTTC).toFixed(2).padStart(7)} CHF  ${w.ticketName ?? "(pas de ticket)"}`,
    );
    console.log(`     → ${w.prospect?.raisonSociale ?? "interne"} [${w.statutPaiement}]`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
