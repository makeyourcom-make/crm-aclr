/**
 * Delik/Sophie — corrige le doublon (décision Arthur, 17.08.2026).
 *
 * Le débit « Delik 06.07 » (rapprochement juillet) était en fait le PAIEMENT de
 * la facture #001 (juin), déjà comptée le 30.06. On le supprime et on saisit la
 * facture #002 (période juillet, 2750) → une commission par mois.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const doublon = await prisma.expense.findFirst({ where: { reference: "UBS 7501 06.07 — ordre global e-banking" } });
  const ref002 = "Facture Delik MAKE YOUR COM - 002";
  const existe002 = await prisma.expense.findFirst({ where: { reference: ref002 } });

  await prisma.$transaction(async (tx) => {
    if (doublon) { await tx.expense.delete({ where: { id: doublon.id } }); console.log(`✓ Supprimé le doublon 06.07 (${doublon.montantTTC})`); }
    else console.log("· Entrée 06.07 déjà absente");
    if (existe002) { console.log("· #002 déjà saisie"); return; }
    await tx.expense.create({ data: {
      date: new Date("2026-07-28"), dateReglement: new Date("2026-08-10"),
      categorie: "HONORAIRES", fournisseur: "DELIK GmbH (Sophie Salvan)",
      description: "Commission et prestations de service — période 01.07–31.07.2026 (facture MAKE 002)",
      reference: ref002, statutPaiement: "PAYE",
      montantHT: 2543.94, tauxTVA: 0.081, montantTVA: 206.06, montantTTC: 2750.00,
      tvaRecuperable: true, methodPaiement: "VIREMENT",
    }});
    console.log("✓ Facture #002 (juillet) saisie — CHF 2750.00 (TVA 8.1% récup.)");
  });

  // Contrôle : combien d'entrées Delik de 2750 restent, et sur quels mois ?
  const delik = await prisma.expense.findMany({ where: { fournisseur: { contains: "delik", mode: "insensitive" } },
    orderBy: { date: "asc" }, select: { date: true, montantTTC: true, reference: true } });
  console.log("\nÉtat Delik :");
  delik.forEach(d=>console.log(`   ${d.date.toISOString().slice(0,10)} | ${d.montantTTC} | ${d.reference}`));
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
