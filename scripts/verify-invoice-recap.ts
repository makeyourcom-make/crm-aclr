/**
 * Vérifie le récap factures donné par l'utilisateur au 01.06.2026.
 * Compare avec l'état DB.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== Vérification factures DB vs récap user ===\n");

  // 1. PAYÉES
  console.log("▌ FACTURES PAYÉES (par mois de datePaiement)");
  const paid = await prisma.clientInvoice.findMany({
    where: { statut: "PAYEE", total: { gt: 0 } },
    select: {
      numero: true,
      total: true,
      datePaiement: true,
      contract: { include: { prospect: { select: { raisonSociale: true } } } },
    },
    orderBy: { datePaiement: "asc" },
  });
  const byMonth: Record<string, { count: number; sum: number }> = {};
  let totalPaid = 0;
  for (const f of paid) {
    const m = f.datePaiement
      ? `${f.datePaiement.getUTCFullYear()}-${String(f.datePaiement.getUTCMonth() + 1).padStart(2, "0")}`
      : "sans-date";
    byMonth[m] = byMonth[m] ?? { count: 0, sum: 0 };
    byMonth[m].count++;
    byMonth[m].sum += Number(f.total);
    totalPaid += Number(f.total);
  }
  for (const m of Object.keys(byMonth).sort()) {
    const s = byMonth[m];
    console.log(`  ${m}  ${String(s.count).padStart(3)}× ${s.sum.toFixed(2).padStart(10)} CHF`);
  }
  console.log(`  TOTAL    ${String(paid.length).padStart(3)}× ${totalPaid.toFixed(2).padStart(10)} CHF\n`);

  // 2. Detail des paiements Mai
  console.log("▌ DÉTAIL FACTURES PAYÉES EN MAI 2026");
  const may = paid.filter(
    (f) =>
      f.datePaiement &&
      f.datePaiement.getUTCFullYear() === 2026 &&
      f.datePaiement.getUTCMonth() === 4,
  );
  for (const f of may) {
    console.log(
      `  ${f.numero.padEnd(22)} ${f.contract.prospect.raisonSociale.slice(0, 25).padEnd(27)} ${Number(f.total).toFixed(2).padStart(9)} CHF  ${f.datePaiement?.toISOString().slice(0, 10)}`,
    );
  }

  // 3. EN ATTENTE (ENVOYEE non échue)
  console.log("\n▌ FACTURES ENVOYEE (en attente)");
  const today = new Date("2026-06-01T00:00:00Z");
  const envoyee = await prisma.clientInvoice.findMany({
    where: { statut: "ENVOYEE", total: { gt: 0 } },
    select: {
      numero: true,
      total: true,
      dateEmission: true,
      dateEcheance: true,
      contract: { include: { prospect: { select: { raisonSociale: true } } } },
    },
    orderBy: { dateEcheance: "asc" },
  });
  let sumEnvoyee = 0;
  for (const f of envoyee) {
    const overdue = f.dateEcheance < today;
    const days = Math.floor(
      (today.getTime() - f.dateEcheance.getTime()) / 86400000,
    );
    const marker = overdue ? `🔴 retard ${days}j` : `attente`;
    console.log(
      `  ${f.numero.padEnd(22)} ${f.contract.prospect.raisonSociale.slice(0, 25).padEnd(27)} ${Number(f.total).toFixed(2).padStart(9)} CHF échéance ${f.dateEcheance.toISOString().slice(0, 10)} (${marker})`,
    );
    sumEnvoyee += Number(f.total);
  }
  console.log(`  TOTAL envoyée : ${envoyee.length}× ${sumEnvoyee.toFixed(2)} CHF\n`);

  // 4. EN RETARD (statut EN_RETARD ou ENVOYEE dont échéance dépassée)
  console.log("▌ FACTURES EN_RETARD (statut explicite)");
  const enRetard = await prisma.clientInvoice.findMany({
    where: { statut: "EN_RETARD", total: { gt: 0 } },
    select: {
      numero: true,
      total: true,
      dateEmission: true,
      dateEcheance: true,
      contract: { include: { prospect: { select: { raisonSociale: true } } } },
    },
    orderBy: { dateEcheance: "asc" },
  });
  let sumRetard = 0;
  for (const f of enRetard) {
    const days = Math.floor(
      (today.getTime() - f.dateEcheance.getTime()) / 86400000,
    );
    console.log(
      `  ${f.numero.padEnd(22)} ${f.contract.prospect.raisonSociale.slice(0, 25).padEnd(27)} ${Number(f.total).toFixed(2).padStart(9)} CHF échéance ${f.dateEcheance.toISOString().slice(0, 10)} (+${days}j)`,
    );
    sumRetard += Number(f.total);
  }
  console.log(`  TOTAL en retard : ${enRetard.length}× ${sumRetard.toFixed(2)} CHF\n`);

  // 5. BROUILLON
  console.log("▌ FACTURES BROUILLON (pas encore envoyées)");
  const brouillon = await prisma.clientInvoice.findMany({
    where: { statut: "BROUILLON", total: { gt: 0 } },
    select: {
      numero: true,
      total: true,
      dateEmission: true,
      contract: { include: { prospect: { select: { raisonSociale: true } } } },
    },
    orderBy: { dateEmission: "asc" },
  });
  for (const f of brouillon.slice(0, 5)) {
    console.log(
      `  ${f.numero.padEnd(22)} ${f.contract.prospect.raisonSociale.slice(0, 25).padEnd(27)} ${Number(f.total).toFixed(2).padStart(9)} CHF émission ${f.dateEmission.toISOString().slice(0, 10)}`,
    );
  }
  console.log(`  TOTAL brouillon : ${brouillon.length} factures\n`);

  // 6. SRT Formation + Soverial : vérifier datePaiement
  console.log("▌ FOCUS : SRT Formation 26-90 + Soverial 26-85");
  for (const num of ["26-90", "26-85"]) {
    const f = await prisma.clientInvoice.findUnique({
      where: { numero: num },
      include: { contract: { include: { prospect: true } } },
    });
    if (f) {
      console.log(
        `  ${f.numero}  ${f.contract.prospect.raisonSociale}  ${f.statut}  total=${Number(f.total).toFixed(2)}  payée=${f.datePaiement?.toISOString().slice(0, 10) ?? "—"}`,
      );
    }
  }

  // 7. AN Sanitaire 26-52
  console.log("\n▌ FOCUS : AN Sanitaire 26-52 (rappel : décalée 01.03 → 01.07)");
  const an = await prisma.clientInvoice.findUnique({ where: { numero: "26-52" } });
  if (an) {
    console.log(
      `  26-52  statut=${an.statut}  émission=${an.dateEmission.toISOString().slice(0, 10)}  échéance=${an.dateEcheance.toISOString().slice(0, 10)}`,
    );
  }
}

main().finally(() => prisma.$disconnect());
