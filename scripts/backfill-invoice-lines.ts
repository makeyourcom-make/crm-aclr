/**
 * Backfill : génère 1 ligne par facture à partir des informations existantes.
 *
 * Stratégie :
 *   1) Si notesClient présent, extraire la 1ère partie (avant " — ")
 *   2) Sinon, désignation par défaut "Prestation [Mois Année]" pour mensualité
 *   3) prixUnitaire = total facture, quantite = 1
 *
 * SAFE : on ne touche QUE les factures sans aucune ligne (idempotent).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function extractDesignation(notes: string | null): string | null {
  if (!notes) return null;
  // Split sur " — " (em dash) ou " - Payée" ou " - PDF prêt"
  // pour ne garder que la partie descriptive avant les métadonnées internes.
  const splits = [
    " — ",
    " - Payée",
    " - PDF",
    " - À envoyer",
    " - Renouvellement",
    " - Brouillon",
    " - Virement",
  ];
  let result = notes;
  for (const sep of splits) {
    const idx = result.indexOf(sep);
    if (idx > 0) result = result.slice(0, idx);
  }
  return result.trim() || null;
}

async function main() {
  const invoices = await prisma.clientInvoice.findMany({
    where: { lignes: { none: {} } },
    include: { lignes: true, contract: { select: { modalitePaiement: true, montantMensuel: true } } },
    orderBy: { numero: "asc" },
  });

  console.log(`${invoices.length} factures sans lignes — backfill...\n`);
  let created = 0;
  for (const inv of invoices) {
    const total = Number(inv.total);
    let designation = extractDesignation(inv.notesClient);

    if (!designation) {
      // Fallback selon le type
      if (inv.type === "MENSUALITE" && inv.periodeMoisDebut) {
        const d = new Date(inv.periodeMoisDebut);
        const mois = d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
        designation = `Accompagnement mensuel - ${mois}`;
      } else {
        designation = "Prestation de services";
      }
    }

    await prisma.clientInvoiceLine.create({
      data: {
        clientInvoiceId: inv.id,
        designation,
        quantite: 1,
        prixUnitaire: total,
        montantHT: total,
        tauxTVA: 0,
        ordre: 0,
      },
    });
    console.log(`  ${inv.numero.padEnd(8)} → "${designation}" — ${total.toFixed(2)}`);
    created++;
  }
  console.log(`\n✓ ${created} lignes créées.`);
}
main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
