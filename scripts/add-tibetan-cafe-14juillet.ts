/**
 * Charge : Tibetan Café (Neuvecelle, FR) — 14.07.2026, facture n° 58.
 *
 * Table 100, 3 couverts — 2 repas complets + boissons = 146.00 € TTC.
 * TVA française (20% sur 46.33 + 10% sur 99.67 = 16.78 €) non récupérable pour
 * une Sàrl suisse → tout le TTC est le coût (tauxTVA 0, tvaRecuperable false).
 *
 * Conversion EUR → CHF au taux 0.93 (idem autres charges FR). Le "Fr.Suisse
 * 1.15 / 167.90" du ticket est le taux du restaurant, pas le coût réel.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const EUR_TO_CHF = 0.93;
  const ttcEur = 146.0;
  const ttcChf = Math.round(ttcEur * EUR_TO_CHF * 100) / 100;

  const reference = "Facture 58 — Tibetan Café 14.07.2026";

  const existing = await prisma.expense.findFirst({ where: { reference } });
  if (existing) {
    console.log(`Déjà présent (id ${existing.id}) — rien à faire.`);
    return;
  }

  const expense = await prisma.expense.create({
    data: {
      date: new Date("2026-07-14"),
      dateReglement: new Date("2026-07-14"),
      categorie: "RESTAURATION",
      fournisseur: "Tibetan Café",
      description:
        "Tibetan Café, Neuvecelle (FR) — 3 couverts, 2 repas complets + boissons, 146.00 € TTC (TVA FR non récupérable)",
      reference,
      statutPaiement: "PAYE",
      montantHT: ttcChf,
      tauxTVA: 0,
      montantTVA: 0,
      montantTTC: ttcChf,
      tvaRecuperable: false,
      methodPaiement: "CARTE_BANCAIRE",
    },
  });

  console.log("Charge créée ✓");
  console.log(`   id      : ${expense.id}`);
  console.log(`   Date    : 14.07.2026 — payé`);
  console.log(`   Montant : ${ttcEur.toFixed(2)} € ≈ CHF ${ttcChf.toFixed(2)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
