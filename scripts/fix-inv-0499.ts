/**
 * Corrige la facture SOS Pneus ACLR-CLI-2026-0499 (CTR-2605, période juin 2026) :
 *   - montant 500 -> 1173.33
 *   - intitulé -> "Gestion et Budget Campagne Google ADS pour le mois de Juin 2026"
 * On garde type MENSUALITE + période juin : le créneau juin reste occupé, donc
 * le cron ne régénère pas de mensualité juin (aucun doublon). Statut reste
 * BROUILLON (prête à envoyer). Sûr : aucun paiement rattaché.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const inv = await prisma.clientInvoice.findFirst({
    where: { numero: "ACLR-CLI-2026-0499" },
    include: { lignes: { orderBy: { ordre: "asc" } }, payments: true },
  });
  if (!inv) throw new Error("ACLR-CLI-2026-0499 introuvable");
  if (inv.payments.length > 0) throw new Error("Facture avec paiement — correction manuelle.");
  if (inv.lignes.length !== 1) throw new Error(`Attendu 1 ligne, trouvé ${inv.lignes.length}`);

  const NOUVEAU = 1173.33;
  const INTITULE = "Gestion et Budget Campagne Google ADS pour le mois de Juin 2026";

  await prisma.$transaction(async (tx) => {
    await tx.clientInvoiceLine.update({
      where: { id: inv.lignes[0].id },
      data: { designation: INTITULE, prixUnitaire: NOUVEAU, montantHT: NOUVEAU, tauxTVA: 0 },
    });
    await tx.clientInvoice.update({
      where: { id: inv.id },
      data: { sousTotal: NOUVEAU, totalTVA: 0, total: NOUVEAU },
    });
  });

  const after: any = await prisma.clientInvoice.findFirst({
    where: { numero: "ACLR-CLI-2026-0499" },
    include: { lignes: true },
  });
  console.log("ACLR-CLI-2026-0499 corrigée ✓");
  console.log(`   Statut : ${after.statut} (prête à envoyer)`);
  console.log(`   Intitulé : ${after.lignes[0].designation}`);
  console.log(`   Total  : CHF ${Number(after.total).toFixed(2)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
