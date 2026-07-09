/**
 * Charge : Vistaprint — cartes de visite + affiches promotionnelles.
 *
 * Source : Facture Vistaprint B.V. N° 0237521538 (commande VP_5MLRLD8J),
 * facturée à ACLR Sàrl, le 2026-07-07 (payée le 2026-07-07).
 *   - Affiches promotionnelles ×1 : 17.49 € HT
 *   - Cartes de visite vernis sélectif ×500 : 45.99 € HT
 *   - Sous-total HT 63.48 € / TVA 20% 12.70 € / Total TTC 76.18 €
 *
 * TVA FRANÇAISE (FR38451225999) non récupérable pour une Sàrl suisse → tout le
 * TTC est le coût (tauxTVA 0, tvaRecuperable false), comme pour la charge
 * panneaux acoustiques / Netlify. Conversion EUR → CHF au taux 0.93.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const EUR_TO_CHF = 0.93;
  const ttcEur = 76.18;
  const ttcChf = Math.round(ttcEur * EUR_TO_CHF * 100) / 100;

  const reference = "Facture 0237521538 — Commande VP_5MLRLD8J";

  const existing = await prisma.expense.findFirst({ where: { reference } });
  if (existing) {
    console.log(`Déjà présent (id ${existing.id}) — rien à faire.`);
    return;
  }

  const expense = await prisma.expense.create({
    data: {
      date: new Date("2026-07-07"),
      dateReglement: new Date("2026-07-07"),
      categorie: "MARKETING",
      fournisseur: "Vistaprint B.V.",
      description:
        "Cartes de visite vernis sélectif (×500) + affiches promotionnelles — 76.18 € TTC (TVA FR 20% non récupérable)",
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
  console.log(`   Catégorie  : ${expense.categorie}`);
  console.log(`   Date       : 07.07.2026 — payé`);
  console.log(`   Montant    : ${ttcEur.toFixed(2)} € ≈ CHF ${ttcChf.toFixed(2)} (TVA FR non récupérable)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
