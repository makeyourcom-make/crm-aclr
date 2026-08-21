import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Nouvelle modalité de paiement (additif) : ONESHOT_PUIS_MENSUEL
 *   = le one-shot est facturé en UNE fois à la signature, puis le récurrent
 *     est facturé chaque mois. Idempotent.
 */
async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "ModalitePaiement" ADD VALUE IF NOT EXISTS 'ONESHOT_PUIS_MENSUEL'`,
  );
  const rows = await prisma.$queryRawUnsafe<{ enumlabel: string }[]>(
    `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'ModalitePaiement' ORDER BY e.enumsortorder`,
  );
  console.log("ModalitePaiement :", rows.map((r) => r.enumlabel).join(", "));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
