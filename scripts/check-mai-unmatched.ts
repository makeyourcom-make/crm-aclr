/**
 * Vérifie les encaissements non matchés (factures en attente non trouvées
 * ou trouvées avec montant non exact) pour comprendre où sont les écarts.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const targets = [
    "Passeport Beauté",
    "L&L Coiffure Sàrl",
    "Frakaxessoires",
    "Soverial",
    "SRT FORMATION",
  ];

  for (const rs of targets) {
    const p = await prisma.prospect.findFirst({
      where: { raisonSociale: { equals: rs, mode: "insensitive" } },
    });
    if (!p) {
      console.log(`⊘ ${rs} : prospect introuvable`);
      continue;
    }
    const factures = await prisma.clientInvoice.findMany({
      where: { contract: { prospectId: p.id } },
      orderBy: { dateEmission: "desc" },
      select: {
        numero: true,
        dateEmission: true,
        datePaiement: true,
        statut: true,
        total: true,
        notesClient: true,
      },
      take: 10,
    });
    console.log(`\n=== ${rs} ===`);
    for (const f of factures) {
      const date = f.dateEmission.toISOString().slice(0, 10);
      const paye = f.datePaiement
        ? f.datePaiement.toISOString().slice(0, 10)
        : "—";
      console.log(
        `  ${f.numero.padEnd(22)} ${date}  ${f.statut.padEnd(10)}  ${Number(f.total).toFixed(2).padStart(9)} CHF  paye=${paye}`,
      );
    }
  }
}

main().finally(() => prisma.$disconnect());
