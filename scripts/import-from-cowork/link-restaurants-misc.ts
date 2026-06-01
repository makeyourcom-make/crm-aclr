/**
 * Lot restaurants + admin (mai 2026) :
 *
 *   PDFs :
 *     - 58437605-...2350.pdf       → ATTACH CFF Avril (quittance officielle 292 CHF)
 *     - 5562038676.pdf             → MAIN  Google ADS - Budget clients (Avril)
 *     - Claude 1.pdf               → MAIN  Claude Pro (mars 2026) 18.41 CHF
 *
 *   JPGs restaurants (hypothèses basées sur les libellés des fichiers) :
 *     - Invitation Client - Repas Avril 2026.jpeg → Restaurant Invitation client (Bistrot Le 120) 132.53 CHF
 *     - Repas.jpeg                                 → Restaurant Fratellini JV (Avril) 26.60 CHF
 *     - Avril Clients.jpg                          → Restaurant Burger Fratellini EENK (Avril) 19.76 CHF
 *     - Avril Clients 1.jpg                        → Restaurant Burger King Publier (Avril) 26.36 CHF
 *     - Café Clients.jpeg                          → ATTACH Frais représentation Moutarlier Noville 9.80 CHF (ticket 1)
 *     - Café Clientss.jpeg                         → ATTACH Frais représentation Moutarlier Noville (ticket 2)
 *
 *   NOUVELLES CHARGES (à créer) :
 *     - McDonald's Anthy 18/05  55.99 EUR → 53.19 CHF (photo inline, pas de JPG fichier listé)
 *     - Facture Case Postale Standard 120 CHF (date 14.04.2026) — formal invoice → 2e attachment sur Case postale Standard
 *     - Lettre relance CFE 156 EUR → 148.20 CHF (May, Impôts) → soit attachment soit nouvelle charge
 *
 * NOTE : les fichiers "ACLR.jpeg" et "Ticket Déplacement.jpeg" non utilisés ici.
 */
import { PrismaClient } from "@prisma/client";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

const prisma = new PrismaClient();
const SOURCE = "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\09. Charges";
const PUBLIC = "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\04. Make Your Com\\CRM\\public\\expenses";

async function findByDesc(description: string) {
  return prisma.expense.findFirst({ where: { description } });
}

async function copyToPublic(expenseId: string, filename: string) {
  const src = join(SOURCE, filename);
  const s = await stat(src);
  const dir = join(PUBLIC, expenseId);
  await mkdir(dir, { recursive: true });
  await copyFile(src, join(dir, filename));
  return { size: s.size };
}

async function linkMain(description: string, filename: string) {
  const exp = await findByDesc(description);
  if (!exp) {
    console.log(`  ⊘ Pas trouvé : "${description}"`);
    return null;
  }
  if (exp.ticketUrl) {
    console.log(`  ⚠ Déjà un ticket sur "${description}", j'attache à la place.`);
    return attachTo(exp.id, filename, "FACTURE", description);
  }
  await copyToPublic(exp.id, filename);
  await prisma.expense.update({
    where: { id: exp.id },
    data: {
      ticketUrl: `/expenses/${exp.id}/${filename}`,
      ticketName: filename,
    },
  });
  console.log(`  ✓ MAIN   ${filename.padEnd(50)} → ${description}`);
  return exp.id;
}

async function attachTo(expenseId: string, filename: string, kind: string, label: string) {
  const { size } = await copyToPublic(expenseId, filename);
  await prisma.expenseAttachment.create({
    data: {
      expenseId,
      fileUrl: `/expenses/${expenseId}/${filename}`,
      fileName: filename,
      fileSize: size,
      kind,
    },
  });
  console.log(`  + ATTACH ${filename.padEnd(50)} → ${label}  (${kind})`);
  return expenseId;
}

async function attachByDesc(description: string, filename: string, kind: string) {
  const exp = await findByDesc(description);
  if (!exp) {
    console.log(`  ⊘ Pas trouvé : "${description}"`);
    return null;
  }
  return attachTo(exp.id, filename, kind, description);
}

