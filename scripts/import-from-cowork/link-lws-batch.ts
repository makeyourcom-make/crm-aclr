/**
 * Lot LWS — 10 factures, chacune liée à son domaine en DB.
 *
 * Particularités :
 *   - facture-2676531 couvre 4 domaines (srt-formation.fr + Laverie Nevers x3)
 *     → MAIN sur srt-formation.fr + ATTACH sur Laverie Nevers x3
 *   - facture-2701352 = DOUBLON SUSPECTÉ de FC-2697695 pour make-marketing.ch
 *     → ATTACH avec kind "LITIGE_DOUBLON" sur la charge make-marketing.ch
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

async function findByDesc(description: string) {
  return prisma.expense.findFirst({
    where: { description },
  });
}

async function main() {
  // === facture-2676514 → cmo-suisse.ch (Avril)
  const cmoCh = await findByDesc("LWS - Nom de domaine cmo-suisse.ch (Avril 2026)");
  if (cmoCh) {
    console.log(`→ cmo-suisse.ch (Avril) :`);
    await linkPrimary(cmoCh.id, "facture-2676514 - LWS.pdf");
  }

  // === facture-2676531 → srt-formation.fr + Laverie Nevers x3 (Avril)
  const srt = await findByDesc("LWS - Nom de domaine srt-formation.fr (Avril 2026)");
  const laverie = await findByDesc("LWS - Noms de domaine Laverie Nevers x3 (Avril 2026)");
  if (srt) {
    console.log(`→ srt-formation.fr (Avril) :`);
    await linkPrimary(srt.id, "facture-2676531 Avril.pdf");
  }
  if (laverie) {
    console.log(`→ Laverie Nevers x3 (Avril) :`);
    // ATTACH (la facture est principalement référencée sur srt-formation.fr)
    await attach(laverie.id, "facture-2676531 Avril.pdf", "FACTURE_PARTAGEE");
  }

  // === facture-2676651 → physio-montreux.ch TRANSFERT (Avril)
  const physio = await findByDesc("LWS - Transfert domaine physio-montreux.ch (Avril 2026)");
  if (physio) {
    console.log(`→ physio-montreux.ch transfert (Avril) :`);
    await linkPrimary(physio.id, "facture-2676651 LWS.pdf");
  }

  // === facture-2697695 → make-marketing.ch (Mai)
  const mkMarketing = await findByDesc("LWS - Nom de domaine make-marketing.ch (Mai 2026)");
  if (mkMarketing) {
    console.log(`→ make-marketing.ch (Mai) :`);
    await linkPrimary(mkMarketing.id, "facture-2697695 LWS.pdf");
  }

  // === facture-2700594 → qerkini.ch (Mai)
  const qerkini = await findByDesc("LWS - Nom de domaine qerkini.ch (Mai 2026)");
  if (qerkini) {
    console.log(`→ qerkini.ch (Mai) :`);
    await linkPrimary(qerkini.id, "facture-2700594.pdf");
  }

  // === facture-2700800 → responsable-marketing.ch (Mai)
  const responsableCh = await findByDesc("LWS - Nom de domaine responsable-marketing.ch (Mai 2026)");
  if (responsableCh) {
    console.log(`→ responsable-marketing.ch (Mai) :`);
    await linkPrimary(responsableCh.id, "facture-2700800.pdf");
  }

  // === facture-2700801 → marketing-externe.ch (Mai)
  const mktExterneCh = await findByDesc("LWS - Nom de domaine marketing-externe.ch (Mai 2026)");
  if (mktExterneCh) {
    console.log(`→ marketing-externe.ch (Mai) :`);
    await linkPrimary(mktExterneCh.id, "facture-2700801.pdf");
  }

  // === facture-2701352 → DOUBLON SUSPECTÉ make-marketing.ch (litige)
  if (mkMarketing) {
    console.log(`→ DOUBLON make-marketing.ch (litige) :`);
    await attach(
      mkMarketing.id,
      "facture-2701352.pdf",
      "LITIGE_DOUBLON",
    );
    // Ajoute une note sur l'Expense pour traçabilité
    const cur = await prisma.expense.findUnique({
      where: { id: mkMarketing.id },
      select: { description: true },
    });
    await prisma.expense.update({
      where: { id: mkMarketing.id },
      data: {
        description:
          (cur?.description ?? "") +
          " — ⚠ Litige doublon : FC-2701352 (21.05.2026) suspecté duplicate de FC-2697695 (17.05.2026)",
      },
    });
  }

  // === facture-2701668 → responsable-marketing.com (Mai)
  const responsableCom = await findByDesc("LWS - Nom de domaine responsable-marketing.com (Mai 2026)");
  if (responsableCom) {
    console.log(`→ responsable-marketing.com (Mai) :`);
    await linkPrimary(responsableCom.id, "facture-2701668.pdf");
  }

  // === facture-2701669 → marketing-externe.fr (Mai)
  const mktExterneFr = await findByDesc("LWS - Nom de domaine marketing-externe.fr (Mai 2026)");
  if (mktExterneFr) {
    console.log(`→ marketing-externe.fr (Mai) :`);
    await linkPrimary(mktExterneFr.id, "facture-2701669.pdf");
  }

  console.log("\n✓ Lot LWS terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
