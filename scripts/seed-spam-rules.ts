/**
 * Seed des règles anti-spam évidentes + nettoyage rétroactif.
 * Ne touche QUE le spam clair (arnaques/marketing en allemand, faux
 * bankofamerica/ubuntu). Les notifications légitimes (Metricool, Google avis,
 * LocFactory, WordPress…) NE sont PAS bloquées — décision laissée à Arthur.
 */
import { PrismaClient } from "@prisma/client";
import { findBlockingRule } from "../lib/email-block";
const prisma = new PrismaClient();

const RULES: Array<{ type: "SENDER"|"DOMAIN"|"SUBJECT"; value: string }> = [
  { type:"DOMAIN",  value:"pixnet.net" },
  { type:"DOMAIN",  value:"capemploi.info" },
  { type:"DOMAIN",  value:"casseurdefuites.fr" },
  { type:"DOMAIN",  value:"osau.edu.ua" },
  { type:"DOMAIN",  value:"aiboost24.ch" },
  { type:"SUBJECT", value:"breezi" },
  { type:"SUBJECT", value:"gewichtsverlust" },
  { type:"SUBJECT", value:"schnelle kredite" },
];

async function main() {
  for (const r of RULES) {
    await prisma.emailBlockRule.upsert({
      where: { type_value: { type: r.type, value: r.value } },
      create: { type: r.type, value: r.value },
      update: { actif: true },
    });
  }
  console.log(`${RULES.length} règles seed en place.`);

  // Nettoyage rétroactif : mails entrants (hors clients) qui matchent → corbeille.
  const rules = await prisma.emailBlockRule.findMany({ where: { actif: true }, select: { id:true, type:true, value:true } });
  const inbound = await prisma.email.findMany({
    where: { direction: "ENTRANT", supprime: false, prospectId: null },
    select: { id: true, expediteurEmail: true, objet: true },
  });
  const perRule = new Map<string, number>();
  const ids: string[] = [];
  for (const e of inbound) {
    const hit = findBlockingRule(e.expediteurEmail, e.objet, rules as any);
    if (hit) { ids.push(e.id); perRule.set(hit.id, (perRule.get(hit.id)??0)+1); }
  }
  if (ids.length) {
    await prisma.email.updateMany({ where: { id: { in: ids } }, data: { supprime: true, supprimeeLe: new Date(), lu: true } });
    for (const [rid, n] of perRule) await prisma.emailBlockRule.update({ where: { id: rid }, data: { nbBloques: { increment: n } } });
  }
  console.log(`Nettoyage rétroactif : ${ids.length} mail(s) → corbeille.`);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
