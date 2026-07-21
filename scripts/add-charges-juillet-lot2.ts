/**
 * Lot de charges juillet 2026 (tickets remis le 22.07).
 *
 * Toutes des dépenses FRANÇAISES : la TVA FR (10% ou 20%) n'est pas
 * récupérable pour une Sàrl suisse → tout le TTC est le coût
 * (tauxTVA 0, tvaRecuperable false). Conversion EUR → CHF au taux 0.93,
 * comme les autres charges FR.
 *
 * Les 3 autres tickets du lot (Coop Bulle 14.07, Tibetan Café 14.07 et 15.07)
 * étaient déjà enregistrés — non repris ici.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const EUR_TO_CHF = 0.93;
const chf = (eur: number) => Math.round(eur * EUR_TO_CHF * 100) / 100;

const CHARGES = [
  {
    date: "2026-07-07",
    categorie: "MATERIEL_BUREAU",
    fournisseur: "L'Entrepôt du Bricolage",
    ttcEur: 8.99,
    description:
      "Colle miroir cartouche 300ml — 8.99 € TTC (TVA FR 20% non récupérable)",
    reference: "Ticket Entrepôt Bricolage 07.07.2026 (caisse 18 4014)",
  },
  {
    date: "2026-07-09",
    categorie: "MATERIEL_BUREAU",
    fournisseur: "L'Entrepôt du Bricolage",
    ttcEur: 27.54,
    description:
      "Champlat sapin 2 arêtes 4x33x2500mm ×6 (dont écotaxe 0.36) — 27.54 € TTC (TVA FR 20% non récupérable)",
    reference: "Ticket Entrepôt Bricolage 09.07.2026 (caisse 18 7345)",
  },
  {
    date: "2026-07-16",
    categorie: "MATERIEL_BUREAU",
    fournisseur: "L'Entrepôt du Bricolage",
    ttcEur: 161.1,
    description:
      "Panneau déco chêne miel 14x300x2600mm ×3 (dont écotaxe 2.82) — 161.10 € TTC (TVA FR 20% non récupérable)",
    reference: "Ticket Entrepôt Bricolage 16.07.2026 (caisse 18 7719)",
  },
  {
    date: "2026-07-18",
    categorie: "RESTAURATION",
    fournisseur: "McDonald's Anthy-sur-Léman",
    ttcEur: 49.28,
    description:
      "McDonald's Anthy-sur-Léman — 49.28 € TTC (TVA FR 10% non récupérable)",
    reference: "Ticket McDonald's 18.07.2026 (#CDE 345 — NO AUTO 5ZSU9Z)",
  },
  {
    date: "2026-07-19",
    categorie: "RESTAURATION",
    fournisseur: "Évian Resort — L'Oliveraie (Hôtel Royal)",
    ttcEur: 111.0,
    description:
      "Déjeuner L'Oliveraie, Hôtel Royal Évian — 2 couverts — 111.00 € TTC (TVA FR non récupérable)",
    reference: "Addition 28-003723 — Évian Resort 19.07.2026",
  },
] as const;

async function main() {
  for (const c of CHARGES) {
    const existing = await prisma.expense.findFirst({
      where: { reference: c.reference },
    });
    if (existing) {
      console.log(`⏭  déjà présent : ${c.fournisseur} ${c.date}`);
      continue;
    }
    const montant = chf(c.ttcEur);
    const e = await prisma.expense.create({
      data: {
        date: new Date(c.date),
        dateReglement: new Date(c.date),
        categorie: c.categorie as never,
        fournisseur: c.fournisseur,
        description: c.description,
        reference: c.reference,
        statutPaiement: "PAYE",
        montantHT: montant,
        tauxTVA: 0,
        montantTVA: 0,
        montantTTC: montant,
        tvaRecuperable: false,
        methodPaiement: "CARTE_BANCAIRE",
      },
    });
    console.log(
      `✓ ${c.date} | ${c.fournisseur.padEnd(38)} | ${c.ttcEur.toFixed(2)} € ≈ CHF ${montant.toFixed(2)} | ${e.id}`,
    );
  }
  const total = CHARGES.reduce((s, c) => s + chf(c.ttcEur), 0);
  console.log(`\nTotal du lot : CHF ${total.toFixed(2)}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
