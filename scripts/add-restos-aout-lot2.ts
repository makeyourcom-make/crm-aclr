/**
 * Charges — restaurants (Bretagne + retour Évian/Thonon), fin juillet / mi-août 2026.
 * Tickets FR : TVA non récup., EUR × 0.93 (relevé banque août pas encore reçu).
 *
 * NON inclus (déjà saisis au rapprochement de juillet) :
 *   - Amorino Bretagne 27/07 (30.30 €) = débit « AMORINO 29.77 »
 *   - Breizh Café Dinard 29/07 (145 €) = débit « BREIZH CAFE 139.75 »
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const EUR_TO_CHF = 0.93;
const chf = (e: number) => Math.round(e * EUR_TO_CHF * 100) / 100;

const R = [
  { date:"2026-07-30", four:"Epidinard",                  eur:105.00, pay:"ESPECES",        ref:"Epidinard — Dinard 30.07.2026 (fiche 14952-1, 3 repas, espèces)" },
  { date:"2026-08-03", four:"La Cabane du Rougeret",       eur:17.80,  pay:"CARTE_BANCAIRE", ref:"La Cabane du Rougeret — St-Jacut 03.08.2026 (facture 200)" },
  { date:"2026-08-05", four:"La Marie-Cécile",            eur:75.70,  pay:"CARTE_BANCAIRE", ref:"La Marie-Cécile — St-Malo 05.08.2026 (2 repas)" },
  { date:"2026-08-07", four:"Crêperie La Petite Auberge",  eur:57.50,  pay:"CARTE_BANCAIRE", ref:"La Petite Auberge — Malicorne 07.08.2026 (ticket 1545/01)" },
  { date:"2026-08-11", four:"Le Petit Navire",             eur:245.00, pay:"CARTE_BANCAIRE", ref:"Le Petit Navire — Neuvecelle 11.08.2026 (facture 28815, 5 repas)" },
  { date:"2026-08-13", four:"Bobo Smash Burgers",          eur:38.50,  pay:"CARTE_BANCAIRE", ref:"Bobo Smash Burgers — Thonon 13.08.2026 (reçu 509)" },
  { date:"2026-08-13", four:"Bobo Smash Burgers",          eur:4.00,   pay:"CARTE_BANCAIRE", ref:"Bobo Smash Burgers — Thonon 13.08.2026 (reçu 512, frites)" },
];

async function main() {
  let totalEur=0, totalChf=0, créées=0;
  for (const r of R) {
    const exist = await prisma.expense.findFirst({ where: { reference: r.ref } });
    const c = chf(r.eur); totalEur+=r.eur; totalChf+=c;
    if (exist) { console.log(`⏭  déjà: ${r.four}`); continue; }
    console.log(`${APPLY?"✓":"·"} ${r.date} | ${r.four.padEnd(26)} | ${r.eur.toFixed(2).padStart(7)} € ≈ CHF ${c.toFixed(2).padStart(7)} | ${r.pay}`);
    if (!APPLY) continue;
    await prisma.expense.create({ data: {
      date:new Date(r.date), dateReglement:new Date(r.date), categorie:"RESTAURATION", fournisseur:r.four,
      description:`${r.four} — restauration (TVA FR non récup.) — ${r.eur.toFixed(2)} €`,
      reference:r.ref, statutPaiement:"PAYE",
      montantHT:c, tauxTVA:0, montantTVA:0, montantTTC:c, tvaRecuperable:false, methodPaiement:r.pay as never,
    }});
    créées++;
  }
  console.log(`\nTotal : ${totalEur.toFixed(2)} € ≈ CHF ${totalChf.toFixed(2)} | ${APPLY?`créées: ${créées}`:"DRY-RUN (--apply)"}`);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
