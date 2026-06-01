/**
 * Script one-shot : remet en NEGOCIATION les deals qui sont en SIGNE
 * mais dont le contrat associé n'a pas encore été signé par le client.
 *
 * À lancer une seule fois après le changement de logique :
 *   npx tsx scripts/fix-deals-stage.ts
 *
 * Il liste d'abord ce qui sera modifié, puis applique en confirmant.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Trouve les deals en SIGNE dont AUCUN contrat n'a été signé par le client.
  // (= deals où Sophie a créé le contrat mais le client n'a pas encore
  // apposé sa signature manuscrite)
  const dealsToReset = await prisma.deal.findMany({
    where: {
      stage: "SIGNE",
      contracts: {
        some: {},
        none: {
          signatures: { some: { signeParClient: true } },
        },
      },
    },
    select: {
      id: true,
      titre: true,
      prospect: { select: { raisonSociale: true } },
      contracts: {
        select: {
          numero: true,
          signatures: {
            select: { signeParClient: true, signeParAclr: true },
          },
        },
      },
    },
  });

  if (dealsToReset.length === 0) {
    console.log("✓ Aucun deal à corriger.");
  } else {
    console.log(
      `Trouvé ${dealsToReset.length} deal(s) à remettre en NEGOCIATION :\n`,
    );
    for (const d of dealsToReset) {
      console.log(
        `  • ${d.titre} (${d.prospect.raisonSociale}) — contrat ${d.contracts[0]?.numero ?? "—"}`,
      );
    }
    console.log();
  }

  // Aussi : prospects passés en SIGNE alors qu'aucun client n'a vraiment signé
  const prospectsToReset = await prisma.prospect.findMany({
    where: {
      statut: "SIGNE",
      contracts: {
        none: {
          signatures: { some: { signeParClient: true } },
        },
      },
    },
    select: { id: true, raisonSociale: true },
  });

  if (prospectsToReset.length === 0) {
    console.log("✓ Aucun prospect à corriger.");
  } else {
    console.log(
      `Trouvé ${prospectsToReset.length} prospect(s) à remettre en PROPOSITION_ENVOYEE :\n`,
    );
    for (const p of prospectsToReset) {
      console.log(`  • ${p.raisonSociale}`);
    }
    console.log();
  }

  if (dealsToReset.length === 0 && prospectsToReset.length === 0) {
    console.log("Rien à faire.");
    return;
  }

  // Apply
  await prisma.$transaction(async (tx) => {
    await tx.deal.updateMany({
      where: { id: { in: dealsToReset.map((d) => d.id) } },
      data: {
        stage: "NEGOCIATION",
        probabilite: 70,
        closeReelLe: null,
      },
    });

    if (prospectsToReset.length > 0) {
      await tx.prospect.updateMany({
        where: { id: { in: prospectsToReset.map((p) => p.id) } },
        data: { statut: "PROPOSITION_ENVOYEE" },
      });
    }
  });

  console.log("✓ Correction appliquée.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
