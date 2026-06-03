/**
 * Ajoute la facture Hetzner (Project n8n - MakeMedia) aux charges,
 * liée au client M A K E & Beyond pour traçabilité rentabilité.
 *
 * Source : Invoice 080000950402 du 03/06/2026 (Hetzner Online GmbH)
 *   - CX23 Cloud Server (596h × 0.0064) = 3.8144 €
 *   - Primary IPv4 (596h × 0.0008) = 0.4768 €
 *   - Total HT : 4.29 € + TVA suisse 8.1% (0.35 €) = TTC 4.64 €
 *
 * Note : Hetzner facture en EUR mais applique la TVA suisse car ils ont un
 * numéro CHE de TVA (CHE-482.971.449 MWST). C'est une TVA SUISSE réelle
 * et donc récupérable côté ACLR si compte d'entreprise.
 *
 * Conversion EUR → CHF : taux 0.93
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const EUR_TO_CHF = 0.93;
  const htEur = 4.29;
  const tvaEur = 0.35;
  const ttcEur = 4.64;
  const htChf = Math.round(htEur * EUR_TO_CHF * 100) / 100;
  const tvaChf = Math.round(tvaEur * EUR_TO_CHF * 100) / 100;
  const ttcChf = Math.round(ttcEur * EUR_TO_CHF * 100) / 100;

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  const makeProspect = await prisma.prospect.findFirst({
    where: { raisonSociale: { contains: "M A K E", mode: "insensitive" } },
    select: { id: true, raisonSociale: true },
  });

  const expense = await prisma.expense.create({
    data: {
      date: new Date("2026-06-03"),
      dateReglement: new Date("2026-06-03"),
      categorie: "SOFTWARE_SAAS",
      fournisseur: "Hetzner Online GmbH",
      description:
        "Hetzner Cloud — Project n8n MakeMedia (CX23 + Primary IPv4) — Période mai 2026 — 4.64 € TTC (TVA suisse 8.1%)",
      reference: "080000950402",
      statutPaiement: "PAYE",
      montantHT: htChf,
      tauxTVA: 0.081, // TVA suisse 8.1% (Hetzner CHE-482.971.449 MWST)
      montantTVA: tvaChf,
      montantTTC: ttcChf,
      tvaRecuperable: true, // TVA suisse réelle → récupérable
      methodPaiement: "CARTE_BANCAIRE",
      ticketUrl: "/expenses/hetzner-080000950402.pdf",
      ticketName: "Hetzner_2026-06-03_080000950402.pdf",
      ocrUtilise: false,
      createdById: admin?.id,
      prospectId: makeProspect?.id, // Charge liée à M A K E
    },
  });

  console.log("✓ Charge créée :");
  console.log(`   ID         : ${expense.id}`);
  console.log(`   Fournisseur: ${expense.fournisseur}`);
  console.log(`   Référence  : ${expense.reference}`);
  console.log(`   Date       : ${expense.date.toISOString().slice(0, 10)}`);
  console.log(`   Catégorie  : ${expense.categorie}`);
  console.log(`   Liée à     : ${makeProspect?.raisonSociale ?? "—"}`);
  console.log(`   HT         : ${htEur.toFixed(2)} EUR ≈ CHF ${htChf.toFixed(2)}`);
  console.log(`   TVA 8.1%   : ${tvaEur.toFixed(2)} EUR ≈ CHF ${tvaChf.toFixed(2)} (récupérable)`);
  console.log(`   TTC        : ${ttcEur.toFixed(2)} EUR ≈ CHF ${ttcChf.toFixed(2)}`);
  console.log(`   Ticket     : ${expense.ticketUrl}`);
}
main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
