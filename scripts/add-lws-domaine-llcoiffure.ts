/**
 * Charge : Ligne Web Services (LWS) — transfert du nom de domaine
 * coiffure-monthey.ch (12 mois), rattachée au PROJET L&L Coiffure Sàrl.
 *
 * Facture FC-2749329, payée le 17.07.2026 par CB.
 *   HT 6.49 € / TVA FR 20% 1.30 € / TTC 7.79 €.
 *
 * TVA FRANÇAISE (FR21 851 993 683) non récupérable pour une Sàrl suisse → tout
 * le TTC est le coût (tauxTVA 0, tvaRecuperable false). Conversion EUR → CHF au
 * taux 0.93 (même taux que les autres charges FR).
 *
 * prospectId = fiche L&L Coiffure Sàrl (SIGNE, site coiffure-monthey.ch) → la
 * charge remonte dans la rentabilité de ce projet (Expense.prospectId).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const PROSPECT_ID = "cmpraz5ii000fuax84arxupl0"; // L&L Coiffure Sàrl, Monthey

async function main() {
  const prospect = await prisma.prospect.findUnique({
    where: { id: PROSPECT_ID },
    select: { raisonSociale: true, siteWeb: true },
  });
  if (!prospect) throw new Error("Fiche L&L Coiffure introuvable — vérifier l'id.");
  console.log(`Projet : ${prospect.raisonSociale} (${prospect.siteWeb})`);

  const EUR_TO_CHF = 0.93;
  const ttcEur = 7.79;
  const ttcChf = Math.round(ttcEur * EUR_TO_CHF * 100) / 100;

  const reference = "Facture LWS FC-2749329 (domaine coiffure-monthey.ch)";
  const existing = await prisma.expense.findFirst({ where: { reference } });
  if (existing) {
    console.log(`Déjà présent (id ${existing.id}) — rien à faire.`);
    return;
  }

  const expense = await prisma.expense.create({
    data: {
      date: new Date("2026-07-17"),
      dateReglement: new Date("2026-07-17"),
      categorie: "SOFTWARE_SAAS",
      fournisseur: "Ligne Web Services (LWS)",
      description:
        "Transfert nom de domaine coiffure-monthey.ch (12 mois) — projet L&L Coiffure — 7.79 € TTC (TVA FR 20% non récupérable)",
      reference,
      statutPaiement: "PAYE",
      montantHT: ttcChf,
      tauxTVA: 0,
      montantTVA: 0,
      montantTTC: ttcChf,
      tvaRecuperable: false,
      methodPaiement: "CARTE_BANCAIRE",
      prospectId: PROSPECT_ID,
    },
  });

  console.log("Charge créée ✓");
  console.log(`   id      : ${expense.id}`);
  console.log(`   Montant : ${ttcEur.toFixed(2)} € ≈ CHF ${ttcChf.toFixed(2)}`);
  console.log(`   Projet  : rattachée à ${prospect.raisonSociale}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
