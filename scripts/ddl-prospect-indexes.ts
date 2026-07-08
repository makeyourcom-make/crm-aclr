import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Index composites additifs pour accélérer la liste prospects (~89k lignes) :
 * tri par défaut createdAt DESC, scopé par assigneAId (RLS commercial) ou
 * filtré par statut (admin). Noms alignés sur la convention Prisma pour rester
 * cohérent avec `@@index` dans le schema. Non-CONCURRENTLY : build de quelques
 * secondes sur 89k lignes, compatible pooler Neon.
 */
const STATEMENTS = [
  `CREATE INDEX IF NOT EXISTS "prospects_createdAt_idx" ON "prospects" ("createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "prospects_assigneAId_createdAt_idx" ON "prospects" ("assigneAId", "createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS "prospects_statut_createdAt_idx" ON "prospects" ("statut", "createdAt" DESC)`,
];

async function main() {
  for (const sql of STATEMENTS) {
    const t = Date.now();
    await prisma.$executeRawUnsafe(sql);
    console.log(`ok (${Date.now() - t}ms): ${sql.match(/"(prospects_[a-zA-Z_]+)"/)?.[1]}`);
  }
  const idx = await prisma.$queryRawUnsafe<{ indexname: string }[]>(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'prospects' AND indexname LIKE 'prospects_%createdAt%' ORDER BY indexname`,
  );
  console.log("index créés :", idx.map((i) => i.indexname).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
