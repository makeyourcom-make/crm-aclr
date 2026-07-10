/**
 * Enregistre le paiement de la facture SOS Pneus 26-92 (EN_RETARD, 926.41),
 * encaissée le 06.07.2026. Réplique fidèlement createPayment() :
 *   1. Payment ENCAISSE (type SOLDE car facture PONCTUELLE)
 *   2. ClientInvoice -> PAYEE + datePaiement = 06.07.2026
 *   3. Si 1er encaissement du contrat -> commission SIGNATURE PREVU->PAYE
 * (Pas de commission renouvellement : ce n'est pas une MENSUALITE.)
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const inv = await prisma.clientInvoice.findFirst({
    where: { numero: "26-92" },
    select: { id: true, contractId: true, statut: true, total: true, type: true, numero: true },
  });
  if (!inv) throw new Error("Facture 26-92 introuvable");
  console.log(`26-92 : statut=${inv.statut} total=${inv.total} type=${inv.type}`);
  if (inv.statut === "PAYEE") {
    console.log("Déjà PAYEE — rien à faire.");
    return;
  }

  const datePaiement = new Date("2026-07-06T12:00:00.000Z");
  const montant = Number(inv.total);

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        contractId: inv.contractId,
        clientInvoiceId: inv.id,
        date: datePaiement,
        montant,
        type: "SOLDE", // PONCTUELLE -> SOLDE (cf. markClientInvoicePaid)
        statut: "ENCAISSE",
        referenceFactureClient: inv.numero,
      },
    });

    await tx.clientInvoice.update({
      where: { id: inv.id },
      data: { statut: "PAYEE", datePaiement },
    });

    // 1er encaissement du contrat ? -> commission SIGNATURE acquise
    const otherEncaisses = await tx.payment.count({
      where: { contractId: inv.contractId, statut: "ENCAISSE", id: { not: payment.id } },
    });
    let signatureFlipped = 0;
    if (otherEncaisses === 0) {
      const com = await tx.commission.findUnique({ where: { contractId: inv.contractId } });
      if (com) {
        const r = await tx.commissionPayment.updateMany({
          where: { commissionId: com.id, typePart: "SIGNATURE", statut: "PREVU" },
          data: { statut: "PAYE", dateVersement: new Date() },
        });
        signatureFlipped = r.count;
      }
    }
    return { payment, otherEncaisses, signatureFlipped };
  });

  console.log("\nPaiement enregistré ✓");
  console.log(`   Payment id      : ${result.payment.id}`);
  console.log(`   Montant         : CHF ${montant.toFixed(2)}`);
  console.log(`   Date encaissement: 06.07.2026`);
  console.log(`   Facture 26-92    : PAYEE`);
  console.log(`   Autres encaissements avant : ${result.otherEncaisses} (commission SIGNATURE basculée: ${result.signatureFlipped})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
