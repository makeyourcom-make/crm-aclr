/**
 * Charges (lot mi-août) — factures/tickets déposés. Montants au réel ; EUR × 0.93,
 * USD × 0.82 (relevé banque d'août pas encore reçu, alignable ensuite).
 *
 * 9 PDF = 6 charges distinctes. NON inclus ici : Delik/Sophie #002 (2750) —
 * risque de doublon avec les 2 entrées Delik déjà en base, à trancher avec Arthur.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const chf = (v:number, rate:number) => Math.round(v*rate*100)/100;

const C = [
  // Anthropic Claude Max — $216.20 (VAT CH 8.1% incluse). SaaS, non récup (comme les mois précédents).
  { date:"2026-08-15", four:"Anthropic, PBC", cat:"SOFTWARE_SAAS", ttc:chf(216.20,0.82), tva:0, recup:false, pay:"CARTE_BANCAIRE",
    desc:"Anthropic Claude Max plan 20x — 216.20 USD (VAT CH 8.1%)", ref:"Facture Anthropic JWBLWCBD-0009" },
  // CFF abonnement mensuel Evian-Lausanne (Suisse) — TVA 8.1% récupérable.
  { date:"2026-08-16", four:"CFF", cat:"DEPLACEMENTS", ttc:292.00, tva:0.081, recup:true, pay:"CARTE_BANCAIRE",
    desc:"CFF — abonnement de parcours mensuel Evian-Lausanne (Chazelle Marie), 17.08–16.09.2026", ref:"CFF Cmde 151511080574 (Trx 260816190755923216)" },
  // Entrepôt du Bricolage — panneaux acoustiques Ecowall + colle (FR, non récup).
  { date:"2026-07-18", four:"L'Entrepôt du Bricolage", cat:"MATERIEL_BUREAU", ttc:chf(104.31,0.93), tva:0, recup:false, pay:"CARTE_BANCAIRE",
    desc:"Panneaux acoustiques Ecowall chêne cérusé ×2 + mortier colle — 104.31 € TTC (TVA FR non récup.)", ref:"Facture Entrepôt 74399900000019762 — BC 0220128362419" },
  // Entrepôt du Bricolage — équerre + plat acier + boîte vis (= débit DEDB Amphion 56.06 du relevé juillet, non saisi alors).
  { date:"2026-07-18", four:"L'Entrepôt du Bricolage", cat:"MATERIEL_BUREAU", ttc:chf(58.42,0.93), tva:0, recup:false, pay:"CARTE_BANCAIRE",
    desc:"Équerre chaise + plat acier laminé + boîte vis — 58.42 € TTC (TVA FR non récup.) = débit DEDB Amphion 56.06", ref:"Ticket Entrepôt 74301800000164995 (caisse 18 4014, 18.07 11:53)" },
  // Créer Ma Société.ch (Aggoun) — apporteur d'affaire (Suisse, sans TVA).
  { date:"2026-07-18", four:"Créer Ma Société.ch (Aggoun)", cat:"HONORAIRES", ttc:600.00, tva:0, recup:false, pay:"VIREMENT",
    desc:"Apporteur d'affaire — facture INV/2026/00185", ref:"Créer Ma Société INV/2026/00185" },
];

async function main() {
  let total=0, créées=0;
  for (const c of C) {
    const exist = await prisma.expense.findFirst({ where: { reference: c.ref } });
    total += c.ttc;
    if (exist) { console.log(`⏭  déjà: ${c.four} (${c.ref})`); continue; }
    console.log(`${APPLY?"✓":"·"} ${c.date} | ${c.four.padEnd(30)} | ${c.cat.padEnd(15)} | CHF ${c.ttc.toFixed(2).padStart(8)} | récup=${c.recup}`);
    if (!APPLY) continue;
    await prisma.expense.create({ data: {
      date:new Date(c.date), dateReglement:new Date(c.date), categorie:c.cat as never, fournisseur:c.four,
      description:c.desc, reference:c.ref, statutPaiement:"PAYE",
      montantHT:c.recup ? Math.round(c.ttc/(1+c.tva)*100)/100 : c.ttc,
      tauxTVA:c.tva, montantTVA:c.recup ? Math.round(c.ttc*c.tva/(1+c.tva)*100)/100 : 0,
      montantTTC:c.ttc, tvaRecuperable:c.recup, methodPaiement:c.pay as never,
    }});
    créées++;
  }
  console.log(`\nTotal : CHF ${total.toFixed(2)} | ${APPLY?`créées: ${créées}`:"DRY-RUN (--apply)"}`);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
