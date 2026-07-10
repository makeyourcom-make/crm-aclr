/**
 * Arcoz AG — 3e et dernière facture du "Tunnel de vente" (Facture 3/3).
 *
 * Contrat CTR-2601, valeur totale 6256.00 CHF, facturé en 3 tiers :
 *   - 26-36 : Tunnel de vente - Facture 1/3 = 2085.00 (PAYEE)
 *   - 26-37 : Tunnel de vente - Facture 2/3 = 2085.00 (PAYEE)
 *   - 26-38 : Tunnel de vente - Facture 3/3 = 2086.00 (à créer) ← 6256 - 4170
 *
 * Numéro 26-38 pour rester cohérent avec la série existante (les 1/3 et 2/3
 * sont en 26-XX). Créée en BROUILLON, prête à envoyer (se datera à l'envoi).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const contract = await prisma.contract.findFirst({
    where: { numero: "CTR-2601" },
    select: { id: true, devise: true },
  });
  if (!contract) throw new Error("Contrat CTR-2601 introuvable");

  // Contrôle de cohérence : total contrat vs déjà facturé.
  const existing = await prisma.clientInvoice.findMany({
    where: { contractId: contract.id },
    select: { numero: true, total: true },
  });
  const dejaFacture = existing.reduce((s, i) => s + Number(i.total), 0);
  const totalContrat = 6256;
  const reste = Math.round((totalContrat - dejaFacture) * 100) / 100;
  console.log(`Déjà facturé: ${dejaFacture.toFixed(2)} — total contrat: ${totalContrat} — reste: ${reste.toFixed(2)}`);
  if (existing.some((i) => i.numero === "26-38")) {
    console.log("La facture 26-38 existe déjà — rien à faire.");
    return;
  }
  if (reste <= 0) {
    console.log("Rien à facturer (reste <= 0).");
    return;
  }

  const now = new Date();
  const echeance = new Date(now);
  echeance.setDate(echeance.getDate() + 30);

  const inv = await prisma.clientInvoice.create({
    data: {
      contractId: contract.id,
      numero: "26-38",
      type: "PONCTUELLE",
      statut: "BROUILLON",
      devise: contract.devise ?? "CHF",
      dateEmission: now,
      dateEcheance: echeance,
      sousTotal: reste,
      totalTVA: 0,
      total: reste,
      lignes: {
        create: [
          {
            designation: "Tunnel de vente - Facture 3/3",
            quantite: 1,
            prixUnitaire: reste,
            montantHT: reste,
            tauxTVA: 0,
            ordre: 0,
          },
        ],
      },
    },
    include: { lignes: true },
  });

  console.log("\nFacture créée ✓ (BROUILLON, prête à envoyer)");
  console.log(`   Numéro     : ${inv.numero}`);
  console.log(`   Type       : ${inv.type}`);
  console.log(`   Ligne      : ${inv.lignes[0]?.designation}`);
  console.log(`   Total      : CHF ${Number(inv.total).toFixed(2)}`);
  console.log(`   => Total contrat désormais couvert : ${(dejaFacture + reste).toFixed(2)} / ${totalContrat}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
