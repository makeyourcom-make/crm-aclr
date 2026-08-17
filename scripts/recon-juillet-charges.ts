/**
 * Rapprochement bancaire juillet 2026 — saisie des charges MANQUANTES.
 *
 * Débits présents sur les relevés UBS (comptes 7501 F, 7502 T, 7560 Z EUR) mais
 * absents du CRM. Montants au CHF EXACT du relevé (pas de conversion estimée),
 * sauf Lucas Carlin débité en EUR (compte 7560) → converti à 0.93.
 *
 * TVA : fournisseurs suisses (Delik, UBS) récupérable ; étrangers (Google,
 * Metricool, Netlify, LWS, restos FR, Amazon FR, Lucas) non récupérable, comme
 * les mois précédents.
 *
 * NON inclus volontairement : les lignes Entrepôt/DEDB Amphion (risque de
 * doublon avec les tickets déjà saisis — à rapprocher avec les reçus).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const EUR_TO_CHF = 0.93;

type C = { date: string; four: string; cat: string; ttc: number; tva: number; recup: boolean; pay: string; desc: string; ref: string };
const CHARGES: C[] = [
  // Compte 7501 F
  { date:"2026-07-06", four:"Delik Sàrl", cat:"HONORAIRES", ttc:2750, tva:0.081, recup:true, pay:"VIREMENT", desc:"Delik Sàrl (Sophie Salvan) — commission et prestations juillet 2026", ref:"UBS 7501 06.07 — ordre global e-banking" },
  { date:"2026-07-31", four:"UBS", cat:"BANQUE_FRAIS", ttc:8.00, tva:0, recup:false, pay:"PRELEVEMENT", desc:"Frais UBS — décompte prix prestations juillet (comptes 7501 + 7502, 2×4.00)", ref:"UBS décompte 31.07.2026" },
  // Compte 7502 T — SaaS / pub
  { date:"2026-07-16", four:"Metricool", cat:"SOFTWARE_SAAS", ttc:538.47, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"Metricool — licences réseaux sociaux", ref:"UBS 7502 16.07 — METRICOOL.COM" },
  { date:"2026-07-13", four:"Google Ads", cat:"PUBLICITE", ttc:329.16, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"Google Ads (compte 5634624049) — à répartir sur les projets clients", ref:"UBS 7502 13.07 — Google ADS5634624049" },
  { date:"2026-07-01", four:"Google Ads", cat:"PUBLICITE", ttc:212.34, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"Google Ads (compte 4887602827) — à répartir sur les projets clients", ref:"UBS 7502 01.07 — Google ADS4887602827" },
  { date:"2026-07-01", four:"Google Ads", cat:"PUBLICITE", ttc:210.72, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"Google Ads (compte 5634624049) — à répartir sur les projets clients", ref:"UBS 7502 01.07 — Google ADS5634624049" },
  { date:"2026-07-01", four:"Google Workspace", cat:"SOFTWARE_SAAS", ttc:36.35, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"Google Workspace Business — juillet 2026", ref:"UBS 7502 01.07 — Google Workspace make-ma" },
  { date:"2026-07-01", four:"Google Cloud", cat:"SOFTWARE_SAAS", ttc:16.12, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"Google Cloud — juillet 2026", ref:"UBS 7502 01.07 — Google CLOUD N4X9G5" },
  { date:"2026-07-31", four:"Netlify", cat:"SOFTWARE_SAAS", ttc:8.40, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"Netlify — juillet 2026", ref:"UBS 7502 31.07 — NETLIFY" },
  { date:"2026-07-01", four:"Ligne Web Services (LWS)", cat:"SOFTWARE_SAAS", ttc:8.84, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"LWS — nom de domaine (2e prélèvement)", ref:"UBS 7502 01.07 — LIGNE WEB SERVI" },
  // Amazon — achat net (195.02 - 36.70 - 27.77 remboursements)
  { date:"2026-07-07", four:"Amazon", cat:"MATERIEL_BUREAU", ttc:130.55, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"Amazon — achat 195.02 net des remboursements 36.70 (22.07) + 27.77 (18.07) = 130.55 (TVA FR non récup.)", ref:"UBS 7502 07.07 — AMZN Mktp FR*V58G291Z5" },
  // Restaurants FR (TVA non récup.)
  { date:"2026-07-31", four:"Margaux", cat:"RESTAURATION", ttc:54.54, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"MARGAUX — restauration (TVA FR non récup.)", ref:"UBS 7502 31.07 — MARGAUX" },
  { date:"2026-07-30", four:"Crêperie du Roy", cat:"RESTAURATION", ttc:101.54, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"Crêperie du Roy — restauration (TVA FR non récup.)", ref:"UBS 7502 30.07 — CREPERIE DU ROY" },
  { date:"2026-07-29", four:"Breizh Café", cat:"RESTAURATION", ttc:139.75, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"Breizh Café — restauration (TVA FR non récup.)", ref:"UBS 7502 29.07 — BREIZH CAFE" },
  { date:"2026-07-28", four:"Amorino", cat:"RESTAURATION", ttc:18.66, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"Amorino Bretagne — restauration (TVA FR non récup.)", ref:"UBS 7502 28.07 — AMORINO BRETAGNE" },
  { date:"2026-07-27", four:"Amorino", cat:"RESTAURATION", ttc:29.77, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"Amorino Bretagne — restauration (TVA FR non récup.)", ref:"UBS 7502 27.07 — AMORINO BRETAGNE" },
  { date:"2026-07-26", four:"Emelia", cat:"RESTAURATION", ttc:36.07, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"EMELIA — restauration (TVA FR non récup.)", ref:"UBS 7502 26.07 — EMELIA" },
  { date:"2026-07-19", four:"Restaurant Royal", cat:"RESTAURATION", ttc:106.51, tva:0, recup:false, pay:"CARTE_BANCAIRE", desc:"Restaurant Royal — restauration (TVA FR non récup.)", ref:"UBS 7502 19.07 — RESTAURANT ROYAL" },
  // Compte 7560 Z EUR — Lucas 200€
  { date:"2026-07-02", four:"Lucas Carlin (EI)", cat:"HONORAIRES", ttc:Math.round(200*EUR_TO_CHF*100)/100, tva:0, recup:false, pay:"VIREMENT", desc:"Lucas Carlin — Community Manager juillet 2026 (200 € via compte EUR ≈ CHF)", ref:"UBS 7560 02.07 — CARLIN LUCAS (200 EUR)" },
];

async function main() {
  let total = 0, créées = 0;
  for (const c of CHARGES) {
    const exist = await prisma.expense.findFirst({ where: { reference: c.ref } });
    total += c.ttc;
    if (exist) { console.log(`⏭  déjà: ${c.four} ${c.ttc}`); continue; }
    console.log(`${APPLY?"✓":"·"} ${c.date} | ${c.four.padEnd(26)} | ${c.cat.padEnd(15)} | CHF ${c.ttc.toFixed(2).padStart(8)} | récup=${c.recup}`);
    if (!APPLY) continue;
    await prisma.expense.create({ data: {
      date:new Date(c.date), dateReglement:new Date(c.date), categorie:c.cat as never, fournisseur:c.four,
      description:c.desc, reference:c.ref, statutPaiement:"PAYE",
      montantHT:c.ttc, tauxTVA:c.tva, montantTVA: c.recup ? Math.round(c.ttc*c.tva/(1+c.tva)*100)/100 : 0,
      montantTTC:c.ttc, tvaRecuperable:c.recup, methodPaiement:c.pay as never,
    }});
    créées++;
  }
  console.log(`\nTotal du lot : CHF ${total.toFixed(2)} | ${APPLY?`créées: ${créées}`:"DRY-RUN (--apply pour écrire)"}`);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
