/**
 * Transforme la charge "Remboursement Frakaxessoires 600 CHF" en avoir client.
 *
 *   • Supprime l'Expense (c'est un encaissement, pas une dépense)
 *   • Crée un ClientInvoice de type PONCTUELLE avec total NÉGATIF -600 CHF
 *     sur le contrat Frakaxessoires (CTR-2618)
 *   • Marque la facture PAYEE (puisque le remboursement a déjà été reçu)
 *
 * Note : on n'a pas d'enum AVOIR dans ClientInvoiceType ; on utilise PONCTUELLE
 * + total négatif + note explicite dans `notesClient`. Si un jour on veut
 * un vrai workflow Avoir, on ajoutera l'enum.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const charge = await prisma.expense.findFirst({
    where: {
      description: { contains: "Frakaxessoires", mode: "insensitive" },
      montantTTC: 600,
    },
  });
  if (!charge) {
    console.log("⊘ Charge Frakaxessoires 600 CHF non trouvée. Rien à faire.");
    return;
  }

  const prospect = await prisma.prospect.findFirst({
    where: { raisonSociale: { equals: "Frakaxessoires", mode: "insensitive" } },
  });
  if (!prospect) throw new Error("Prospect Frakaxessoires introuvable");

  const contract = await prisma.contract.findFirst({
    where: { prospectId: prospect.id, statut: "ACTIF" },
  });
  if (!contract) throw new Error("Contrat ACTIF Frakaxessoires introuvable");

  console.log(`Charge à supprimer : ${charge.id} (${Number(charge.montantTTC)} CHF)`);
  console.log(`Contrat cible      : ${contract.numero} [${contract.id.slice(-6)}]`);

  await prisma.$transaction(async (tx) => {
    // 1. Crée l'avoir client (= facture négative)
    const dateEmission = charge.date; // 06.05.2026
    const annee = dateEmission.getFullYear();
    const counter = await tx.counter.upsert({
      where: { scope_year: { scope: "client_invoice", year: annee } },
      create: { scope: "client_invoice", year: annee, value: 1 },
      update: { value: { increment: 1 } },
    });
    const numero = `ACLR-CLI-${annee}-${String(counter.value).padStart(4, "0")}A`;

    const avoir = await tx.clientInvoice.create({
      data: {
        contractId: contract.id,
        numero,
        dateEmission,
        dateEcheance: dateEmission,
        type: "PONCTUELLE",
        sousTotal: -600,
        totalTVA: 0,
        total: -600,
        statut: "PAYEE",
        datePaiement: dateEmission,
        modeReglement: "VIREMENT",
        notesClient:
          "AVOIR — Remboursement trop-perçu (anciennement saisi en charge interne, transformé en avoir client).",
      },
    });
    console.log(`  ✓ Avoir créé : ${avoir.numero}  total=${Number(avoir.total)} CHF  statut=PAYEE`);

    // 2. Supprime la charge (CASCADE supprime les allocations & attachments)
    await tx.expense.delete({ where: { id: charge.id } });
    console.log(`  ✓ Charge supprimée`);
  });

  // Stats
  const totalCharges = await prisma.expense.count();
  console.log(`\n✓ Total charges restantes : ${totalCharges}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
