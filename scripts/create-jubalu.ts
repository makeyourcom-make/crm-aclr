/**
 * Crée la fiche client Jubalu (Boulangerie Bretteau, Paris 7e).
 * SIREN 937588572, SASU créée 21/11/2024, président Sébastien Bretteau.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Vérifie si déjà créé
  const existing = await prisma.prospect.findFirst({
    where: {
      OR: [
        { raisonSociale: { contains: "Jubalu", mode: "insensitive" } },
        { raisonSociale: { contains: "Bretteau", mode: "insensitive" } },
      ],
    },
  });
  if (existing) {
    console.log(`✗ Prospect déjà existant : ${existing.raisonSociale} (id=${existing.id})`);
    return;
  }

  // Trouve un user pour assigner (le 1er admin / propriétaire)
  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  const created = await prisma.prospect.create({
    data: {
      raisonSociale: "JUBALU (Boulangerie Bretteau)",
      contactPrenom: "Sébastien",
      contactNom: "Bretteau",
      contactFonction: "Président SASU — Boulanger",
      email: "boulangerie.bretteau@gmail.com",
      telephone: "+33 6 82 83 03 69",
      adresse: "31 Avenue de la Motte-Picquet",
      codePostal: "75007",
      ville: "Paris",
      pays: "France",
      numeroIDE: "93758857200019", // SIRET français
      numeroTVA: "FR80937588572",
      siteWeb: "https://www.boulangerie-bretteau.fr/",
      facebook: "https://www.facebook.com/boulangerieSBretteau/",
      instagram: "https://www.instagram.com/boulangeriebretteau/",
      secteur: "ARTISAN",
      source: "REFERRAL",
      statut: "NOUVEAU",
      assigneAId: user?.id,
      notesGenerales: [
        "SASU créée le 21/11/2024 — capital 1 000 €",
        "Code NAF 1071C (Boulangerie & boulangerie-pâtisserie)",
        "TikTok : https://www.tiktok.com/@clairebretteau (Claire Bretteau — voix réseaux sociaux)",
        "Sources : societe.com (SIREN 937588572)",
      ].join("\n"),
    },
  });

  console.log(`✓ Prospect créé : ${created.raisonSociale} (id=${created.id})`);
  console.log(`  Adresse  : ${created.adresse}, ${created.codePostal} ${created.ville}, ${created.pays}`);
  console.log(`  SIRET    : ${created.numeroIDE}`);
  console.log(`  TVA      : ${created.numeroTVA}`);
  console.log(`  Contact  : ${created.contactPrenom} ${created.contactNom} — ${created.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
