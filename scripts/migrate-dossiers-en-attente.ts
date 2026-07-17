/**
 * Retrait du statut EN_ATTENTE du kanban Dossiers (décision Arthur, 17.07.2026).
 *
 * Les colonnes deviennent « <personne> - à faire / en cours » + « Terminé ».
 * EN_ATTENTE n'est plus proposé dans l'UI → les dossiers qui le portaient
 * repassent en A_FAIRE chez leur assigné actuel (aucune réassignation).
 *
 * On NE retire PAS la valeur de l'enum Postgres (opération risquée en prod, et
 * sans gain) : elle reste simplement inutilisée.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const cibles = await prisma.dossier.findMany({
    where: { statut: "EN_ATTENTE" },
    select: { id: true, titre: true, assigneA: { select: { name: true } } },
  });

  if (cibles.length === 0) {
    console.log("Aucun dossier EN_ATTENTE — rien à faire.");
    return;
  }
  for (const d of cibles) console.log(`   → ${d.titre} (${d.assigneA.name})`);

  const res = await prisma.dossier.updateMany({
    where: { statut: "EN_ATTENTE" },
    data: { statut: "A_FAIRE" },
  });
  console.log(`${res.count} dossier(s) repassé(s) en « à faire » ✓`);

  const reste = await prisma.dossier.count({ where: { statut: "EN_ATTENTE" } });
  console.log(`Reste en EN_ATTENTE : ${reste}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
