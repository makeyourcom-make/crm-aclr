/**
 * DRY-RUN (lecture seule) — diagnostic du lot d'activités mal typées en RDV.
 * Aucune écriture. Objectif : cadrer le nettoyage avant validation d'Arthur.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const RDV_TYPES = ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"] as const;
const now = new Date();
const inOneYear = new Date(now.getTime());
inOneYear.setFullYear(inOneYear.getFullYear() + 1);

function pct(n: number, d: number) {
  return d ? ((100 * n) / d).toFixed(1) + "%" : "-";
}

async function main() {
  console.log("=== Contexte ===");
  console.log("Maintenant:", now.toISOString(), "| +1 an:", inOneYear.toISOString());

  // ---- 1) Le lot SCI DJAIMM typé RDV_* ----
  const djaimmWhere = {
    type: { in: RDV_TYPES as unknown as any },
    sujet: { contains: "SCI DJAIMM", mode: "insensitive" as const },
  };
  const total = await prisma.activity.count({ where: djaimmWhere });
  console.log(`\n=== Lot "SCI DJAIMM" typé RDV_* ===`);
  console.log("Total:", total);

  // Par propriétaire
  const byUser = await prisma.activity.groupBy({
    by: ["userId"],
    where: djaimmWhere,
    _count: { _all: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: byUser.map((u) => u.userId) } },
    select: { id: true, name: true, email: true, isActive: true },
  });
  const uname = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? `${u.name} (${u.email}${u.isActive ? "" : ", INACTIF"})` : id;
  };
  console.log("\nPar propriétaire:");
  for (const r of byUser) console.log(`  ${uname(r.userId)}: ${r._count._all}`);

  // Par type
  const byType = await prisma.activity.groupBy({
    by: ["type"],
    where: djaimmWhere,
    _count: { _all: true },
  });
  console.log("\nPar type:");
  for (const r of byType) console.log(`  ${r.type}: ${r._count._all}`);

  // Par statut
  const byStatut = await prisma.activity.groupBy({
    by: ["statut"],
    where: djaimmWhere,
    _count: { _all: true },
  });
  console.log("\nPar statut:");
  for (const r of byStatut) console.log(`  ${r.statut}: ${r._count._all}`);

  // Rattachement prospect
  const withProspect = await prisma.activity.count({
    where: { ...djaimmWhere, prospectId: { not: null } },
  });
  console.log(`\nRattachées à un prospect: ${withProspect} / ${total} (reste = notes internes prospectId null)`);

  // Dates : min / max / futures / > +1an / passées
  const dates = await prisma.activity.findMany({
    where: djaimmWhere,
    select: { date: true },
    orderBy: { date: "asc" },
  });
  const minD = dates[0]?.date, maxD = dates[dates.length - 1]?.date;
  const future = dates.filter((d) => d.date > now).length;
  const past = dates.filter((d) => d.date <= now).length;
  const beyond1y = dates.filter((d) => d.date > inOneYear).length;
  console.log("\nDates:");
  console.log("  min:", minD?.toISOString(), "| max:", maxD?.toISOString());
  console.log(`  passées (<= now): ${past}`);
  console.log(`  futures (> now): ${future}`);
  console.log(`  > +1 an (lot absurde): ${beyond1y} (${pct(beyond1y, total)})`);

  // Sync externe
  const withGoogle = await prisma.activity.count({
    where: { ...djaimmWhere, googleEventId: { not: null } },
  });
  const withCaldav = await prisma.activity.count({
    where: { ...djaimmWhere, caldavHref: { not: null } },
  });
  const withCaldavUid = await prisma.activity.count({
    where: { ...djaimmWhere, caldavUid: { not: null } },
  });
  console.log("\nSync externe (sur le lot):");
  console.log(`  googleEventId non-null: ${withGoogle}`);
  console.log(`  caldavHref non-null: ${withCaldav}`);
  console.log(`  caldavUid non-null: ${withCaldavUid}`);

  // Chaînes de relances (rappelLeDeId / prochaineActivityId) — risque de SetNull en cascade
  const withRappelParent = await prisma.activity.count({
    where: { ...djaimmWhere, rappelLeDeId: { not: null } },
  });
  const withProchaine = await prisma.activity.count({
    where: { ...djaimmWhere, prochaineActivityId: { not: null } },
  });
  const withEmail = await prisma.activity.count({
    where: { ...djaimmWhere, emailId: { not: null } },
  });
  console.log("\nLiens internes (sur le lot):");
  console.log(`  rappelLeDeId non-null: ${withRappelParent}`);
  console.log(`  prochaineActivityId non-null: ${withProchaine}`);
  console.log(`  emailId non-null: ${withEmail}`);

  // Échantillon
  const sample = await prisma.activity.findMany({
    where: djaimmWhere,
    select: {
      id: true, type: true, date: true, sujet: true, statut: true,
      googleEventId: true, caldavUid: true, prospectId: true, userId: true,
      contenu: true,
    },
    orderBy: { date: "asc" },
    take: 6,
  });
  const sampleLast = await prisma.activity.findMany({
    where: djaimmWhere,
    select: { id: true, type: true, date: true, sujet: true },
    orderBy: { date: "desc" },
    take: 3,
  });
  console.log("\nÉchantillon (6 premiers par date):");
  for (const a of sample) {
    console.log(`  [${a.date.toISOString().slice(0, 10)}] ${a.type} | ${a.statut} | g=${a.googleEventId ? "Y" : "-"} cd=${a.caldavUid ? "Y" : "-"} p=${a.prospectId ? "Y" : "-"} | "${a.sujet}"`);
  }
  console.log("Échantillon (3 derniers par date):");
  for (const a of sampleLast) {
    console.log(`  [${a.date.toISOString().slice(0, 10)}] ${a.type} | "${a.sujet}"`);
  }

  // ---- 2) Autres sujets récurrents potentiellement mal typés en RDV_* ----
  console.log(`\n\n=== Autres sujets RDV_* suspects (futurs > +1 an, groupés par sujet) ===`);
  const futureFarRdv = await prisma.activity.findMany({
    where: { type: { in: RDV_TYPES as unknown as any }, date: { gt: inOneYear } },
    select: { sujet: true },
  });
  const countBySujet = new Map<string, number>();
  for (const a of futureFarRdv) {
    countBySujet.set(a.sujet, (countBySujet.get(a.sujet) ?? 0) + 1);
  }
  const ranked = [...countBySujet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log(`RDV_* avec date > +1 an: ${futureFarRdv.length} au total, ${countBySujet.size} sujets distincts.`);
  console.log("Top sujets (date > +1 an):");
  for (const [sujet, n] of ranked) console.log(`  ${n.toString().padStart(5)} × "${sujet.slice(0, 70)}"`);

  // ---- 3) Vue d'ensemble agenda RDV d'Arthur (pour le "RDV à venir") ----
  console.log(`\n\n=== RDV_* d'Arthur à venir (impact compteur) ===`);
  const arthur = await prisma.user.findFirst({
    where: { OR: [{ name: { contains: "Arthur", mode: "insensitive" } }, { email: { contains: "contact@makeyourcom" } }] },
    select: { id: true, name: true, email: true },
  });
  if (arthur) {
    console.log("Arthur =", arthur.name, arthur.email, arthur.id);
    const rdvFuturs = await prisma.activity.count({
      where: { userId: arthur.id, type: { in: RDV_TYPES as unknown as any }, date: { gt: now } },
    });
    const rdvFutursDjaimm = await prisma.activity.count({
      where: { userId: arthur.id, type: { in: RDV_TYPES as unknown as any }, date: { gt: now }, sujet: { contains: "SCI DJAIMM", mode: "insensitive" } },
    });
    console.log(`  RDV_* futurs (> now): ${rdvFuturs}`);
    console.log(`  dont SCI DJAIMM: ${rdvFutursDjaimm}`);
    console.log(`  RDV_* futurs hors SCI DJAIMM: ${rdvFuturs - rdvFutursDjaimm}`);
  } else {
    console.log("  (Arthur introuvable par nom/email)");
  }
}

main()
  .catch((e) => { console.error("ERREUR:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
