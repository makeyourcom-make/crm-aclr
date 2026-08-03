/**
 * Génère les mensualités du mois COURANT (août 2026) via la fonction de
 * production `generateDueClientInvoices` — exactement ce que le cron nocturne
 * exécute. Idempotent (dédup par période/mois), BROUILLON, respecte les pauses.
 *
 * Nécessaire car le cron nocturne n'a pas tourné en prod (aucun snapshot Stat,
 * aucune facture auto — toutes créées à la main). Ce script fait le rattrapage
 * du mois courant sans rien envoyer au client.
 */
import { generateDueClientInvoices } from "../app/(app)/contrats/actions";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Lancement generateDueClientInvoices() (= cron nocturne, étape factures)…\n");
  const res = await generateDueClientInvoices();
  console.log(`Résultat : ok=${res.ok} | créées=${res.created}${res.error ? " | erreur="+res.error : ""}\n`);

  const mk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  const aout = await prisma.clientInvoice.findMany({
    where: { periodeMoisDebut: { gte: new Date("2026-08-01"), lte: new Date("2026-08-31") } },
    include: { contract: { select: { prospect: { select: { raisonSociale: true } } } } },
    orderBy: { total: "desc" },
  });
  console.log(`Factures AOÛT désormais en base : ${aout.length}`);
  let tot = 0;
  for (const f of aout) { tot += Number(f.total); console.log(`   ${f.numero} | ${f.contract.prospect.raisonSociale.padEnd(34)} | ${f.statut} | ${f.devise} ${Number(f.total).toFixed(2)}`); }
  console.log(`\n   Total facturé août : CHF ${tot.toFixed(2)} (hors EUR)`);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
