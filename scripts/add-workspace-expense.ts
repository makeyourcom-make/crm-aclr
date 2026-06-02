/**
 * Ajoute la facture Google Workspace (mai 2026) aux charges.
 *
 * Facture GCFRD0013042438 du 31 mai 2026 (Google Cloud France SARL)
 *   - Période : 1 mai - 31 mai 2026
 *   - 2 utilisateurs Google Workspace Business Standard
 *   - HT 32.39 EUR + TVA 20% (6.48 EUR) = 38.87 EUR TTC
 *   - Domaine facturé : make-marketing.ch
 *
 * Conversion EUR → CHF : taux estimatif 0.93 (mai 2026).
 * Note : facturée à M A K E (FR), TVA française non récupérable côté ACLR (CH).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const EUR_TO_CHF = 0.93;
  const htEur = 32.39;
  const tvaEur = 6.48;
  const ttcEur = 38.87;

  const htChf = Math.round(htEur * EUR_TO_CHF * 100) / 100;
  const tvaChf = Math.round(tvaEur * EUR_TO_CHF * 100) / 100;
  const ttcChf = Math.round(ttcEur * EUR_TO_CHF * 100) / 100;

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  const expense = await prisma.expense.create({
    data: {
      date: new Date("2026-05-31"),
      dateReglement: new Date("2026-06-01"),
      categorie: "SOFTWARE_SAAS",
      fournisseur: "Google Cloud France SARL",
      description:
        "Google Workspace Business Standard — 2 utilisateurs — Mai 2026 (domaine make-marketing.ch) — facturé 38.87 EUR TTC",
      reference: "GCFRD0013042438",
      statutPaiement: "PAYE",
      montantHT: htChf,
      tauxTVA: 0.2, // 20% TVA française appliquée
      montantTVA: tvaChf,
      montantTTC: ttcChf,
      tvaRecuperable: false, // facturé à M A K E (FR), non récupérable côté ACLR
      methodPaiement: "CARTE_BANCAIRE",
      ticketUrl: "/expenses/google-workspace-gcfrd0013042438.pdf",
      ticketName: "GCFRD0013042438.pdf",
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
    `   HT         : ${htEur.toFixed(2)} EUR ≈ CHF ${htChf.toFixed(2)}`,
  );
  console.log(
    `   TVA 20%    : ${tvaEur.toFixed(2)} EUR ≈ CHF ${tvaChf.toFixed(2)} (non récupérable)`,
  );
  console.log(
    `   TTC        : ${ttcEur.toFixed(2)} EUR ≈ CHF ${ttcChf.toFixed(2)}`,
  );
  console.log(`   Ticket     : ${expense.ticketUrl}`);
}
main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
