/**
 * Table `dossier_attachments` — documents rattachés à un projet.
 *
 * DDL 100 % additif (CREATE TABLE / INDEX IF NOT EXISTS) : jamais de
 * `prisma db push` sur la base Neon partagée dev/prod.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "dossier_attachments" (
      "id"          TEXT PRIMARY KEY,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "dossierId"   TEXT NOT NULL,
      "ajouteParId" TEXT NOT NULL,
      "nom"         TEXT NOT NULL,
      "taille"      INTEGER NOT NULL,
      "mimeType"    TEXT NOT NULL,
      "url"         TEXT NOT NULL
    )
  `);
  // Contraintes ajoutées séparément pour rester ré-exécutable sans erreur.
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "dossier_attachments"
        ADD CONSTRAINT "dossier_attachments_dossierId_fkey"
        FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "dossier_attachments"
        ADD CONSTRAINT "dossier_attachments_ajouteParId_fkey"
        FOREIGN KEY ("ajouteParId") REFERENCES "users"("id") ON DELETE RESTRICT;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "dossier_attachments_dossierId_idx" ON "dossier_attachments" ("dossierId")`,
  );

  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'dossier_attachments' ORDER BY ordinal_position`,
  );
  console.log("Table prête ✓ colonnes :", cols.map((c) => c.column_name).join(", "));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
