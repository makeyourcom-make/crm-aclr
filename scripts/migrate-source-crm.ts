import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Toutes les fiches proviennent du CRM : on fixe source = CRM pour celles qui
 * n'ont pas de source explicite (NULL) ou qui portent encore la valeur legacy
 * FICHIER_IMPORT. Les fiches déjà requalifiées (LinkedIn, Instagram, Facebook,
 * Recommandation, Site web, Direct...) sont conservées.
 */
async function main() {
  const before = await prisma.prospect.groupBy({
    by: ["source"],
    _count: true,
  });
  console.log("Avant :", before.map((r) => `${r.source ?? "NULL"}=${r._count}`).join(", "));

  const res = await prisma.prospect.updateMany({
    where: { OR: [{ source: null }, { source: "FICHIER_IMPORT" }] },
    data: { source: "CRM" },
  });
  console.log(`Mises à jour → CRM : ${res.count}`);

  const after = await prisma.prospect.groupBy({
    by: ["source"],
    _count: true,
  });
  console.log("Après :", after.map((r) => `${r.source ?? "NULL"}=${r._count}`).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
