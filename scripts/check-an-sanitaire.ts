import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.prospect.findFirst({
    where: { raisonSociale: { contains: "AN Sanitaire", mode: "insensitive" } },
  });
  if (!p) {
    console.log("⊘ Prospect AN Sanitaire non trouvé");
    return;
  }
  console.log(`Prospect : ${p.raisonSociale} (${p.id}) — statut ${p.statut}`);
  console.log(`Notes : ${p.notesGenerales ?? "(aucune)"}\n`);

  const contracts = await prisma.contract.findMany({
    where: { prospectId: p.id },
    include: {
      clientInvoices: {
        orderBy: { dateEmission: "asc" },
      },
    },
  });
  for (const c of contracts) {
    console.log(`Contrat ${c.numero} — statut ${c.statut}`);
    console.log(`  Montant mensuel : ${Number(c.montantMensuel ?? 0)} CHF`);
    console.log(`  Date début : ${c.dateDebut?.toISOString().slice(0, 10) ?? "—"}`);
    console.log(`  Date résiliation : ${c.dateResiliation?.toISOString().slice(0, 10) ?? "—"}`);
    console.log(`  Factures :`);
    for (const f of c.clientInvoices) {
      console.log(
        `    ${f.numero.padEnd(22)} ${f.dateEmission.toISOString().slice(0, 10)}  ${f.statut.padEnd(12)} ${Number(f.total).toFixed(2).padStart(8)} CHF`,
      );
    }
  }
}
main().finally(() => prisma.$disconnect());
