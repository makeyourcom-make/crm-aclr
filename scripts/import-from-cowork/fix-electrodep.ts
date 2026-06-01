/**
 * Correctif post-import : ElectroDep Sàrl
 *
 * Cowork a mis à tort le devis 26-D02 dans factures.json (préfixe D = Devis,
 * pas Facture). On nettoie :
 *  - Supprime la "facture" 26-D02 et son Payment éventuel
 *  - Supprime le contrat PLACEHOLDER-26-D02
 *  - Garde le prospect ElectroDep Sàrl en PROPOSITION_ENVOYEE avec une note
 *
 * Pareil, on filtre tous les "26-D*" futurs côté script d'import.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Trouve la "facture" 26-D02
  const invoice = await prisma.clientInvoice.findFirst({
    where: { numero: { startsWith: "26-D" } },
    include: { contract: { include: { prospect: true } } },
  });

  if (!invoice) {
    console.log("Aucune facture 26-D* trouvée — déjà nettoyée.");
    return;
  }

  const prospectId = invoice.contract.prospectId;
  const prospectName = invoice.contract.prospect.raisonSociale;
  const contractId = invoice.contractId;
  const contractNumero = invoice.contract.numero;

  console.log(`Trouvé : facture ${invoice.numero} (${prospectName})`);
  console.log(`  Contrat associé : ${contractNumero}`);

  // 2. Supprime le Payment éventuel
  const deletedPayments = await prisma.payment.deleteMany({
    where: { clientInvoiceId: invoice.id },
  });
  if (deletedPayments.count > 0) {
    console.log(`  ✓ ${deletedPayments.count} payment(s) supprimé(s)`);
  }

  // 3. Supprime la facture
  await prisma.clientInvoice.delete({ where: { id: invoice.id } });
  console.log(`  ✓ Facture ${invoice.numero} supprimée`);

  // 4. Supprime le contrat placeholder s'il n'a plus d'autres factures
  const otherInvoices = await prisma.clientInvoice.count({
    where: { contractId },
  });
  if (otherInvoices === 0 && contractNumero.startsWith("PLACEHOLDER-")) {
    await prisma.contract.delete({ where: { id: contractId } });
    console.log(`  ✓ Contrat placeholder ${contractNumero} supprimé`);
  }

  // 5. Met à jour le prospect : statut PROPOSITION_ENVOYEE + note devis
  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      statut: "PROPOSITION_ENVOYEE",
      notesGenerales: {
        // append (on évite d'écraser les notes existantes)
        set: [
          "Devis 26-D02 envoyé le 27.04.2026 — Création site e-commerce + Pack Sérénité 12 mois (1 587 CHF)",
          "Échéance : 27.05.2026",
        ].join("\n"),
      },
    },
  });
  console.log(
    `  ✓ Prospect "${prospectName}" mis en PROPOSITION_ENVOYEE avec note devis`,
  );

  console.log("\n✓ Correctif appliqué.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
