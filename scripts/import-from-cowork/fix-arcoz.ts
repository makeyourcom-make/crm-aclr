/**
 * Correctif post-import : ARCOZ AG
 *
 * Pas un placeholder à transformer — le contrat est déjà bien créé
 * (CTR-2601, EXPIRE). On enrichit juste les notes pour expliciter
 * que c'est une mission unique terminée, pas de suite commerciale.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const prospect = await prisma.prospect.findFirst({
    where: { raisonSociale: { contains: "ARCOZ" } },
    include: { contracts: true },
  });
  if (!prospect) {
    console.log("Prospect ARCOZ AG introuvable.");
    return;
  }

  console.log(`Trouvé : ${prospect.raisonSociale}`);
  for (const ct of prospect.contracts) {
    console.log(
      `  Contrat ${ct.numero} — statut ${ct.statut}, valeur ${Number(ct.valeurAn1).toFixed(2)} CHF`,
    );
  }

  // Note enrichie sur le prospect
  await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      statut: "SIGNE",
      notesGenerales: [
        "Mission unique TERMINÉE — pas de suite commerciale prévue.",
        "",
        "Tunnel de vente livré, payé en 3 fois (26-36, 26-37, 26-38).",
        "Le contrat inclut Emelia (cold mailing) + Infomaniak (domaine + 5 mails) — coûts fournisseurs à ne pas refacturer.",
        "",
        "Si réveil commercial un jour, repartir d'une nouvelle proposition. Contact : Marco Cozza (Marco.Cozza@arcoz.ch).",
        "",
        "Source ID Cowork : C18 — IDE : CHE-107.590.359",
      ].join("\n"),
    },
  });
  console.log(`  ✓ Note prospect enrichie`);

  // Assure le contrat en statut EXPIRE (mission close)
  const ctr = prospect.contracts.find((c) => c.numero === "CTR-2601");
  if (ctr && ctr.statut !== "EXPIRE") {
    await prisma.contract.update({
      where: { id: ctr.id },
      data: { statut: "EXPIRE" },
    });
    console.log(`  ✓ Contrat CTR-2601 → EXPIRE`);
  } else if (ctr) {
    console.log(`  ↳ Contrat CTR-2601 déjà EXPIRE`);
  }

  console.log("\n✓ Correctif appliqué.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
