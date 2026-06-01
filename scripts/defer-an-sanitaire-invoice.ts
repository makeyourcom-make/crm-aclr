/**
 * Décale la facture AN Sanitaire 26-52 :
 *   - dateEmission : 01.03.2026 → 01.07.2026
 *   - dateEcheance : recalculée à +30 jours = 31.07.2026
 *   - statut : ENVOYEE → BROUILLON (à envoyer le 01.07.2026)
 *
 * Renouvellement futur ajusté : 01.07.2027.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const facture = await prisma.clientInvoice.findUnique({
    where: { numero: "26-52" },
  });
  if (!facture) {
    console.log("⊘ Facture 26-52 non trouvée");
    return;
  }

  const newDateEmission = new Date("2026-07-01T00:00:00Z");
  const newDateEcheance = new Date("2026-07-31T00:00:00Z");

  await prisma.clientInvoice.update({
    where: { id: facture.id },
    data: {
      dateEmission: newDateEmission,
      dateEcheance: newDateEcheance,
      statut: "BROUILLON",
      notesClient:
        (facture.notesClient ?? "").trim() +
        "\n— Facture initialement saisie au 01.03.2026, décalée au 01.07.2026 sur demande.",
    },
  });
  console.log(`✓ Facture 26-52 décalée :`);
  console.log(`  dateEmission : 01.03.2026 → 01.07.2026`);
  console.log(`  dateEcheance : 31.07.2026`);
  console.log(`  statut : ENVOYEE → BROUILLON`);

  // Met à jour la note du prospect : prochain renouvellement à ajuster
  const prospect = await prisma.prospect.findFirst({
    where: { raisonSociale: { contains: "AN Sanitaire", mode: "insensitive" } },
  });
  if (prospect) {
    const newNote =
      (prospect.notesGenerales ?? "")
        .replace(/01\.03\.2027/g, "01.07.2027")
        .replace(/facture 26-52\./, "facture 26-52 (à envoyer 01.07.2026).");
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { notesGenerales: newNote },
    });
    console.log(`✓ Notes prospect mises à jour : renouvellement → 01.07.2027`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
