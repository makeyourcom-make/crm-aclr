/**
 * Charge : Aménagement bureau — panneaux acoustiques.
 *
 * Source : Facture N° 74399900000019624 (Bon de commande 0220128225998),
 * L'Entrepôt du Bricolage (La Boîte à Outils), Amphion (FR), le 09/07/2026.
 *   - 3× Panneau acoustique décoratif Ecowall Acoustic chêne cérusé (lot de 3)
 *   - Total TTC : 140.04 € (TVA FR 20% = 23.34 € / HT 116.70 € / écotaxe 2.82 €)
 *   - Payé par Carte Bancaire.
 *
 * TVA FRANÇAISE non récupérable pour une Sàrl suisse → tout le TTC est le coût
 * (tauxTVA 0, tvaRecuperable false), comme pour les autres achats hors TVA
 * suisse. Conversion EUR → CHF au taux 0.93 (cf. add-hetzner/add-workspace).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const EUR_TO_CHF = 0.93;
  const ttcEur = 140.04;
  const ttcChf = Math.round(ttcEur * EUR_TO_CHF * 100) / 100;

  const reference = "Facture 74399900000019624 — BC 0220128225998";

  const existing = await prisma.expense.findFirst({ where: { reference } });
  if (existing) {
    console.log(`Déjà présent (id ${existing.id}) — rien à faire.`);
    return;
  }

  const expense = await prisma.expense.create({
    data: {
      date: new Date("2026-07-09"),
      dateReglement: new Date("2026-07-09"),
      categorie: "MATERIEL_BUREAU",
      fournisseur: "L'Entrepôt du Bricolage (La Boîte à Outils)",
      description:
        "Aménagement bureau — 3× Panneau acoustique décoratif Ecowall Acoustic chêne cérusé (lot de 3, 14×300) — 140.04 € TTC (TVA FR 20% non récupérable)",
      reference,
      statutPaiement: "PAYE",
      // TVA française non récupérable → le TTC entier est le coût.
      montantHT: ttcChf,
      tauxTVA: 0,
      montantTVA: 0,
      montantTTC: ttcChf,
      tvaRecuperable: false,
      methodPaiement: "CARTE_BANCAIRE",
    },
  });

  console.log("Charge créée ✓");
  console.log(`   id         : ${expense.id}`);
  console.log(`   Fournisseur: ${expense.fournisseur}`);
  console.log(`   Catégorie  : ${expense.categorie} (Aménagement bureau)`);
  console.log(`   Date       : 09.07.2026 — payé (Carte Bancaire)`);
  console.log(`   Montant    : ${ttcEur.toFixed(2)} € ≈ CHF ${ttcChf.toFixed(2)} (TVA FR non récupérable)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
