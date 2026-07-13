import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const R = 0.93;
// déc→fév : lead-gen MakeYourCom (aucun client Google Ads à l'époque) ; mars : idem (Good4Bees démarre le 31.03)
const F = [
  { ref:"5456306702", date:"2025-12-31", eur:449.71, lbl:"Google Ads (compte 488-760-2827) — décembre 2025 — lead-gen MakeYourCom (aucun client à cette date)" },
  { ref:"5485633758", date:"2026-01-31", eur:605.38, lbl:"Google Ads (compte 488-760-2827) — janvier 2026 — lead-gen MakeYourCom" },
  { ref:"5509689458", date:"2026-02-28", eur:356.48, lbl:"Google Ads (compte 488-760-2827) — février 2026 — lead-gen MakeYourCom" },
  { ref:"5536430848", date:"2026-03-31", eur:337.47, lbl:"Google Ads (compte 488-760-2827) — mars 2026 — lead-gen (Good4Bees démarre le 31.03)" },
];
async function main(){
  for(const f of F){
    const existing = await prisma.expense.findFirst({ where:{ reference:{ contains:f.ref } } });
    if(existing){ console.log(`déjà présent: ${f.ref}`); continue; }
    const chf = Math.round(f.eur*R*100)/100;
    const e = await prisma.expense.create({ data:{
      date:new Date(f.date), dateReglement:new Date(f.date), categorie:"PUBLICITE",
      fournisseur:"Google Ireland Ltd", description:f.lbl, reference:`Facture Google ${f.ref}`,
      statutPaiement:"PAYE", montantHT:chf, tauxTVA:0, montantTVA:0, montantTTC:chf, tvaRecuperable:false, methodPaiement:"PRELEVEMENT",
    }});
    console.log(`ajouté ${f.ref} | ${f.date} | ${f.eur}€ ≈ ${chf} CHF`);
  }
  const tot = await prisma.expense.aggregate({ where:{ categorie:"PUBLICITE", reference:{ startsWith:"Facture Google" } }, _sum:{ montantTTC:true } });
  console.log("\nTotal charges Google Ads déc→mars ajoutées:", Number(tot._sum.montantTTC||0).toFixed(2), "CHF");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
