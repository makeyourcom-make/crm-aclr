import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Enrichit deux enums Postgres (additif, non destructif) :
 *   - ProspectSource : ajout de CRM (source par défaut de toutes les fiches),
 *     INSTAGRAM, FACEBOOK, DIRECT. On conserve FICHIER_IMPORT / AUTRE pour les
 *     fiches historiques.
 *   - ProspectSecteur : liste réaliste inspirée des rubriques principales de
 *     local.ch (restauration, santé, beauté, construction, automobile, etc.).
 *
 * `ALTER TYPE ... ADD VALUE IF NOT EXISTS` est idempotent et s'exécute hors
 * transaction (autocommit via $executeRawUnsafe) — compatible pooler Neon.
 */
const SOURCE_VALUES = ["CRM", "INSTAGRAM", "FACEBOOK", "DIRECT"];

const SECTEUR_VALUES = [
  "ALIMENTATION",
  "COMMERCE_DETAIL",
  "BEAUTE",
  "SANTE",
  "SPORT_FITNESS",
  "CONSTRUCTION",
  "AUTOMOBILE",
  "SERVICES_ENTREPRISE",
  "FIDUCIAIRE_FINANCE",
  "INFORMATIQUE",
  "INDUSTRIE",
  "TRANSPORT",
  "FORMATION",
  "EVENEMENTIEL",
  "AGRICULTURE",
  "ASSOCIATION",
];

async function main() {
  for (const v of SOURCE_VALUES) {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "ProspectSource" ADD VALUE IF NOT EXISTS '${v}'`,
    );
    console.log(`ProspectSource += ${v}`);
  }
  for (const v of SECTEUR_VALUES) {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "ProspectSecteur" ADD VALUE IF NOT EXISTS '${v}'`,
    );
    console.log(`ProspectSecteur += ${v}`);
  }

  const src = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'ProspectSource' ORDER BY e.enumsortorder`,
  );
  const sec = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'ProspectSecteur' ORDER BY e.enumsortorder`,
  );
  console.log("Source  :", src.map((r) => r.enumlabel).join(", "));
  console.log("Secteur :", sec.map((r) => r.enumlabel).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
