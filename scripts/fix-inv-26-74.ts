/**
 * Corrige la facture SOS Pneus 26-74 (CTR-2605B) :
 *   - montant 666.06 -> 642.78 (Gestion + Budget Google Ads, 16 au 30 avril 2026)
 *   - statut EN_RETARD -> BROUILLON (prête à envoyer au client)
 * Sûr : aucun paiement rattaché, jamais réellement envoyée (envoiClientLe null).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const inv = await prisma.clientInvoice.findFirst({
    where: { numero: "26-74" },
    include: { lignes: { orderBy: { ordre: "asc" } }, payments: true },
  });
  if (!inv) throw new Error("26-74 introuvable");
  if (inv.payments.length > 0) {
    throw new Error("26-74 a des paiements rattachés — correction manuelle requise.");
  }

  const NOUVEAU = 642.78;

  await prisma.$transaction(async (tx) => {
    // 1 seule ligne attendue : on la met à jour (désignation déjà correcte).
    const ligne = inv.lignes[0];
    if (!ligne) throw new Error("Aucune ligne sur 26-74");
    // Sécurité : s'il y avait plusieurs lignes, on ne devine pas.
    if (inv.lignes.length > 1) throw new Error("Plusieurs lignes — à traiter à la main.");

    await tx.clientInvoiceLine.update({
      where: { id: ligne.id },
      data: {
        designation: "Gestion et Budget Google ADS – 16 au 30 avril 2026",
        prixUnitaire: NOUVEAU,
        montantHT: NOUVEAU,
      },
    });

    await tx.clientInvoice.update({
      where: { id: inv.id },
      data: {
        sousTotal: NOUVEAU,
        totalTVA: 0,
        total: NOUVEAU,
        statut: "BROUILLON",
        datePaiement: null,
      },
    });
  });

  const after: any = await prisma.clientInvoice.findFirst({
    where: { numero: "26-74" },
    include: { lignes: true },
  });
  console.log("26-74 corrigée ✓");
  console.log(`   Statut  : ${after.statut} (prête à envoyer)`);
  console.log(`   Ligne   : ${after.lignes[0].designation}`);
  console.log(`   Total   : CHF ${Number(after.total).toFixed(2)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
