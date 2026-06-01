/**
 * Correctif post-import : LocFactory
 *
 * Vrai client mensuel — 400 CHF/mois d'avril à décembre 2026 (9 mois).
 * Le placeholder devient un contrat propre.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const prospect = await prisma.prospect.findFirst({
    where: { raisonSociale: { contains: "LocFactory" } },
    include: { contracts: { include: { clientInvoices: true } } },
  });
  if (!prospect) {
    console.log("Prospect LocFactory introuvable.");
    return;
  }

  // Trouve le placeholder
  const placeholder = prospect.contracts.find((c) =>
    c.numero.startsWith("PLACEHOLDER-"),
  );
  if (!placeholder) {
    console.log("Aucun placeholder à transformer pour LocFactory.");
    return;
  }

  // Paramètres métier
  const dateDebut = new Date("2026-04-01T00:00:00Z");
  const dureeMois = 9; // avril → décembre 2026 inclus
  const montantMensuel = 400;
  const valeurAn1 = montantMensuel * dureeMois; // 3 600 CHF

  console.log(`Trouvé : ${prospect.raisonSociale}`);
  console.log(`  Placeholder à transformer : ${placeholder.numero}`);
  console.log(
    `  Factures rattachées : ${placeholder.clientInvoices.length} (total ${placeholder.clientInvoices.reduce((s, i) => s + Number(i.total), 0).toFixed(2)} CHF)`,
  );

  await prisma.contract.update({
    where: { id: placeholder.id },
    data: {
      numero: "CTR-LOCFACTORY-2026",
      dateSignature: dateDebut,
      dateDebut,
      dureeMois,
      modalitePaiement: "MENSUEL",
      montantOneShot: 0,
      montantMensuel,
      valeurAn1,
      statut: "ACTIF",
    },
  });

  console.log(
    `  ✓ Contrat ${placeholder.numero} → CTR-LOCFACTORY-2026 (MENSUEL, ${montantMensuel} CHF × ${dureeMois} mois = ${valeurAn1} CHF)`,
  );

  // Met une note utile sur le prospect (si pas déjà mise par l'import)
  await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      statut: "SIGNE",
      notesGenerales:
        "Contrat mensuel — 400 CHF/mois d'avril à décembre 2026 (9 mois, total 3 600 CHF).\nRéparti avec Lucas Carlin (cf. CONVENTIONS-METIER.md §6).",
    },
  });
  console.log(`  ✓ Note prospect mise à jour`);

  console.log("\n✓ Correctif appliqué.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
