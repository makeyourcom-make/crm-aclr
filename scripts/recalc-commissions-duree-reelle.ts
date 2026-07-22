/**
 * Recalcule les commissions SIGNATURE des contrats de moins de 12 mois
 * (lignes non-ADS), suite au passage à l'assiette « durée réelle »
 * (décision Arthur du 22.07.2026 — cf. lib/commissions.ts).
 *
 * Ne touche QUE les commissions encore DUE dont aucun versement n'est PAYE :
 * on ne réécrit jamais de l'argent déjà sorti.
 *
 * Réutilise les helpers de production (computeAssietteCommissionContrat,
 * computeCommissionSignature, buildSignaturePaymentPlan) pour garantir que le
 * recalcul est identique à ce que ferait une création de contrat aujourd'hui.
 */
import { PrismaClient } from "@prisma/client";
import {
  buildSignaturePaymentPlan,
  computeAssietteCommissionContrat,
  computeCommissionSignature,
} from "../lib/commissions";

const prisma = new PrismaClient();
const chfToCents = (n: number) => Math.round(n * 100);
const centsToChf = (c: number) => c / 100;
const APPLY = process.argv.includes("--apply");

async function main() {
  const contrats = await prisma.contract.findMany({
    where: { dureeMois: { lt: 12 }, montantMensuel: { gt: 0 } },
    select: {
      id: true, numero: true, dureeMois: true, dateSignature: true,
      montantOneShot: true, montantMensuel: true, lignesMeta: true,
      prospect: { select: { raisonSociale: true } },
      assigneA: { select: { name: true, tauxCommissionSignature: true } },
      products: { select: { id: true, categorie: true, categorieCode: true, prixOneShot: true, prixMensuel: true } },
      commissions: { select: { id: true, montantTotal: true, statut: true,
        payments: { select: { id: true, statut: true } } } },
    },
    orderBy: { numero: "asc" },
  });

  for (const c of contrats) {
    const com = c.commissions[0];
    if (!com) { console.log(`${c.numero} : aucune commission — ignoré`); continue; }
    const dejaPaye = com.payments.some((p) => p.statut === "PAYE");
    if (com.statut !== "DUE" || dejaPaye) {
      console.log(`${c.numero} : statut ${com.statut}${dejaPaye ? " + versement PAYÉ" : ""} — NON touché`);
      continue;
    }

    // Assiette par ligne : on répartit les montants du contrat sur ses produits.
    // Un seul produit dans tous les cas concernés → mapping direct.
    const lines = c.products.map((p) => ({
      oneShotCents: chfToCents(Number(p.prixOneShot ?? 0)),
      mensuelCents: chfToCents(Number(p.prixMensuel ?? 0)),
      categorie: p.categorieCode ?? p.categorie,
    }));
    // Garde-fou : la somme des lignes doit retomber sur les montants du contrat.
    const sommeMensuel = lines.reduce((s, l) => s + l.mensuelCents, 0);
    if (sommeMensuel !== chfToCents(Number(c.montantMensuel))) {
      console.log(`${c.numero} : ⚠ lignes (${centsToChf(sommeMensuel)}) ≠ contrat (${c.montantMensuel}) — IGNORÉ (à revoir à la main)`);
      continue;
    }

    const assiette = computeAssietteCommissionContrat(lines, c.dureeMois);
    const taux = Number(c.assigneA.tauxCommissionSignature);
    const calc = computeCommissionSignature({ valeurAn1Cents: assiette, taux });
    const ancien = Number(com.montantTotal);
    const nouveau = centsToChf(calc.totalCents);
    if (Math.abs(ancien - nouveau) < 0.005) {
      console.log(`${c.numero} : déjà à jour (${ancien.toFixed(2)})`);
      continue;
    }

    console.log(`${c.numero} | ${c.prospect.raisonSociale} | ${c.assigneA.name} | ${c.dureeMois} mois`);
    console.log(`   commission ${ancien.toFixed(2)} → ${nouveau.toFixed(2)} CHF (assiette ${centsToChf(assiette).toFixed(2)})`);

    if (!APPLY) continue;

    const plan = buildSignaturePaymentPlan({ valeurAn1Cents: assiette, taux, dateSignature: c.dateSignature });
    await prisma.$transaction(async (tx) => {
      await tx.commission.update({
        where: { id: com.id },
        data: {
          montantTotal: nouveau,
          montantPart1: centsToChf(calc.partSignatureCents),
          montantPart2: centsToChf(calc.totalEtalementsCents),
        },
      });
      // Les versements PRÉVUS sont régénérés à l'identique de la création.
      await tx.commissionPayment.deleteMany({ where: { commissionId: com.id } });
      await tx.commissionPayment.createMany({
        data: plan.map((p) => ({
          commissionId: com.id,
          numeroMois: p.numeroMois,
          typePart: p.typePart,
          montant: centsToChf(p.montantCents),
          dateVersementPrevue: p.dateVersementPrevue,
        })),
      });
    });
    console.log(`   ✓ mis à jour (${plan.length} versements régénérés)`);
  }
  console.log(APPLY ? "\nAppliqué." : "\nDRY-RUN — relancer avec --apply pour écrire.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
