import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Recherche prospects (~124k lignes) : le `ILIKE '%q%'` multi-colonnes fait un
 * seq scan (~300 ms). On active pg_trgm + un index GIN trigramme par colonne
 * cherchée → le planner combine des bitmap index scans (BitmapOr) et la
 * recherche passe à quelques ms. Aucun changement de code (la requête Prisma
 * OR/contains reste identique).
 *
 * Non-CONCURRENTLY : le pooler Neon (PgBouncer transaction) ne supporte pas
 * CREATE INDEX CONCURRENTLY. Build de quelques secondes/colonne, bref verrou
 * en écriture — OK hors fenêtre de sync.
 */
const COLS = ["raisonSociale", "ville", "email", "contactNom", "contactPrenom"];

async function main() {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  console.log("extension pg_trgm ok");
  for (const col of COLS) {
    const idx = `prospects_${col}_trgm`;
    const t = Date.now();
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "${idx}" ON "prospects" USING gin ("${col}" gin_trgm_ops)`,
    );
    console.log(`ok (${Date.now() - t}ms): ${idx}`);
  }
  const idx = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'prospects' AND indexname LIKE '%_trgm' ORDER BY indexname`,
  );
  console.log("index trgm présents:", idx.map((i) => i.indexname).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
