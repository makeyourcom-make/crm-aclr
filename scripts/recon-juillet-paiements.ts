/**
 * Rapprochement bancaire juillet — pointage des paiements clients CERTAINS.
 *
 * Chaque ligne = un crédit du relevé identifié sans ambiguïté à UNE facture
 * ouverte (montant exact + émetteur reconnu). Passe la facture en PAYEE avec la
 * date du crédit bancaire. Refuse si la facture n'est plus ENVOYEE/EN_RETARD.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const PAIEMENTS = [
  { num:"26-87",              date:"2026-07-23", montant:1891.5, emetteur:"Vereecke Myriam (Hôtel de Torgon)" },
  { num:"ACLR-CLI-2026-0500", date:"2026-07-13", montant:543.7,  emetteur:"Unleash Lab Sàrl" },
  { num:"ACLR-CLI-2026-0515", date:"2026-07-22", montant:354,    emetteur:"FB Réalisations Graphiques (LaPochette)" },
  { num:"ACLR-CLI-2026-0511", date:"2026-07-15", montant:269.9,  emetteur:"Marie-Hélène Rey Lescure (EPILDEF)" },
  { num:"ACLR-CLI-2026-0504", date:"2026-07-01", montant:500,    emetteur:"La Dent Byantse Sàrl" },
  { num:"ACLR-CLI-2026-0512", date:"2026-07-17", montant:120,    emetteur:"Protoconcept Engineering GmbH" },
  { num:"ACLR-CLI-2026-0501", date:"2026-07-06", montant:98,     emetteur:"FrakaXessoires" },
  { num:"ACLR-CLI-2026-0516", date:"2026-07-27", montant:29.9,   emetteur:"Star Creation Zen (Cozzarolo)" },
];

async function main() {
  for (const p of PAIEMENTS) {
    const f = await prisma.clientInvoice.findFirst({ where: { numero: p.num },
      include: { contract: { select: { prospect: { select: { raisonSociale: true } } } } } });
    if (!f) { console.log(`⚠ ${p.num} introuvable`); continue; }
    const okMontant = Math.abs(Number(f.total) - p.montant) < 0.01;
    const okStatut = f.statut === "ENVOYEE" || f.statut === "EN_RETARD";
    const line = `${p.num.padEnd(20)} | ${f.contract.prospect.raisonSociale.padEnd(24)} | ${f.devise} ${f.total} | ${f.statut} → PAYEE (${p.date}) | émetteur: ${p.emetteur}`;
    if (!okMontant) { console.log(`⚠ ÉCART MONTANT ${p.num}: facture ${f.total} ≠ crédit ${p.montant} — ignoré`); continue; }
    if (!okStatut) { console.log(`⏭ ${p.num} déjà ${f.statut} — ignoré`); continue; }
    console.log(`${APPLY?"✓":"·"} ${line}`);
    if (!APPLY) continue;
    await prisma.clientInvoice.update({ where: { id: f.id }, data: { statut: "PAYEE", datePaiement: new Date(p.date), modeReglement: "VIREMENT" } });
  }
  console.log(APPLY ? "\nAppliqué." : "\nDRY-RUN (--apply pour écrire).");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
