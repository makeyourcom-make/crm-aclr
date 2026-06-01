/**
 * Backfill : pour les charges importées du Cowork, on assume qu'elles sont
 * déjà payées (sinon elles n'auraient pas été enregistrées historiquement).
 *
 *   • Charges avec ticketUrl → PAYE + dateReglement = date du ticket
 *   • Charges sans ticket (frais bancaires UBS, charges futures) → EN_ATTENTE
 *   • Charges LITIGE_DOUBLON (LWS) → LITIGE
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. LITIGE — la charge LWS make-marketing.ch a "Litige doublon" dans description
  const litige = await prisma.expense.updateMany({
    where: { description: { contains: "Litige doublon", mode: "insensitive" } },
    data: { statutPaiement: "LITIGE" },
  });
  console.log(`✓ ${litige.count} charge(s) marquée(s) LITIGE`);

  // 2. PAYE : charges avec ticket ET pas en litige
  const withTicket = await prisma.expense.findMany({
    where: {
      ticketUrl: { not: null },
      statutPaiement: "EN_ATTENTE",
    },
    select: { id: true, date: true },
  });
  let paye = 0;
  for (const e of withTicket) {
    await prisma.expense.update({
      where: { id: e.id },
      data: {
        statutPaiement: "PAYE",
        dateReglement: e.date,
      },
    });
    paye++;
  }
  console.log(`✓ ${paye} charge(s) marquée(s) PAYE (avec ticket → dateReglement = date du ticket)`);

  // 3. Charges récurrentes connues sans ticket mais déjà payées (frais bancaires UBS)
  const ubs = await prisma.expense.findMany({
    where: {
      description: { contains: "Frais bancaires UBS", mode: "insensitive" },
      statutPaiement: "EN_ATTENTE",
    },
    select: { id: true, date: true },
  });
  for (const e of ubs) {
    await prisma.expense.update({
      where: { id: e.id },
      data: { statutPaiement: "PAYE", dateReglement: e.date },
    });
  }
  console.log(`✓ ${ubs.length} frais bancaires UBS marqués PAYE`);

  // 4. Stats
  const counts = await prisma.expense.groupBy({
    by: ["statutPaiement"],
    _count: true,
    _sum: { montantTTC: true },
  });
  console.log(`\n=== Répartition statut paiement ===`);
  for (const c of counts) {
    console.log(
      `  ${c.statutPaiement.padEnd(15)} ${String(c._count).padStart(3)}× ${Number(c._sum.montantTTC ?? 0).toFixed(2).padStart(10)} CHF`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
