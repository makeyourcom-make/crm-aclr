/**
 * Planning de production (onglet « Planning » de Gestion des projets) :
 * enums PlanningFrequence / PlanningTacheStatut + tables planning_lignes,
 * planning_regles, planning_taches.
 * DDL 100% additif et idempotent (généré depuis `prisma migrate diff`, filtré
 * sur les seuls objets planning).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const STATEMENTS: string[] = [
  "DO $$ BEGIN\n  CREATE TYPE \"PlanningFrequence\" AS ENUM ('MENSUELLE', 'BIMENSUELLE', 'HEBDO', 'BIMESTRIELLE', 'TRIMESTRIELLE', 'ANNUELLE', 'PONCTUELLE');\nEXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "DO $$ BEGIN\n  CREATE TYPE \"PlanningTacheStatut\" AS ENUM ('A_FAIRE', 'EN_COURS', 'ATTENTE_CLIENT', 'FAIT', 'ABANDONNEE');\nEXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "CREATE TABLE IF NOT EXISTS \"planning_lignes\" (\n    \"id\" TEXT NOT NULL,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n    \"ownerId\" TEXT NOT NULL,\n    \"prospectId\" TEXT NOT NULL,\n    \"contractId\" TEXT,\n    \"service\" TEXT NOT NULL,\n    \"libelle\" TEXT,\n    \"auto\" BOOLEAN NOT NULL DEFAULT true,\n    \"actif\" BOOLEAN NOT NULL DEFAULT true,\n    \"fraisPubAvances\" BOOLEAN NOT NULL DEFAULT true,\n\n    CONSTRAINT \"planning_lignes_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"planning_regles\" (\n    \"id\" TEXT NOT NULL,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n    \"ligneId\" TEXT NOT NULL,\n    \"code\" TEXT NOT NULL,\n    \"titre\" TEXT NOT NULL,\n    \"frequence\" \"PlanningFrequence\" NOT NULL DEFAULT 'MENSUELLE',\n    \"fixe\" BOOLEAN NOT NULL DEFAULT false,\n    \"fenetreDebut\" INTEGER NOT NULL DEFAULT 1,\n    \"fenetreFin\" INTEGER NOT NULL DEFAULT 28,\n    \"jours\" INTEGER[],\n    \"jourSemaine\" INTEGER,\n    \"moisAncre\" INTEGER,\n    \"datePonctuelle\" TIMESTAMP(3),\n    \"dureeMin\" INTEGER NOT NULL DEFAULT 30,\n    \"actif\" BOOLEAN NOT NULL DEFAULT true,\n    \"dateDebut\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"dateFin\" TIMESTAMP(3),\n\n    CONSTRAINT \"planning_regles_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE TABLE IF NOT EXISTS \"planning_taches\" (\n    \"id\" TEXT NOT NULL,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n    \"ownerId\" TEXT NOT NULL,\n    \"ligneId\" TEXT NOT NULL,\n    \"regleId\" TEXT,\n    \"cle\" TEXT,\n    \"titre\" TEXT NOT NULL,\n    \"date\" TIMESTAMP(3) NOT NULL,\n    \"dureeMin\" INTEGER NOT NULL DEFAULT 30,\n    \"statut\" \"PlanningTacheStatut\" NOT NULL DEFAULT 'A_FAIRE',\n    \"faitLe\" TIMESTAMP(3),\n    \"notes\" TEXT,\n\n    CONSTRAINT \"planning_taches_pkey\" PRIMARY KEY (\"id\")\n)",
  "CREATE INDEX IF NOT EXISTS \"planning_lignes_ownerId_actif_idx\" ON \"planning_lignes\"(\"ownerId\", \"actif\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"planning_lignes_ownerId_prospectId_service_key\" ON \"planning_lignes\"(\"ownerId\", \"prospectId\", \"service\")",
  "CREATE INDEX IF NOT EXISTS \"planning_regles_ligneId_idx\" ON \"planning_regles\"(\"ligneId\")",
  "CREATE INDEX IF NOT EXISTS \"planning_taches_ownerId_date_idx\" ON \"planning_taches\"(\"ownerId\", \"date\")",
  "CREATE INDEX IF NOT EXISTS \"planning_taches_ligneId_date_idx\" ON \"planning_taches\"(\"ligneId\", \"date\")",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"planning_taches_regleId_cle_key\" ON \"planning_taches\"(\"regleId\", \"cle\")",
  "DO $$ BEGIN\n  ALTER TABLE \"planning_lignes\" ADD CONSTRAINT \"planning_lignes_ownerId_fkey\" FOREIGN KEY (\"ownerId\") REFERENCES \"users\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;\nEXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "DO $$ BEGIN\n  ALTER TABLE \"planning_lignes\" ADD CONSTRAINT \"planning_lignes_prospectId_fkey\" FOREIGN KEY (\"prospectId\") REFERENCES \"prospects\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;\nEXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "DO $$ BEGIN\n  ALTER TABLE \"planning_lignes\" ADD CONSTRAINT \"planning_lignes_contractId_fkey\" FOREIGN KEY (\"contractId\") REFERENCES \"contracts\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE;\nEXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "DO $$ BEGIN\n  ALTER TABLE \"planning_regles\" ADD CONSTRAINT \"planning_regles_ligneId_fkey\" FOREIGN KEY (\"ligneId\") REFERENCES \"planning_lignes\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;\nEXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "DO $$ BEGIN\n  ALTER TABLE \"planning_taches\" ADD CONSTRAINT \"planning_taches_ownerId_fkey\" FOREIGN KEY (\"ownerId\") REFERENCES \"users\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;\nEXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "DO $$ BEGIN\n  ALTER TABLE \"planning_taches\" ADD CONSTRAINT \"planning_taches_ligneId_fkey\" FOREIGN KEY (\"ligneId\") REFERENCES \"planning_lignes\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE;\nEXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "DO $$ BEGIN\n  ALTER TABLE \"planning_taches\" ADD CONSTRAINT \"planning_taches_regleId_fkey\" FOREIGN KEY (\"regleId\") REFERENCES \"planning_regles\"(\"id\") ON DELETE SET NULL ON UPDATE CASCADE;\nEXCEPTION WHEN duplicate_object THEN NULL; END $$"
];
async function main() {
  for (const sql of STATEMENTS) await prisma.$executeRawUnsafe(sql);
  for (const t of ["planning_lignes", "planning_regles", "planning_taches"]) {
    const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='${t}' ORDER BY ordinal_position`,
    );
    console.log(`${t} prête ✓ (${cols.length} colonnes)`);
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
