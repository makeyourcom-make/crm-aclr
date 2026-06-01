/**
 * Lot Claude + divers — 9 fichiers, dont 5 Claude.
 */
import { PrismaClient } from "@prisma/client";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

const prisma = new PrismaClient();
const SOURCE = "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\09. Charges";
const PUBLIC = "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\04. Make Your Com\\CRM\\public\\expenses";

async function linkPrimary(filename: string, description: string) {
  const exp = await prisma.expense.findFirst({
    where: { description },
  });
  if (!exp) {
    console.log(`  ⊘ Pas trouvé : "${description}"`);
    return;
  }
  if (exp.ticketUrl) {
    // Déjà un ticket principal → on attache en complément
    const src = join(SOURCE, filename);
    const s = await stat(src);
    const dir = join(PUBLIC, exp.id);
    await mkdir(dir, { recursive: true });
    await copyFile(src, join(dir, filename));
    await prisma.expenseAttachment.create({
      data: {
        expenseId: exp.id,
        fileUrl: `/expenses/${exp.id}/${filename}`,
        fileName: filename,
        fileSize: s.size,
        kind: "FACTURE",
      },
    });
    console.log(`  + ATTACH ${filename.padEnd(45)} → ${description} (déjà ticket principal)`);
    return;
  }
  const dir = join(PUBLIC, exp.id);
  await mkdir(dir, { recursive: true });
  await copyFile(join(SOURCE, filename), join(dir, filename));
  await prisma.expense.update({
    where: { id: exp.id },
    data: {
      ticketUrl: `/expenses/${exp.id}/${filename}`,
      ticketName: filename,
    },
  });
  console.log(`  ✓ MAIN   ${filename.padEnd(45)} → ${description}`);
}

async function main() {
  const M: Array<[string, string]> = [
    ["Claude API .2.pdf", "Claude API - Auto-recharge credits (Avril 2026)"],
    ["Claude API.pdf", "Claude API - Crédit ponctuel (Avril 2026)"],
    ["Claude Avril 15.2026.pdf", "Claude IA Max Plan 20x - Upgrade (Avril 2026)"],
    ["Claude Avril 2026.pdf", "Claude IA Max Plan 5x (Avril 2026)"],
    ["Claude.pdf", "Claude IA Max Plan (mars 2026)"],
    ["Facture 7818010.pdf", "Infomaniak - Domaine + Mail arcoz-ag.ch (Mai 2026)"],
    ["Facture Make Automatisation.pdf", "Make - Extra opérations (Avril 2026)"],
    ["Facture Sunrise.pdf", "Sunrise - Mobile + Internet/TV (Mai 2026)"],
    ["Facture_150_ACLR.pdf", "Lucas - Community Manager (Avril 2026)"],
  ];
  for (const [fn, desc] of M) await linkPrimary(fn, desc);
  console.log("\n✓ Lot Claude + divers terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
