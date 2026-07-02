/**
 * Endpoint /api/cron/nightly — tâches nocturnes (étape 27).
 *
 * Doit être appelé une fois par jour à 02:00 (Europe/Zurich) par un
 * scheduler externe :
 *   - En prod Hetzner via docker-compose : un service `cron` qui curl
 *     POST http://web:3000/api/cron/nightly avec le header secret
 *   - En cloud : Vercel Cron, Inngest, Trigger.dev, Upstash QStash, etc.
 *
 * Effets en cascade :
 *   1. Anniversaires de contrats → génère Renewal + 12 ClientInvoices +
 *      12 CommissionPayment RENOUVELLEMENT
 *   2. Étalements échus → passe à PAYE (acquis)
 *   3. Snapshot Stat quotidien par commerciale active
 *   4. Génération des factures Sophie du mois précédent (si on est entre
 *      le 1er et le 5 du mois)
 *
 * Sécurisé par un header secret (CRON_SECRET en variable d'env).
 */
import { NextResponse } from "next/server";

import { generateDueClientInvoices } from "@/app/(app)/contrats/actions";
import {
  processAnnualContractAnniversaries,
  processContractAnniversaries,
  processOverdueEtalements,
} from "@/lib/commissions-engine";
import { generateMonthlyInvoicesForAll } from "@/lib/invoices-engine";
import { prisma } from "@/lib/db";

