/**
 * Crée la facture SOS Pneus pour la 2e quinzaine de mai 2026 :
 *   - Ligne 1 : Gestion et Budget Google ADS – 16 au 31 mai 2026 — 867.41
 *   - Ligne 2 : Gestion site internet – Mai 2026 — 59.00
 *   - Total : 926.41 CHF
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 1) Récupère le contrat SOS Pneus
  const prospect = await prisma.prospect.findFirst({
    where: { raisonSociale: { contains: "SOS Pneus", mode: "insensitive" } },
    include: { contracts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!prospect) throw new Error("Prospect SOS Pneus introuvable");
  const contract = prospect.contracts[0];
  if (!contract) throw new Error("Contrat SOS Pneus introuvable");
  console.log(`Prospect: ${prospect.raisonSociale}`);
  console.log(`Contrat : ${contract.numero}`);

  // 2) Détermine le prochain numéro (pattern XX-NN, séquentiel)
  const lastInvoice = await prisma.clientInvoice.findFirst({
    where: { numero: { startsWith: "26-" } },
    orderBy: { numero: "desc" },
  });
  const lastNum = lastInvoice
    ? parseInt(lastInvoice.numero.split("-")[1] ?? "0", 10)
    : 0;
  const nextNumero = `26-${String(lastNum + 1).padStart(2, "0")}`;
  console.log(`Numéro : ${nextNumero} (après ${lastInvoice?.numero ?? "—"})`);

  // 3) Dates
  const dateEmission = new Date("2026-06-01");
  const dateEcheance = new Date("2026-07-01"); // +30 jours

  // 4) Crée la facture + lignes en transaction
  const invoice = await prisma.$transaction(async (tx) => {
    const f = await tx.clientInvoice.create({
      data: {
        contractId: contract.id,
        numero: nextNumero,
        dateEmission,
        dateEcheance,
        type: "PONCTUELLE",
        periodeMoisDebut: new Date("2026-05-16"),
        periodeMoisFin: new Date("2026-05-31"),
        sousTotal: 926.41,
        totalTVA: 0,
        total: 926.41,
        statut: "BROUILLON",
        notesClient: "Google ADS 16-31 mai 2026 (867.41) + Gestion site internet (59.00). Coût Google brut = 667.24 EUR ; refacturation +30%.",
      },
    });
    await tx.clientInvoiceLine.createMany({
      data: [
        {
          clientInvoiceId: f.id,
          designation: "Gestion et Budget Google ADS – 16 au 31 mai 2026",
          quantite: 1,
          prixUnitaire: 867.41,
          montantHT: 867.41,
          tauxTVA: 0,
          ordre: 0,
        },
        {
          clientInvoiceId: f.id,
          designation: "Gestion site internet – Mai 2026",
          quantite: 1,
          prixUnitaire: 59.0,
          montantHT: 59.0,
          tauxTVA: 0,
          ordre: 1,
        },
      ],
    });
    return f;
  });

  console.log(`\n✓ Facture ${invoice.numero} créée :`);
  console.log(`  Total      : CHF ${invoice.total}`);
  console.log(`  Statut     : ${invoice.statut}`);
  console.log(`  Période    : 16-31 mai 2026`);
  console.log(`  Échéance   : 1er juillet 2026`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
