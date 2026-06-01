/**
 * Correctif post-import : M A K E & Beyond (Laëtitia Rigolot)
 *
 * Ce n'est pas un client commercial — c'est de la refacturation de coûts
 * partagés (Google Workspace + domaine make-marketing.ch).
 *
 * Action :
 *  - Renomme le contrat placeholder en "REFAC-WORKSPACE-MAKE-BEYOND"
 *  - Statut SUSPENDU (= pas de contrat actif, juste un véhicule de refac)
 *  - Garde les factures rattachées (elles représentent du vrai CA)
 *  - Met une note claire sur le prospect
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const prospect = await prisma.prospect.findFirst({
    where: { raisonSociale: { contains: "M A K E & Beyond" } },
    include: {
      contracts: {
        include: { clientInvoices: { select: { numero: true, total: true, statut: true } } },
      },
    },
  });

  if (!prospect) {
    console.log("Prospect M A K E & Beyond introuvable.");
    return;
  }

  console.log(`Trouvé : ${prospect.raisonSociale}`);
  console.log(`  ${prospect.contracts.length} contrat(s) lié(s)`);

  // Transforme le ou les placeholders en contrat de refacturation
  let refactored = 0;
  for (const ct of prospect.contracts) {
    if (!ct.numero.startsWith("PLACEHOLDER-")) {
      console.log(`  ↳ ${ct.numero} : laissé tel quel (pas un placeholder)`);
      continue;
    }
    const invoicesList = ct.clientInvoices
      .map((i) => `${i.numero} (${Number(i.total).toFixed(2)} CHF)`)
      .join(", ");
    await prisma.contract.update({
      where: { id: ct.id },
      data: {
        numero: "REFAC-WORKSPACE-MAKE-BEYOND",
        statut: "SUSPENDU", // pas un contrat actif
        dureeMois: 1, // arbitraire — c'est récurrent au coup par coup
      },
    });
    console.log(`  ✓ Placeholder transformé en REFAC-WORKSPACE-MAKE-BEYOND`);
    console.log(`     Factures rattachées : ${invoicesList || "aucune"}`);
    refactored++;
  }

  // Met à jour le prospect
  await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      // On la garde en SIGNE car elle paye effectivement des factures,
      // mais la note explique clairement qu'il n'y a PAS de contrat.
      statut: "SIGNE",
      notesGenerales: [
        "⚠ PAS DE CONTRAT COMMERCIAL — refacturation de coûts partagés.",
        "",
        "Détail : Laëtitia Rigolot partage avec ACLR la facture Google Workspace Business Standard (~38.88 EUR/mois pour 2 licences). La licence make-marketing.ch (~19.44 EUR/mois) lui est refacturée à 100 %.",
        "",
        "+ Refacturation domaine .ch make-marketing.ch (1×/an, ~11.39 CHF) via facture 26-91.",
        "",
        "Le 'contrat' REFAC-WORKSPACE-MAKE-BEYOND est juste un véhicule technique pour rattacher les factures de refacturation.",
      ].join("\n"),
    },
  });
  console.log(`  ✓ Prospect mis à jour avec note de refacturation`);

  console.log(`\n✓ Correctif appliqué (${refactored} placeholder transformé).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
