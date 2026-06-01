/**
 * Résout le LITIGE_DOUBLON LWS : la charge make-marketing.ch (Mai 2026)
 * avait été marquée en LITIGE car suspectée de doublon avec FC-2697695.
 * LWS a effectivement remboursé 11.77 CHF le 25.05.2026 sur le compte CHF
 * 7502 T. On marque donc la charge REMBOURSE + on documente.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Cherche la charge en LITIGE
  const charge = await prisma.expense.findFirst({
    where: {
      statutPaiement: "LITIGE",
      description: { contains: "make-marketing.ch", mode: "insensitive" },
    },
  });
  if (!charge) {
    console.log("⊘ Charge en LITIGE (make-marketing.ch) non trouvée.");
    return;
  }

  console.log(`Charge trouvée : ${charge.id}`);
  console.log(`  Description : ${charge.description}`);
  console.log(`  Montant TTC : ${Number(charge.montantTTC).toFixed(2)} CHF`);
  console.log(`  Statut : ${charge.statutPaiement}`);

  await prisma.expense.update({
    where: { id: charge.id },
    data: {
      statutPaiement: "REMBOURSE",
      dateReglement: new Date("2026-05-25"),
      description:
        (charge.description ?? "") +
        " — ✓ RÉSOLU : LWS a remboursé 11.77 CHF le 25.05.2026 (réf. crédit carte sur compte CHF 7502).",
    },
  });
  console.log(`✓ Charge marquée REMBOURSE avec date 25.05.2026`);
  console.log(`  Note ajoutée : refund LWS 11.77 CHF le 25.05`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
