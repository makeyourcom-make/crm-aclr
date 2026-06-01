/**
 * Corrige la facture Lina Coiffure 26-66 : 563.70 → 168 CHF.
 * Le contrat dit 168 CHF/an, la facture importée du Cowork avait un mauvais
 * montant (confusion avec Unleash Lab 563.70).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const f = await prisma.clientInvoice.findUnique({
    where: { numero: "26-66" },
    include: { lignes: true, contract: { include: { prospect: true } } },
  });
  if (!f) {
    console.log("⊘ Facture 26-66 non trouvée");
    return;
  }
  console.log(`Facture 26-66 trouvée :`);
  console.log(`  Client : ${f.contract.prospect.raisonSociale}`);
  console.log(`  Montant actuel : ${Number(f.total).toFixed(2)} CHF`);
  console.log(`  Statut : ${f.statut}`);
  console.log(`  Lignes : ${f.lignes.length}`);

  // Corriger les montants
  await prisma.clientInvoice.update({
    where: { id: f.id },
    data: {
      sousTotal: 168,
      totalTVA: 0,
      total: 168,
      notesClient:
        (f.notesClient ?? "").trim() +
        "\n— Montant corrigé 563.70 → 168 CHF (erreur d'import Cowork, vrai montant annuel 168 CHF par contrat CTR-2617).",
    },
  });

  // Mettre à jour les lignes si présentes
  if (f.lignes.length === 1) {
    await prisma.clientInvoiceLine.update({
      where: { id: f.lignes[0].id },
      data: {
        prixUnitaire: 168,
        montantHT: 168,
      },
    });
    console.log(`  ✓ Ligne mise à jour à 168 CHF`);
  } else if (f.lignes.length > 1) {
    console.log(`  ⚠ ${f.lignes.length} lignes — non corrigées automatiquement (vérifier manuellement)`);
  }

  console.log(`\n✓ Facture 26-66 corrigée : 563.70 → 168.00 CHF`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
