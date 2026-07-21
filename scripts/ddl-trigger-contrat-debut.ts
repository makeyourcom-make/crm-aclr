import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Colonne dénormalisée `prospects.contratDebutLe` = date de début du contrat
 * EN COURS le plus ancien (statut ATTENTE_VALIDATION_ADMIN / ACTIF / SUSPENDU),
 * pour rendre la colonne « Début contrat » TRIABLE côté serveur.
 *
 * Prisma ne sait pas trier par un champ d'une relation to-many → on dénormalise
 * comme derniereActionLe. DDL 100% additif (ADD COLUMN IF NOT EXISTS, CREATE
 * INDEX IF NOT EXISTS) — jamais de db push sur la prod partagée.
 *
 * Un contrat peut CHANGER de statut (brouillon → actif → résilié) ou de date :
 * un simple GREATEST ne suffit pas. Le trigger RECALCULE MIN(dateDebut) sur
 * l'ensemble des contrats en cours du prospect à chaque INSERT/UPDATE/DELETE,
 * pour l'ancien ET le nouveau prospectId (au cas où un contrat serait réassigné).
 */
const ACTIFS = "('ATTENTE_VALIDATION_ADMIN','ACTIF','SUSPENDU')";

async function main() {
  // 1. Colonne + index (additif)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "contratDebutLe" TIMESTAMP(3)`,
  );
  for (const sql of [
    `CREATE INDEX IF NOT EXISTS "prospects_contratDebutLe_idx" ON "prospects" ("contratDebutLe" DESC)`,
    `CREATE INDEX IF NOT EXISTS "prospects_assigneAId_contratDebutLe_idx" ON "prospects" ("assigneAId", "contratDebutLe" DESC)`,
  ]) {
    const t = Date.now();
    await prisma.$executeRawUnsafe(sql);
    console.log(`index ok (${Date.now() - t}ms)`);
  }

  // 2. Fonction de recalcul pour un prospect donné
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION recompute_prospect_contrat_debut(pid TEXT) RETURNS void AS $fn$
    BEGIN
      IF pid IS NULL THEN RETURN; END IF;
      UPDATE "prospects" p
      SET "contratDebutLe" = sub.mind
      FROM (
        SELECT MIN("dateDebut") AS mind
        FROM "contracts"
        WHERE "prospectId" = pid AND "statut"::text IN ${ACTIFS}
      ) sub
      WHERE p.id = pid AND p."contratDebutLe" IS DISTINCT FROM sub.mind;
    END; $fn$ LANGUAGE plpgsql;
  `);

  // 3. Trigger : recalcule pour l'ancien et le nouveau prospectId
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION touch_prospect_contrat_debut() RETURNS TRIGGER AS $fn$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        PERFORM recompute_prospect_contrat_debut(OLD."prospectId");
        RETURN OLD;
      END IF;
      PERFORM recompute_prospect_contrat_debut(NEW."prospectId");
      IF TG_OP = 'UPDATE' AND OLD."prospectId" IS DISTINCT FROM NEW."prospectId" THEN
        PERFORM recompute_prospect_contrat_debut(OLD."prospectId");
      END IF;
      RETURN NEW;
    END; $fn$ LANGUAGE plpgsql;
  `);
  await prisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS trg_touch_prospect_contrat_debut ON "contracts"`,
  );
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_touch_prospect_contrat_debut
    AFTER INSERT OR UPDATE OR DELETE ON "contracts"
    FOR EACH ROW EXECUTE FUNCTION touch_prospect_contrat_debut();
  `);

  // 4. Backfill complet
  const n = await prisma.$executeRawUnsafe(`
    UPDATE "prospects" p SET "contratDebutLe" = c.mind
    FROM (
      SELECT "prospectId", MIN("dateDebut") AS mind
      FROM "contracts"
      WHERE "statut"::text IN ${ACTIFS}
      GROUP BY "prospectId"
    ) c
    WHERE p.id = c."prospectId" AND p."contratDebutLe" IS DISTINCT FROM c.mind
  `);
  console.log(`Trigger créé + backfill : ${n} fiches`);

  const top = await prisma.prospect.findMany({
    where: { contratDebutLe: { not: null } },
    orderBy: { contratDebutLe: "asc" },
    take: 6,
    select: { raisonSociale: true, contratDebutLe: true },
  });
  console.log("Contrats les plus anciens :");
  top.forEach((p) =>
    console.log(
      `   ${p.contratDebutLe?.toISOString().slice(0, 10)} | ${p.raisonSociale}`,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
