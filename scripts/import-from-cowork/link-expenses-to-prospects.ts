/**
 * Lie les charges aux clients (prospects) pour le P&L par client.
 *
 *   • Crée "La Laverie de Nevers" (nouveau prospect)
 *   • Lie LWS/Infomaniak/etc. aux bons prospects
 *   • Split Lucas en 3 lignes par mois (Sp Industriel + LocFactory + Passeport Beauté)
 *     selon les détails des factures 145 (Mars) et 150 (Avril)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function findProspect(rs: string) {
  const p = await prisma.prospect.findFirst({
    where: { raisonSociale: { equals: rs, mode: "insensitive" } },
  });
  return p;
}

async function findProspectLike(rs: string) {
  const p = await prisma.prospect.findFirst({
    where: { raisonSociale: { contains: rs, mode: "insensitive" } },
  });
  return p;
}

async function linkCharge(descPart: string, prospect: { id: string; raisonSociale: string } | null) {
  if (!prospect) {
    console.log(`  ⊘ ${descPart}: prospect non trouvé`);
    return;
  }
  const exps = await prisma.expense.findMany({
    where: { description: { contains: descPart, mode: "insensitive" } },
    select: { id: true, description: true, montantTTC: true },
  });
  if (exps.length === 0) {
    console.log(`  ⊘ "${descPart}" : aucune charge`);
    return;
  }
  for (const e of exps) {
    await prisma.expense.update({
      where: { id: e.id },
      data: { prospectId: prospect.id },
    });
    console.log(
      `  ✓ ${(e.description ?? "?").slice(0, 60).padEnd(60)} → ${prospect.raisonSociale}`,
    );
  }
}

async function main() {
  // ===== 1. Création de La Laverie de Nevers =====
  console.log("=== 1. Création La Laverie de Nevers ===");
  let laverie = await findProspectLike("Laverie de Nevers");
  if (!laverie) {
    laverie = await prisma.prospect.create({
      data: {
        raisonSociale: "La Laverie de Nevers",
        ville: "Nevers",
        codePostal: "58000",
        pays: "France",
        statut: "SIGNE",
        notesGenerales: "Client — 3 noms de domaine hébergés chez LWS",
      },
    });
    console.log(`  ✓ Créé : ${laverie.raisonSociale}  [${laverie.id.slice(-6)}]`);
  } else {
    console.log(`  ℹ Existe déjà : ${laverie.raisonSociale}`);
  }

  // ===== 2. Lookup tous les prospects nécessaires =====
  const PROSPECTS = {
    laverie,
    srt: await findProspect("SRT FORMATION"),
    physio: await findProspect("Lionel Briquet"),
    arcoz: await findProspect("ARCOZ AG"),
    makeBeyond: await findProspectLike("M A K E & Beyond"),
    qerkini: await findProspect("Qerkini Sàrl"),
    spIndustriel: await findProspect("SP Industriel"),
    locFactory: await findProspect("LocFactory"),
    passeport: await findProspect("Passeport Beauté"),
  };

  // ===== 3. Liaisons LWS / Infomaniak (single client) =====
  console.log("\n=== 2. Liaisons charges directes ===");

  // LWS srt-formation.fr → SRT FORMATION
  await linkCharge("srt-formation.fr", PROSPECTS.srt);

  // LWS make-marketing.ch → M A K E & Beyond
  await linkCharge("make-marketing.ch", PROSPECTS.makeBeyond);

  // LWS physio-montreux.ch → Lionel Briquet
  await linkCharge("physio-montreux.ch", PROSPECTS.physio);

  // LWS qerkini.ch → Qerkini
  await linkCharge("qerkini.ch", PROSPECTS.qerkini);

  // LWS Laverie Nevers → La Laverie de Nevers
  await linkCharge("Laverie Nevers", PROSPECTS.laverie);

  // Infomaniak arcoz-ag.ch → ARCOZ AG
  await linkCharge("arcoz-ag.ch", PROSPECTS.arcoz);

  console.log("\n=== 3. Split Lucas Community Manager ===");

  // ===== 4. Split Lucas =====
  // Lucas MARS : Facture 145 — 580 EUR HT → 544.08 CHF TTC
  //   Détails :
  //     - Base (200 + 20 = 220 EUR) → réparti pro-rata sur les 3 clients
  //     - SP Industriel : 100 EUR (Forfait Torgon 1 post)
  //     - LocFactory + Passeport Beauté : 260 EUR combiné (4 reels + 4 reels + 4 carrousels + 4 story)
  //       → on split à parts égales sur ces 2 (130 EUR chacun)
  // Pondération finale (Mars) : SP=100+220/3=173.33  LF=130+220/3=203.33  PP=130+220/3=203.33
  // Pour rester strict avec les détails facturés directement (sans base) :
  //   SP=100/360, LF=130/360, PP=130/360 → on applique ça au montant TTC.

  const lucasMars = await prisma.expense.findFirst({
    where: { description: "Lucas - Community Manager (Mars 2026)" },
  });
  if (lucasMars) {
    const ttc = Number(lucasMars.montantTTC); // 544.08 CHF
    // Pondération basée sur les détails (100 / 130 / 130 = 360 EUR sur 580 EUR)
    // On ajoute la base proportionnellement aux poids des détails :
    const wSP = 100 / 360;
    const wLF = 130 / 360;
    const wPP = 130 / 360;
    const allocSP = Math.round(ttc * wSP * 100) / 100;
    const allocLF = Math.round(ttc * wLF * 100) / 100;
    const allocPP = Math.round(ttc * wPP * 100) / 100;
    // Ajuste la dernière pour que la somme = ttc exact
    const allocPP_adj = Math.round((ttc - allocSP - allocLF) * 100) / 100;

    // Supprime les allocations existantes (idempotence)
    await prisma.expenseAllocation.deleteMany({
      where: { expenseId: lucasMars.id },
    });

    await prisma.expenseAllocation.createMany({
      data: [
        {
          expenseId: lucasMars.id,
          prospectId: PROSPECTS.spIndustriel!.id,
          montantHT: allocSP,
          note: "Forfait Torgon 1 post (100 EUR HT / 360 détaillés)",
        },
        {
          expenseId: lucasMars.id,
          prospectId: PROSPECTS.locFactory!.id,
          montantHT: allocLF,
          note: "4 reels (130 EUR HT / 360 détaillés)",
        },
        {
          expenseId: lucasMars.id,
          prospectId: PROSPECTS.passeport!.id,
          montantHT: allocPP_adj,
          note: "4 reels + 4 carrousels + 4 story (130 EUR HT / 360 détaillés)",
        },
      ],
    });
    console.log(
      `  ✓ Lucas Mars (${ttc.toFixed(2)} CHF) split : SP=${allocSP} / LF=${allocLF} / PP=${allocPP_adj}`,
    );
  }

  // Lucas AVRIL : Facture 150 — 500 EUR HT → 475.00 CHF TTC
  //   Détails :
  //     - Base (200 + 50 = 250 EUR)
  //     - 250 EUR combiné = SP Industriel (Forfait) + LocFactory (2 reels) + Passeport Beauté (4 reels + 2 posts + 2 carrousels + 4 story)
  //   Pondération : SP=80/250 (forfait), LF=40/250 (2 reels), PP=130/250 (gros volume)
  //   → On peut affiner si tu donnes les vrais montants. Ici je split à parts égales : 250/3 chacun
  const lucasAvril = await prisma.expense.findFirst({
    where: { description: "Lucas - Community Manager (Avril 2026)" },
  });
  if (lucasAvril) {
    const ttc = Number(lucasAvril.montantTTC); // 475.00 CHF
    // Parts égales sur les 3 clients (détails ne précisent pas le montant par client)
    const part = Math.round((ttc / 3) * 100) / 100;
    const partAdj = Math.round((ttc - 2 * part) * 100) / 100;

    await prisma.expenseAllocation.deleteMany({
      where: { expenseId: lucasAvril.id },
    });
    await prisma.expenseAllocation.createMany({
      data: [
        {
          expenseId: lucasAvril.id,
          prospectId: PROSPECTS.spIndustriel!.id,
          montantHT: part,
          note: "Forfait (1/3 part équivalente)",
        },
        {
          expenseId: lucasAvril.id,
          prospectId: PROSPECTS.locFactory!.id,
          montantHT: part,
          note: "2 reels (1/3 part équivalente)",
        },
        {
          expenseId: lucasAvril.id,
          prospectId: PROSPECTS.passeport!.id,
          montantHT: partAdj,
          note: "4 reels + 2 posts + 2 carrousels + 4 story (1/3 part équivalente)",
        },
      ],
    });
    console.log(`  ✓ Lucas Avril (${ttc.toFixed(2)} CHF) split parts égales : 3 × ${part} CHF`);
  }

  // ===== Stats finales =====
  console.log("\n=== Stats finales ===");
  const totalWithClient = await prisma.expense.count({
    where: { prospectId: { not: null } },
  });
  const totalAllocations = await prisma.expenseAllocation.count();
  const sumByProspect = await prisma.expense.groupBy({
    by: ["prospectId"],
    where: { prospectId: { not: null } },
    _sum: { montantTTC: true },
    _count: true,
  });
  console.log(
    `${totalWithClient} charges directes liées + ${totalAllocations} allocations multi-clients\n`,
  );
  for (const r of sumByProspect) {
    const p = await prisma.prospect.findUnique({ where: { id: r.prospectId! } });
    console.log(
      `  ${(p?.raisonSociale ?? "?").padEnd(30)} ${String(r._count).padStart(3)}× ${Number(r._sum.montantTTC ?? 0).toFixed(2).padStart(9)} CHF`,
    );
  }
  // Allocations
  const allocs = await prisma.expenseAllocation.groupBy({
    by: ["prospectId"],
    _sum: { montantHT: true },
    _count: true,
  });
  if (allocs.length) {
    console.log("\n  Allocations multi-clients :");
    for (const a of allocs) {
      const p = await prisma.prospect.findUnique({ where: { id: a.prospectId } });
      console.log(
        `    ${(p?.raisonSociale ?? "?").padEnd(30)} ${String(a._count).padStart(3)}× ${Number(a._sum.montantHT ?? 0).toFixed(2).padStart(9)} CHF`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
