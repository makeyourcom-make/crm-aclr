import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
/**
 * Colonnes dénormalisées « dernier appel » et « date de RDV » sur prospects,
 * pour trier le listing entreprises. Maintenues par un trigger AFTER INSERT sur
 * activities (GREATEST, comme derniereActionLe) :
 *   - dernierAppelLe = MAX(date) des APPEL_SORTANT/APPEL_ENTRANT
 *   - dateRdvLe      = MAX(date) des RDV_PHYSIQUE/VISIO/TELEPHONIQUE (RDV futurs inclus)
 * On utilise Activity.date (le créneau) : pour un appel c'est l'instant, pour un
 * RDV c'est la date du rendez-vous (ce qu'on veut voir pour planifier).
 */
async function main() {
  // 1. Colonnes + index (additif, idempotent)
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "dernierAppelLe" TIMESTAMP(3)`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "dateRdvLe" TIMESTAMP(3)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "prospects_dernierAppelLe_idx" ON "prospects" ("dernierAppelLe" DESC)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "prospects_dateRdvLe_idx" ON "prospects" ("dateRdvLe" DESC)`,
  );

  // 2. Fonction + trigger
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION touch_prospect_appel_rdv() RETURNS TRIGGER AS $fn$
    BEGIN
      IF NEW."prospectId" IS NOT NULL THEN
        IF NEW.type::text IN ('APPEL_SORTANT','APPEL_ENTRANT') THEN
          UPDATE "prospects"
          SET "dernierAppelLe" = GREATEST(COALESCE("dernierAppelLe", NEW."date"), NEW."date")
          WHERE id = NEW."prospectId";
        ELSIF NEW.type::text IN ('RDV_PHYSIQUE','RDV_VISIO','RDV_TELEPHONIQUE') THEN
          UPDATE "prospects"
          SET "dateRdvLe" = GREATEST(COALESCE("dateRdvLe", NEW."date"), NEW."date")
          WHERE id = NEW."prospectId";
        END IF;
      END IF;
      RETURN NEW;
    END; $fn$ LANGUAGE plpgsql;
  `);
  await prisma.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS trg_touch_prospect_appel_rdv ON "activities"`,
  );
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_touch_prospect_appel_rdv
    AFTER INSERT ON "activities"
    FOR EACH ROW EXECUTE FUNCTION touch_prospect_appel_rdv();
  `);

  // 3. Backfill depuis l'existant
  const nAppel = await prisma.$executeRawUnsafe(`
    UPDATE "prospects" p SET "dernierAppelLe" = a.maxd
    FROM (SELECT "prospectId", MAX("date") maxd FROM "activities"
          WHERE "prospectId" IS NOT NULL AND type::text IN ('APPEL_SORTANT','APPEL_ENTRANT')
          GROUP BY "prospectId") a
    WHERE p.id = a."prospectId" AND p."dernierAppelLe" IS DISTINCT FROM a.maxd
  `);
  const nRdv = await prisma.$executeRawUnsafe(`
    UPDATE "prospects" p SET "dateRdvLe" = a.maxd
    FROM (SELECT "prospectId", MAX("date") maxd FROM "activities"
          WHERE "prospectId" IS NOT NULL AND type::text IN ('RDV_PHYSIQUE','RDV_VISIO','RDV_TELEPHONIQUE')
          GROUP BY "prospectId") a
    WHERE p.id = a."prospectId" AND p."dateRdvLe" IS DISTINCT FROM a.maxd
  `);
  console.log(`Backfill : ${nAppel} fiches avec dernier appel, ${nRdv} avec date de RDV.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
