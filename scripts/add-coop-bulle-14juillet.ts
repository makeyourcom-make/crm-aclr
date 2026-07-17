/**
 * Charge : Coop Restaurant "Bulle Le Caro" — 14.07.2026, 11:48.
 *
 * Sandwich L + Happy Cola Zero 50cl + Cappuccino bio = CHF 14.45, Visa Debit.
 * TVA SUISSE 2.6% (CHF 0.37) — Coop Société Coopérative, CHE-116.311.185 TVA.
 * Contrairement aux tickets français, cette TVA est RÉCUPÉRABLE.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const ttc = 14.45;
  const tva = 0.37;
  const ht = Math.round((ttc - tva) * 100) / 100;

  const reference = "Ticket Coop Bulle Le Caro 14.07.2026 11:48 (0002473)";

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
      fournisseur: "Coop Restaurant (Bulle Le Caro)",
      description:
        "Coop Restaurant Bulle Le Caro — sandwich, boisson, cappuccino — CHF 14.45 (TVA CH 2.6% récupérable)",
      reference,
      statutPaiement: "PAYE",
      montantHT: ht,
      tauxTVA: 2.6,
      montantTVA: tva,
      montantTTC: ttc,
      tvaRecuperable: true,
      methodPaiement: "CARTE_BANCAIRE",
    },
  });

  console.log("Charge créée ✓");
  console.log(`   id      : ${expense.id}`);
  console.log(`   Montant : CHF ${ttc.toFixed(2)} (HT ${ht.toFixed(2)} + TVA ${tva.toFixed(2)})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
