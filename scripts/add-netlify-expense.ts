/**
 * Ajoute la facture Netlify (Base Plan) aux charges.
 *
 * Source : Invoice GJYLUZ-00011 du 31 mai 2026, $20.00 USD
 *   - Période : 31 mai - 29 juin 2026 (Base Plan)
 *   - 3000 credits/mois inclus (Bandwidth, Compute, Production Deploys, Web Requests)
 *
 * Conversion USD → CHF : taux estimatif 0.82 (mai 2026), à ajuster si besoin
 * avec le débit réel sur l'extrait bancaire.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const USD_TO_CHF = 0.82; // ≈ 16.40 CHF pour 20 USD
  const montantUSD = 20.0;
  const montantCHF = Math.round(montantUSD * USD_TO_CHF * 100) / 100;

  // Trouve un admin pour createdBy
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  const expense = await prisma.expense.create({
    data: {
      date: new Date("2026-05-31"),
      dateReglement: new Date("2026-06-01"),
      categorie: "SOFTWARE_SAAS",
      fournisseur: "Netlify, Inc.",
      description:
        "Base Plan Netlify (3000 credits/mois — Bandwidth, Compute, Deploys, Web Requests) — facturé 20.00 USD",
      reference: "GJYLUZ-00011",
      statutPaiement: "PAYE",
      montantHT: montantCHF,
      tauxTVA: 0, // Service hors UE/CH, autoliquidation B2B non appliquée
      montantTVA: 0,
      montantTTC: montantCHF,
      tvaRecuperable: false,
      methodPaiement: "CARTE_BANCAIRE",
      ticketUrl: "/expenses/netlify-gjyluz-00011.pdf",
      ticketName: "Invoice-GJYLUZ-00011.pdf",
      ocrUtilise: false,
      createdById: admin?.id,
    },
  });

  console.log("✓ Charge créée :");
  console.log(`   ID         : ${expense.id}`);
  console.log(`   Fournisseur: ${expense.fournisseur}`);
  console.log(`   Référence  : ${expense.reference}`);
  console.log(`   Date       : ${expense.date.toISOString().slice(0, 10)}`);
  console.log(`   Catégorie  : ${expense.categorie}`);
  console.log(
    `   Montant    : ${montantUSD.toFixed(2)} USD ≈ CHF ${montantCHF.toFixed(2)}`,
  );
  console.log(`   Ticket     : ${expense.ticketUrl}`);
}
main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
