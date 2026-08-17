/**
 * Charges — restaurants Bretagne (Dinard / Saint-Malo / Saint-Briac), début août 2026.
 *
 * Tickets FR : TVA française non récupérable pour une Sàrl suisse → tout le TTC
 * est le coût. Montants en EUR (relevé bancaire août pas encore reçu) convertis
 * à 0.93 comme d'habitude ; alignables au CHF exact quand le relevé arrivera.
 *
 * NON inclus : Créperie Margaux 31/07 (56.40 €) — c'est le justificatif du débit
 * « MARGAUX 54.54 » déjà saisi au rapprochement de juillet.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const EUR_TO_CHF = 0.93;
const chf = (e: number) => Math.round(e * EUR_TO_CHF * 100) / 100;

const R = [
  { date:"2026-08-01", four:"Mermade (SARL EMCA)",         eur:83.00,  pay:"CARTE_BANCAIRE", ref:"Mermade — St-Briac 01.08.2026 (3 repas)" },
  { date:"2026-08-01", four:"La Digue (SAS Le Club)",      eur:51.60,  pay:"CARTE_BANCAIRE", ref:"La Digue — Dinard 01.08.2026" },
  { date:"2026-08-02", four:"Beauséjour",                  eur:120.60, pay:"CARTE_BANCAIRE", ref:"Beausejour — Dinard 02.08.2026 (doc 1063685)" },
  { date:"2026-08-03", four:"Le Pot De Beurre",            eur:65.00,  pay:"CARTE_BANCAIRE", ref:"Le Pot De Beurre — St-Lunaire 03.08.2026 (facture 2, 2 repas)" },
  { date:"2026-08-04", four:"La P'tite Longère",           eur:71.40,  pay:"ESPECES",        ref:"La P'tite Longère — Dinard 04.08.2026 (2 repas)" },
  { date:"2026-08-04", four:"Eatcetera",                   eur:72.00,  pay:"CARTE_BANCAIRE", ref:"Eatcetera — St-Malo 04.08.2026 (ticket 6000544, 2 repas)" },
  { date:"2026-08-05", four:"Castor Bellux",               eur:91.50,  pay:"CARTE_BANCAIRE", ref:"Castor Bellux — Dinard 05.08.2026 (4 repas)" },
  { date:"2026-08-06", four:"Breizh'Galia",                eur:117.50, pay:"CARTE_BANCAIRE", ref:"Breizh'Galia — Dinard 06.08.2026 (3 repas)" },
];

async function main() {
  let totalEur = 0, totalChf = 0, créées = 0;
  for (const r of R) {
    const exist = await prisma.expense.findFirst({ where: { reference: r.ref } });
    const c = chf(r.eur); totalEur += r.eur; totalChf += c;
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
