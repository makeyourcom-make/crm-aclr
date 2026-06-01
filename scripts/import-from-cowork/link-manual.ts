/**
 * Lie manuellement quelques fichiers identifiés par lecture humaine du contenu PDF.
 */
import { PrismaClient } from "@prisma/client";
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const prisma = new PrismaClient();
const SOURCE_DIR =
  "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\09. Charges";
const PUBLIC = "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\04. Make Your Com\\CRM\\public\\expenses";

// Mappings manuels (fichier → critère DB)
const MAP: Array<{
  file: string;
  match: { description: string; date: string };
}> = [
  {
    file: "receipt-2026-04-23T13_41_56.112Z.pdf",
    match: { description: "Netlify - Crédit achat (Avril 2026)", date: "2026-04-23" },
  },
  {
    file: "receipt-2026-04-28T05_38_08.275Z.pdf",
    match: { description: "Netlify - Crédit achat (Avril 2026)", date: "2026-04-28" },
  },
  {
    file: "receipt-2026-04-28T07_17_27.762Z.pdf",
    match: { description: "Netlify - Crédit achat 3000 (Avril 2026)", date: "2026-04-28" },
  },
  {
    file: "Netlify.pdf",
    match: { description: "Netlify (mars 2026)", date: "2026-03-30" },
  },
];

async function main() {
  for (const m of MAP) {
    const exp = await prisma.expense.findFirst({
      where: {
        description: m.match.description,
        date: new Date(m.match.date + "T00:00:00Z"),
        ticketUrl: null,
      },
    });
    if (!exp) {
      console.log(`  ⊘ Pas trouvé / déjà lié : ${m.file}`);
      continue;
    }
    const dir = join(PUBLIC, exp.id);
    await mkdir(dir, { recursive: true });
    await copyFile(join(SOURCE_DIR, m.file), join(dir, m.file));
    await prisma.expense.update({
      where: { id: exp.id },
      data: {
        ticketUrl: `/expenses/${exp.id}/${m.file}`,
        ticketName: m.file,
      },
    });
    console.log(`  ✓ ${m.file.padEnd(50)} → ${exp.description}`);
  }
}
main().finally(() => prisma.$disconnect());
