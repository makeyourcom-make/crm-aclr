/**
 * Table email_block_rules — règles anti-spam pour les emails entrants.
 * DDL 100% additif (CREATE TABLE/TYPE/INDEX IF NOT EXISTS).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "EmailBlockType" AS ENUM ('SENDER','DOMAIN','SUBJECT');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "email_block_rules" (
      "id"        TEXT PRIMARY KEY,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "type"      "EmailBlockType" NOT NULL,
      "value"     TEXT NOT NULL,
      "actif"     BOOLEAN NOT NULL DEFAULT true,
      "creeParId" TEXT,
      "nbBloques" INTEGER NOT NULL DEFAULT 0
    )
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "email_block_rules"
        ADD CONSTRAINT "email_block_rules_creeParId_fkey"
        FOREIGN KEY ("creeParId") REFERENCES "users"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "email_block_rules_type_value_key" ON "email_block_rules" ("type","value")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "email_block_rules_actif_idx" ON "email_block_rules" ("actif")`);
  const cols = await prisma.$queryRawUnsafe<{column_name:string}[]>(`SELECT column_name FROM information_schema.columns WHERE table_name='email_block_rules' ORDER BY ordinal_position`);
  console.log("Table prête ✓", cols.map(c=>c.column_name).join(", "));
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
