/**
 * Charge : Tibetan Café (Neuvecelle, FR) — 15.07.2026, ticket n° 40.
 *
 * 2 cocktails + 2 bières blanches 50cl = 38.00 € TTC, payé en ESPÈCES.
 * TVA française 20% (6.33 €) non récupérable pour une Sàrl suisse → tout le TTC
 * est le coût (tauxTVA 0, tvaRecuperable false), comme les autres charges FR.
 *
 * Conversion EUR → CHF au taux 0.93 (même taux que les charges FR récentes).
 * On ignore volontairement le "Fr.Suisse 1.15 / 43.70" imprimé sur le ticket :
 * c'est le taux de change du restaurant, pas le coût réel (paiement en euros).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const EUR_TO_CHF = 0.93;
  const ttcEur = 38.0;
  const ttcChf = Math.round(ttcEur * EUR_TO_CHF * 100) / 100;

  const reference = "Ticket 40 — Tibetan Café 15.07.2026";

  const existing = await prisma.expense.findFirst({ where: { reference } });
  if (existing) {
    console.log(`Déjà présent (id ${existing.id}) — rien à faire.`);
    return;
  }

  const expense = await prisma.expense.create({
    data: {
      date: new Date("2026-07-15"),
      dateReglement: new Date("2026-07-15"),
      categorie: "RESTAURATION",
      fournisseur: "Tibetan Café",
      description:
        "Tibetan Café, Neuvecelle (FR) — 2 cocktails + 2 bières 50cl, 38.00 € TTC (TVA FR 20% non récupérable)",
      reference,
      statutPaiement: "PAYE",
      montantHT: ttcChf,
      tauxTVA: 0,
      montantTVA: 0,
      montantTTC: ttcChf,
      tvaRecuperable: false,
      methodPaiement: "ESPECES",
    },
  });

  console.log("Charge créée ✓");
  console.log(`   id      : ${expense.id}`);
  console.log(`   Date    : 15.07.2026 — payé (espèces)`);
  console.log(`   Montant : ${ttcEur.toFixed(2)} € ≈ CHF ${ttcChf.toFixed(2)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
