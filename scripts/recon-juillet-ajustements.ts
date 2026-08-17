/**
 * Rapprochement juillet — ajustements suite aux précisions d'Arthur :
 *   - PhysioDom : le +249.50 (06.07) = 2e acompte (solde) du site → déjà pointé
 *     (SOLDE 0509), on aligne juste la date de paiement sur le relevé (06.07).
 *   - L&L Coiffure : le +39 (06.07) = abonnement mensuel juillet → déjà pointé
 *     (0502), date alignée sur 06.07.
 *   - La Dent : abonnement mensuel. Le 2e +500 (29.07) = août payé d'avance →
 *     on pointe la mensualité d'août 0521 (jusqu'ici brouillon) comme PAYEE.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const ACTIONS = [
  { num:"ACLR-CLI-2026-0509", op:"date",  date:"2026-07-06", note:"PhysioDom solde site — date sur relevé" },
  { num:"ACLR-CLI-2026-0502", op:"date",  date:"2026-07-06", note:"L&L abonnement juillet — date sur relevé" },
  { num:"ACLR-CLI-2026-0521", op:"payer", date:"2026-07-29", note:"La Dent abonnement août payé d'avance (29.07)" },
];

async function main() {
  for (const a of ACTIONS) {
    const f = await prisma.clientInvoice.findFirst({ where: { numero: a.num },
      include: { contract: { select: { prospect: { select: { raisonSociale: true } } } } } });
    if (!f) { console.log(`⚠ ${a.num} introuvable`); continue; }
    const cli = f.contract.prospect.raisonSociale;
    if (a.op === "date") {
      console.log(`${APPLY?"✓":"·"} ${a.num} | ${cli} | ${f.statut} | date paiement → ${a.date} (${a.note})`);
      if (APPLY) await prisma.clientInvoice.update({ where: { id: f.id }, data: { datePaiement: new Date(a.date) } });
    } else {
      console.log(`${APPLY?"✓":"·"} ${a.num} | ${cli} | ${f.statut} → PAYEE (${a.date}) | ${a.note}`);
      if (APPLY) await prisma.clientInvoice.update({ where: { id: f.id }, data: { statut: "PAYEE", datePaiement: new Date(a.date), modeReglement: "VIREMENT" } });
    }
  }
  console.log(APPLY ? "\nAppliqué." : "\nDRY-RUN (--apply).");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