async function main() {
  console.log("=== PDFs ===");

  // 1. CFF Quittance — ATTACH sur CFF Avril (la charge a déjà 2 tickets)
  // Description exacte à vérifier
  const cff = await prisma.expense.findFirst({
    where: {
      OR: [
        { description: { contains: "Abonnement CFF", mode: "insensitive" } },
        { description: { contains: "CFF", mode: "insensitive" } },
      ],
      date: {
        gte: new Date("2026-04-01T00:00:00Z"),
        lt: new Date("2026-05-15T00:00:00Z"),
      },
    },
  });
  if (cff) {
    await attachTo(
      cff.id,
      "58437605-9c07-487e-b6fd-b0e22bcd2350.pdf",
      "FACTURE",
      cff.description ?? "CFF",
    );
  } else {
    console.log("  ⊘ Charge CFF non trouvée");
  }

  // 2. Google Ads facture 5562038676 (1884.14 EUR → 1789.93 CHF) — Avril 2026
  await linkMain(
    "Google ADS - Budget clients (Avril 2026)",
    "5562038676.pdf",
  );

  // 3. Claude Pro mars 2026 (21.62 USD → 18.41 CHF)
  await linkMain("Claude Pro (mars 2026)", "Claude 1.pdf");

  console.log("\n=== Restaurants (JPGs) ===");

  // 4. Invitation Client — Bistrot Le 120 (139.50 EUR = 132.53 CHF) 14/04
  await linkMain(
    "Restaurant - Invitation client (Avril 2026)",
    "Invitation Client - Repas Avril 2026.jpeg",
  );

  // 5. Fratellini JV (28 EUR = 26.60 CHF) 18/04 — hypothèse "Repas.jpeg"
  await linkMain(
    "Restaurant - Fratellini JV (Avril 2026)",
    "Repas.jpeg",
  );

  // 6. Burger Fratellini EENK (20.80 EUR = 19.76 CHF) 18/04 — hypothèse "Avril Clients.jpg"
  await linkMain(
    "Restaurant - Burger Fratellini EENK (Avril 2026)",
    "Avril Clients.jpg",
  );

  // 7. Burger King Publier (27.75 EUR = 26.36 CHF) 26/04 — hypothèse "Avril Clients 1.jpg"
  await linkMain(
    "Restaurant - Burger King Publier (Avril 2026)",
    "Avril Clients 1.jpg",
  );

  // 8. Moutarlier Noville x2 (4.90 + 4.90 = 9.80 CHF) 27/05
  const moutarlier = await findByDesc(
    "Frais représentation - RDV recrutement commerciale Noville (Mai 2026)",
  );
  if (moutarlier) {
    if (!moutarlier.ticketUrl) {
      await copyToPublic(moutarlier.id, "Café Clients.jpeg");
      await prisma.expense.update({
        where: { id: moutarlier.id },
        data: {
          ticketUrl: `/expenses/${moutarlier.id}/Café Clients.jpeg`,
          ticketName: "Café Clients.jpeg",
        },
      });
      console.log(
        `  ✓ MAIN   Café Clients.jpeg                                   → Moutarlier ticket 1`,
      );
    } else {
      await attachTo(moutarlier.id, "Café Clients.jpeg", "RECU_CARTE", "Moutarlier 1");
    }
    await attachTo(moutarlier.id, "Café Clientss.jpeg", "RECU_CARTE", "Moutarlier 2");
  } else {
    console.log("  ⊘ Frais représentation Noville non trouvée");
  }

  console.log("\n=== Nouvelle charge : McDonald's Anthy (photo inline) ===");

  // 9. McDonald's Anthy-sur-Léman — déjà existante ou à créer ?
  // Cherchons d'abord.
  const mcdo = await prisma.expense.findFirst({
    where: {
      description: { contains: "McDonald", mode: "insensitive" },
      date: {
        gte: new Date("2026-05-01T00:00:00Z"),
        lt: new Date("2026-06-01T00:00:00Z"),
      },
    },
  });
  if (mcdo) {
    console.log(
      `  ℹ McDonald's Mai existe : "${mcdo.description}" (${Number(mcdo.montantTTC).toFixed(2)} CHF)`,
    );
    console.log(`    → photo inline non-fichier, à uploader manuellement depuis l'interface.`);
  } else {
    console.log(
      `  ℹ Aucune charge McDonald's Mai trouvée — à créer manuellement (55.99 EUR ~ 53.19 CHF).`,
    );
  }

  console.log("\n=== Compléments admin (photos inline → à créer/attacher) ===");

  // 10. Facture Case Postale Standard 120 CHF
  const casePostale = await prisma.expense.findFirst({
    where: {
      description: { contains: "Case postale", mode: "insensitive" },
      date: { lt: new Date("2026-05-01T00:00:00Z") },
    },
  });
  if (casePostale) {
    console.log(
      `  ℹ Case postale existe : "${casePostale.description}" (${Number(casePostale.montantTTC).toFixed(2)} CHF) — la facture officielle est inline, à uploader manuellement.`,
    );
  } else {
    console.log("  ℹ Pas de charge Case postale trouvée.");
  }

  // 11. Lettre relance CFE 156 EUR
  const cfe = await prisma.expense.findFirst({
    where: {
      OR: [
        { description: { contains: "CFE", mode: "insensitive" } },
        { description: { contains: "Cotisation foncière", mode: "insensitive" } },
      ],
    },
  });
  if (cfe) {
    console.log(
      `  ℹ CFE existe : "${cfe.description}" (${Number(cfe.montantTTC).toFixed(2)} CHF) — relance inline à uploader manuellement.`,
    );
  } else {
    console.log("  ℹ Pas de charge CFE trouvée — à créer (149+7 majoration = 156 EUR ~ 148.20 CHF).");
  }

  console.log("\n=== Stats finales ===");
  const total = await prisma.expense.count();
  const withTicket = await prisma.expense.count({ where: { ticketUrl: { not: null } } });
  console.log(`${withTicket}/${total} charges avec ticket principal.`);

  console.log("\n✓ Lot restaurants + divers terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
