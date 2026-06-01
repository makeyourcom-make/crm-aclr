import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const lina = await prisma.prospect.findFirst({
    where: { raisonSociale: { contains: "Lina", mode: "insensitive" } },
  });
  if (!lina) { console.log("Lina non trouvé"); return; }
  console.log(`Prospect: ${lina.raisonSociale}`);
  console.log(`Notes: ${lina.notesGenerales ?? "(aucune)"}\n`);
  const contracts = await prisma.contract.findMany({
    where: { prospectId: lina.id },
    include: { clientInvoices: { orderBy: { dateEmission: "asc" } }, products: true },
  });
  for (const c of contracts) {
    console.log(`Contrat ${c.numero} — ${c.statut} — modalite=${c.modalitePaiement}`);
    console.log(`  montantMensuel: ${Number(c.montantMensuel)} / OneShot: ${Number(c.montantOneShot)} / valeurAn1: ${Number(c.valeurAn1)}`);
    console.log(`  Produits: ${c.products.map((p) => p.nom).join(", ")}`);
    console.log(`  Factures:`);
    for (const f of c.clientInvoices) {
      console.log(`    ${f.numero.padEnd(22)} ${f.dateEmission.toISOString().slice(0,10)} ${f.statut.padEnd(10)} ${Number(f.total).toFixed(2).padStart(8)} CHF`);
    }
  }
}
main().finally(() => prisma.$disconnect());
