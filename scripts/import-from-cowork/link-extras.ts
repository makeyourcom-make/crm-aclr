/**
 * 1. Attache le reçu Visa CFF à la charge CFF existante (en plus de la facture)
 * 2. Crée une nouvelle charge LWS cmo-suisse.com (13.99 EUR = 13.29 CHF)
 *    et y joint le PDF "LWS - Nom de domaine.pdf"
 */
import { PrismaClient } from "@prisma/client";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

const prisma = new PrismaClient();
const SOURCE_DIR = "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\09. Charges";
const PUBLIC = "C:\\Users\\Admin\\Desktop\\HOME\\10. M A K E\\04. Make Your Com\\CRM\\public\\expenses";

async function attachAdditional(
  expenseId: string,
  filename: string,
  kind: string,
) {
  const src = join(SOURCE_DIR, filename);
  const fileStat = await stat(src);
  const dir = join(PUBLIC, expenseId);
  await mkdir(dir, { recursive: true });
  await copyFile(src, join(dir, filename));
  await prisma.expenseAttachment.create({
    data: {
      expenseId,
      fileUrl: `/expenses/${expenseId}/${filename}`,
      fileName: filename,
      fileSize: fileStat.size,
      kind,
    },
  });
  console.log(`  ✓ Pièce jointe ajoutée : ${filename} (${kind})`);
}

async function main() {
  // === 1. CFF : ajouter le reçu Visa en pièce jointe complémentaire
  const cff = await prisma.expense.findFirst({
    where: { description: { contains: "Abonnement CFF" } },
  });
  if (cff) {
    console.log(`CFF trouvé : ${cff.description}`);
    await attachAdditional(
      cff.id,
      "receipt260504062857094460.pdf",
      "RECU_CARTE",
    );
  } else {
    console.log("⊘ Charge CFF introuvable");
  }

  // === 2. LWS cmo-suisse.com : créer la nouvelle charge
  // Date prise comme celle de la facture : on note "2026" sans mois précis
  // → date placeholder = aujourd'hui pour qu'elle apparaisse. Le user pourra
  //   l'ajuster dans /charges via le formulaire d'édition.
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const montantEUR = 13.99;
  const montantCHF = Math.round(montantEUR * 0.95 * 100) / 100; // 13.29
  // Comme la date n'est pas dans le PDF, on prend mai 2026 par défaut (entre la
  // facture cmo-suisse.ch d'avril et la facture cmo-suisse.com de mai déjà connues)
  const date = new Date("2026-05-15T00:00:00.000Z");

  const lws = await prisma.expense.create({
    data: {
      date,
      categorie: "SOFTWARE_SAAS",
      fournisseur: "LWS",
      description: "LWS - Nom de domaine cmo-suisse.com (Mai 2026) - 12 mois",
      reference: "(à compléter)",
      montantHT: montantCHF,
      tauxTVA: 0,
      montantTVA: 0,
      montantTTC: montantCHF,
      tvaRecuperable: false,
      methodPaiement: "CARTE_BANCAIRE",
      ocrUtilise: false,
      createdById: admin?.id ?? null,
    },
  });
  console.log(`\n✓ Nouvelle charge LWS créée : ${lws.id}`);
  console.log(`  Montant : ${montantEUR} EUR × 0.95 = ${montantCHF} CHF`);
  console.log(`  Date par défaut : ${date.toISOString().slice(0, 10)} (à ajuster si besoin)`);

  // Lie le PDF en tant que ticket principal
  const filename = "LWS - Nom de domaine.pdf";
  const dir = join(PUBLIC, lws.id);
  await mkdir(dir, { recursive: true });
  await copyFile(join(SOURCE_DIR, filename), join(dir, filename));
  await prisma.expense.update({
    where: { id: lws.id },
    data: {
      ticketUrl: `/expenses/${lws.id}/${filename}`,
      ticketName: filename,
    },
  });
  console.log(`✓ Ticket principal lié : ${filename}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