async function handler(req: Request) {
  // Auth : accepte 2 mécanismes
  //   1. Vercel Cron (production)        : Authorization: Bearer ${CRON_SECRET}
  //   2. Cron self-hosted (Docker, etc.) : x-cron-secret: ${CRON_SECRET}
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new NextResponse("Forbidden (CRON_SECRET not configured)", {
      status: 403,
    });
  }
  const auth = req.headers.get("authorization");
  const xCronSecret = req.headers.get("x-cron-secret");
  const okBearer = auth === `Bearer ${expected}`;
  const okHeader = xCronSecret === expected;
  if (!okBearer && !okHeader) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const results: Record<string, unknown> = {};
  const startedAt = Date.now();

  try {
    // 1. Anniversaires (contrats mensuels)
    const renewals = await processContractAnniversaries();
    results.renewals = renewals.length;
    if (renewals.length > 0) {
      results.renewalsDetail = renewals.map((r) => r.numero);
    }

    // 1bis. Anniversaires (contrats annuels — 1 facture/an, montantMensuel=0)
    const annualRenewals = await processAnnualContractAnniversaries();
    results.annualInvoices = annualRenewals.length;
    if (annualRenewals.length > 0) {
      results.annualInvoicesDetail = annualRenewals.map((r) => ({
        contract: r.contractNumero,
        client: r.prospectName,
        invoice: r.newInvoiceNumero,
        amount: r.amount,
      }));
    }

    // 1ter. Factures clients du mois échu (mois-par-mois, BROUILLON).
    const dueInvoices = await generateDueClientInvoices();
    results.clientInvoicesGenerated = dueInvoices.created;
    if (!dueInvoices.ok) results.clientInvoicesError = dueInvoices.error;

    // 2. Étalements échus
    const etalements = await processOverdueEtalements();
    results.etalementsProcessed = etalements.total;

    // 3. Snapshot Stat quotidien
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    let snapshotsCreated = 0;
    for (const u of activeUsers) {
      const existing = await prisma.stat.findUnique({
        where: { userId_date: { userId: u.id, date: today } },
      });
      if (existing) continue;

      const [
        nbAppelsSortants,
        nbAppelsEntrants,
        nbEmailsEnvoyes,
        nbEmailsRecus,
        nbRdvPlanifies,
        nbRdvHonores,
        nbRdvManques,
        contracts,
        prospectsNouveaux,
        renouvCommissions,
      ] = await Promise.all([
        prisma.activity.count({
          where: {
            userId: u.id,
            type: "APPEL_SORTANT",
            date: { gte: today, lt: tomorrow },
            statut: { in: ["FAIT", "EN_COURS"] },
          },
        }),
        prisma.activity.count({
          where: {
            userId: u.id,
            type: "APPEL_ENTRANT",
            date: { gte: today, lt: tomorrow },
          },
        }),
        prisma.activity.count({
          where: {
            userId: u.id,
            type: "EMAIL_ENVOYE",
            date: { gte: today, lt: tomorrow },
          },
        }),
        prisma.activity.count({
          where: {
            userId: u.id,
            type: "EMAIL_RECU",
            date: { gte: today, lt: tomorrow },
          },
        }),
        prisma.activity.count({
          where: {
            userId: u.id,
            type: { in: ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"] },
            date: { gte: today, lt: tomorrow },
          },
        }),
        prisma.activity.count({
          where: {
            userId: u.id,
            type: { in: ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"] },
            date: { gte: today, lt: tomorrow },
            statut: "FAIT",
          },
        }),
        prisma.activity.count({
          where: {
            userId: u.id,
            type: { in: ["RDV_PHYSIQUE", "RDV_VISIO", "RDV_TELEPHONIQUE"] },
            date: { gte: today, lt: tomorrow },
            statut: "MANQUE",
          },
        }),
        prisma.contract.aggregate({
          where: {
            assigneAId: u.id,
            dateSignature: { gte: today, lt: tomorrow },
          },
          _count: true,
          _sum: { valeurAn1: true },
        }),
        prisma.prospect.count({
          where: { assigneAId: u.id, createdAt: { gte: today, lt: tomorrow } },
        }),
        prisma.commissionPayment.aggregate({
          where: {
            commission: { userId: u.id },
            typePart: "RENOUVELLEMENT",
            statut: "PAYE",
            dateVersement: { gte: today, lt: tomorrow },
          },
          _sum: { montant: true },
        }),
      ]);

      await prisma.stat.create({
        data: {
          userId: u.id,
          date: today,
          nbAppelsSortants,
          nbAppelsEntrants,
          nbAppelsTotal: nbAppelsSortants + nbAppelsEntrants,
          nbEmailsEnvoyes,
          nbEmailsRecus,
          nbRdvPlanifies,
          nbRdvHonores,
          nbRdvManques,
          nbPropositionsEnvoyees: 0,
          nbContratsSignes: contracts._count,
          montantContratsSignes: contracts._sum.valeurAn1 ?? 0,
          nbProspectsNouveaux: prospectsNouveaux,
          nbProspectsContactes: 0,
          montantRenouvellementsEncaisses:
            renouvCommissions._sum.montant ?? 0,
          tauxConversionAppelRdv:
            nbAppelsSortants > 0 ? nbRdvPlanifies / nbAppelsSortants : 0,
          tauxConversionRdvSignature:
            nbRdvHonores > 0 ? contracts._count / nbRdvHonores : 0,
        },
      });
      snapshotsCreated++;
    }
    results.snapshotsCreated = snapshotsCreated;

    // 4. Génération des factures mensuelles si on est entre le 1er et le 5
    const dayOfMonth = today.getDate();
    if (dayOfMonth >= 1 && dayOfMonth <= 5) {
      const prevMonth = today.getMonth() === 0 ? 12 : today.getMonth();
      const prevYear =
        today.getMonth() === 0
          ? today.getFullYear() - 1
          : today.getFullYear();
      const batch = await generateMonthlyInvoicesForAll(prevYear, prevMonth);
      results.invoicesGenerated = batch.generated.length;
      results.invoicesSkipped = batch.skipped.length;
    }

    results.durationMs = Date.now() - startedAt;
    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    console.error("[cron nightly]", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Erreur inconnue",
        ...results,
      },
      { status: 500 },
    );
  }
}

// Vercel Cron invoque GET avec header Authorization. On supporte aussi POST
// pour Docker/curl manuel avec x-cron-secret.
export async function GET(req: Request) {
  return handler(req);
}
export async function POST(req: Request) {
  return handler(req);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
