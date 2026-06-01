/**
 * Annule les enrichissements faux (4 clients medium-confidence) :
 *   - SRT FORMATION : confondu avec Groupe SRT (faux)
 *   - Coiffure St Honoré : adresse trouvée fausse
 *   - Lionel Briquet : confondu avec un physiothérapeute (faux métier)
 *   - M A K E & Beyond : confondu avec mon propre business
 *
 * SOS Pneus reste tel quel (juste).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const FALSE_MATCHES = [
  "SRT FORMATION",
  "Coiffure St Honoré",
  "Lionel Briquet",
  "M A K E & Beyond",
];

async function main() {
  for (const name of FALSE_MATCHES) {
    const p = await prisma.prospect.findFirst({
      where: { raisonSociale: { contains: name, mode: "insensitive" } },
    });
    if (!p) {
      console.log(`✗ ${name} introuvable`);
      continue;
    }
    await prisma.prospect.update({
      where: { id: p.id },
      data: {
        adresse: null,
        codePostal: null,
        ville: null,
        canton: null,
        numeroIDE: null,
        numeroTVA: null,
        contactNom: null,
        contactPrenom: null,
        telephone: null,
        siteWeb: null,
      },
    });
    console.log(`✓ ${p.raisonSociale.padEnd(28)} → données effacées`);
  }
}
main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
