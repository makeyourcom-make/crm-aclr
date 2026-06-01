/**
 * Vérifie le récap contrats donné par l'utilisateur au 01.06.2026.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== Vérification contrats ACTIF ===\n");

  // Récupère TOUS les contrats ACTIF
  const contracts = await prisma.contract.findMany({
    where: { statut: "ACTIF" },
    include: {
      prospect: { select: { raisonSociale: true, statut: true } },
      renewals: { orderBy: { dateRenouvellement: "desc" }, take: 1 },
      clientInvoices: {
        where: { total: { gt: 0 } },
        orderBy: { dateEmission: "desc" },
        take: 1,
      },
    },
    orderBy: { dateSignature: "asc" },
  });

  console.log(`▌ ${contracts.length} contrats ACTIF en base`);
  console.log("─".repeat(110));

  for (const c of contracts) {
    const next = computeNextRenewal(c.dateSignature, c.clientInvoices[0]?.dateEmission);
    const isAnnuel = Number(c.montantMensuel) === 0;
    const ttc = isAnnuel
      ? Number(c.clientInvoices[0]?.total ?? 0)
      : Number(c.montantMensuel) * 12;
    console.log(
      `  ${c.numero.padEnd(35)} ${c.prospect.raisonSociale.slice(0, 30).padEnd(32)} ${c.dateSignature.toISOString().slice(0, 10)} → ${next}  ${(isAnnuel ? "AN" : "MENS").padEnd(4)}  ${ttc.toFixed(2).padStart(10)} CHF/an`,
    );
  }

  console.log("\n▌ Comparaison avec récap user (14 contrats annuels mentionnés)");
  console.log("─".repeat(110));

  const userList = [
    { rs: "Passeport Beauté", debut: "2025-07-01", next: "2026-07-01", montant: 12000 },
    { rs: "L&L Coiffure Sàrl", debut: "2025-11-01", next: "2026-11-01", montant: 468 },
    { rs: "TournemainConsult", debut: "2025-05-01", next: "2027-02-01", montant: 468 },
    { rs: "Marie-Laure Sidère", debut: "2025-01-01", next: "2027-01-01", montant: 736.63 },
    { rs: "La Dent Byantse", debut: "2025-01-31", next: "2027-01-31", montant: 6000 },
    { rs: "Lina Coiffure", debut: "2025-01-31", next: "2027-01-31", montant: 168 },
    { rs: "Frakaxessoires", debut: "2026-03-01", next: "2027-02-28", montant: 1176 },
    { rs: "Roch SA", debut: "2025-03-04", next: "2027-03-04", montant: 249 },
    { rs: "Coiffure St Honoré", debut: "2026-04-01", next: "2027-04-01", montant: 1800 },
    { rs: "Casavue", debut: "2025-04-15", next: "2027-04-15", montant: 588 },
    { rs: "Lionel Briquet", debut: "2025-04-15", next: "2027-04-15", montant: 317 },
    { rs: "Qerkini Sàrl", debut: "2025-04-19", next: "2027-04-30", montant: 530.44 },
    { rs: "Soverial", debut: "2025-05-01", next: "2027-04-30", montant: 468 },
    { rs: "SRT FORMATION", debut: "2026-05-01", next: "2027-04-30", montant: 150 },
  ];

  for (const u of userList) {
    const found = contracts.find((c) =>
      c.prospect.raisonSociale.toLowerCase().includes(u.rs.toLowerCase()),
    );
    if (!found) {
      console.log(`  ❌ ${u.rs.padEnd(30)} : aucun contrat ACTIF trouvé`);
      continue;
    }
    const dbDebut = found.dateSignature.toISOString().slice(0, 10);
    const dbMontant = Number(found.montantMensuel) === 0
      ? Number(found.clientInvoices[0]?.total ?? 0)
      : Number(found.montantMensuel) * 12;
    const debutOk = dbDebut === u.debut;
    const montantOk = Math.abs(dbMontant - u.montant) < 1;
    const status = debutOk && montantOk ? "✅" : "⚠️";
    console.log(
      `  ${status} ${u.rs.padEnd(30)} début DB=${dbDebut} user=${u.debut}  montant DB=${dbMontant.toFixed(2)} user=${u.montant}`,
    );
  }

  // Vérifier les contrats ACTIF de la DB qui ne sont PAS dans la liste user
  console.log("\n▌ Contrats ACTIF en DB mais ABSENTS du récap user");
  console.log("─".repeat(110));
  for (const c of contracts) {
    const userMatch = userList.find((u) =>
      c.prospect.raisonSociale.toLowerCase().includes(u.rs.toLowerCase()),
    );
    if (!userMatch) {
      const isAnnuel = Number(c.montantMensuel) === 0;
      console.log(
        `  ⚠ ${c.numero.padEnd(30)} ${c.prospect.raisonSociale.padEnd(30)} ${c.dateSignature.toISOString().slice(0, 10)} ${isAnnuel ? "ANNUEL" : "MENSUEL"} ${Number(c.montantMensuel).toFixed(2)}/mois`,
      );
    }
  }
}

function computeNextRenewal(debut: Date, lastFactDate?: Date): string {
  // Si on a une dernière facture, on prend sa date + 1 an
  if (lastFactDate) {
    const d = new Date(lastFactDate);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }
  // Sinon date début + 1 an
  const d = new Date(debut);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

main().finally(() => prisma.$disconnect());
