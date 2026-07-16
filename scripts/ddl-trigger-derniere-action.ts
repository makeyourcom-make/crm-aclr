import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
/**
 * « Dernière action » = Activity.createdAt (moment où l'action a été SAISIE),
 * PAS Activity.date (qui est le créneau — un RDV planifié a une date future et
 * ferait remonter la fiche à tort dans « derniers clients ouverts/appelés »).
 */
async function main(){
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION touch_prospect_derniere_action() RETURNS TRIGGER AS $fn$
    BEGIN
      IF NEW."prospectId" IS NOT NULL THEN
        UPDATE "prospects"
        SET "derniereActionLe" = GREATEST(COALESCE("derniereActionLe", NEW."createdAt"), NEW."createdAt")
        WHERE id = NEW."prospectId";
      END IF;
      RETURN NEW;
    END; $fn$ LANGUAGE plpgsql;
  `);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_touch_prospect_derniere_action ON "activities"`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_touch_prospect_derniere_action
    AFTER INSERT ON "activities"
    FOR EACH ROW EXECUTE FUNCTION touch_prospect_derniere_action();
  `);
  // Recalcul complet depuis createdAt (écrase l'ancien backfill basé sur date)
  const n = await prisma.$executeRawUnsafe(`
    UPDATE "prospects" p SET "derniereActionLe" = a.maxc
    FROM (SELECT "prospectId", MAX("createdAt") AS maxc FROM "activities" WHERE "prospectId" IS NOT NULL GROUP BY "prospectId") a
    WHERE p.id = a."prospectId" AND p."derniereActionLe" IS DISTINCT FROM a.maxc
  `);
  console.log(`Trigger recréé (createdAt) + backfill recalculé : ${n} fiches`);
  const top = await prisma.prospect.findMany({ where:{ derniereActionLe:{ not:null } }, orderBy:{ derniereActionLe:"desc" }, take:5, select:{ raisonSociale:true, derniereActionLe:true } });
  console.log("Derniers clients touchés :");
  top.forEach(p=>console.log(`   ${p.derniereActionLe?.toISOString().slice(0,16).replace("T"," ")} | ${p.raisonSociale}`));
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
