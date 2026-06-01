/**
 * Régénère les 12 factures mensualité du contrat JUBALU avec la nouvelle
 * logique : oneShot étalé sur 12 mois → 164 EUR/mois × 12 = 1968 EUR.
 *
 * Pré-requis :
 *   - Toutes les factures actuelles du contrat sont en BROUILLON (vérifié)
 *   - Pas de payment associé
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const JUBALU_CONTRACT = "ACLR-2026-0001";

async function main() {
  const contract = await prisma.contract.findFirst({
    where: { numero: JUBALU_CONTRACT },
    include: {
      clientInvoices: { include: { lignes: true, payments: true } },
    },
  });
  if (!contract) {
    console.log(`✗ Contrat ${JUBALU_CONTRACT} introuvable`);
    return;
  }

  // Sécurité : abort si paiement présent
  const hasPayments = contract.clientInvoices.some(
    (inv) => inv.payments.length > 0,
  );
  if (hasPayments) {
    console.log("✗ Au moins une facture a déjà un paiement → abort");
    return;
  }

  const oneShot = Number(contract.montantOneShot); // 1500
  const mensuel = Number(contract.montantMensuel); // 39
  const valAn1 = Number(contract.valeurAn1); // 1968
  const setupPart = Math.round((oneShot / 12) * 100) / 100; // 125.00
  const monthlyTotal = Math.round((setupPart + mensuel) * 100) / 100; // 164.00
  const last = Math.round((valAn1 - monthlyTotal * 11) * 100) / 100; // ajuste dernière facture

  console.log(`Contrat ${contract.numero}`);
  console.log(`  one-shot=${oneShot}, mensuel=${mensuel}, valAn1=${valAn1}`);
  console.log(`  → setup amorti = ${setupPart}/mois`);
  console.log(`  → mensualité 1-11 = ${monthlyTotal}, mensualité 12 = ${last}`);
  console.log(`  → total : ${(monthlyTotal * 11 + last).toFixed(2)} ${contract.devise}`);

  // Récup factures triées par dateEmission
  const invoices = [...contract.clientInvoices].sort(
    (a, b) =>
      a.dateEmission.getTime() - b.dateEmission.getTime(),
  );
  if (invoices.length !== 12) {
    console.log(`✗ Nombre de factures inattendu : ${invoices.length} (attendu 12)`);
    return;
  }

  console.log(`\nMise à jour des ${invoices.length} factures…`);
  let i = 0;
  for (const inv of invoices) {
    const isLast = i === 11;
    const newTotal = isLast ? last : monthlyTotal;

    // Recrée les lignes : setup + mensuel
    await prisma.$transaction([
      prisma.clientInvoiceLine.deleteMany({
        where: { clientInvoiceId: inv.id },
      }),
      prisma.clientInvoiceLine.createMany({
        data: [
          {
            clientInvoiceId: inv.id,
            designation: `Site Internet — setup amorti ${i + 1}/12`,
            quantite: 1,
            prixUnitaire: isLast ? (last - mensuel) : setupPart,
            montantHT: isLast ? (last - mensuel) : setupPart,
            tauxTVA: 0,
            ordre: 0,
          },
          {
            clientInvoiceId: inv.id,
            designation: `Site Internet — mensualité ${i + 1}/12`,
            quantite: 1,
            prixUnitaire: mensuel,
            montantHT: mensuel,
            tauxTVA: 0,
            ordre: 1,
          },
        ],
      }),
      prisma.clientInvoice.update({
        where: { id: inv.id },
        data: {
          sousTotal: newTotal,
          total: newTotal,
          notesClient: null, // supprime les notes obsolètes
        },
      }),
    ]);
    console.log(`  ✓ ${inv.numero} → ${contract.devise} ${newTotal.toFixed(2)}`);
    i++;
  }
  console.log(`\n✓ ${invoices.length} factures régénérées`);
}
main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
