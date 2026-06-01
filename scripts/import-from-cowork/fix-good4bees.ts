/**
 * Correctif post-import : Good4Bees
 *
 * Pas de contrat commercial — facturation ponctuelle au temps passé
 * (interventions Google Shopping / Merchant).
 *
 * Pattern identique à M A K E & Beyond : on transforme le placeholder en
 * "véhicule de facturation ponctuelle" SUSPENDU avec note explicite.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const prospect = await prisma.prospect.findFirst({
    where: { raisonSociale: { contains: "Good4Bees" } },
    include: {
      contracts: {
        include: {
          clientInvoices: { select: { numero: true, total: true } },
        },
      },
    },
  });
  if (!prospect) {
    console.log("Prospect Good4Bees introuvable.");
    return;
  }

  let refactored = 0;
  for (const ct of prospect.contracts) {
    if (!ct.numero.startsWith("PLACEHOLDER-")) continue;
    const invoicesList = ct.clientInvoices
      .map((i) => `${i.numero} (${Number(i.total).toFixed(2)} CHF)`)
      .join(", ");
    await prisma.contract.update({
      where: { id: ct.id },
      data: {
        numero: "PONCTUEL-GOOD4BEES",
        statut: "SUSPENDU",
        dureeMois: 1,
      },
    });
    console.log(`  ✓ ${ct.numero} → PONCTUEL-GOOD4BEES`);
    console.log(`     Factures : ${invoicesList}`);
    refactored++;
  }

  await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      statut: "SIGNE",
      notesGenerales: [
        "⚠ PAS DE CONTRAT COMMERCIAL — facturation ponctuelle au temps passé.",
        "",
        "Interventions facturées au coup par coup (Google Shopping, Google Merchant Center, etc.).",
        "Tarif : variable selon temps passé sur chaque intervention.",
        "",
        "Le 'contrat' PONCTUEL-GOOD4BEES est un véhicule technique pour rattacher les factures ponctuelles.",
      ].join("\n"),
    },
  });
  console.log("  ✓ Note prospect mise à jour");

  const total = prospect.contracts
    .flatMap((c) => c.clientInvoices)
    .reduce((s, i) => s + Number(i.total), 0);
  console.log(`\n✓ Correctif appliqué. CA cumulé ponctuel : ${total.toFixed(2)} CHF`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
