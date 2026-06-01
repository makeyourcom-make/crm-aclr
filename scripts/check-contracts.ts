import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  // Contrat de Frakaxessoires
  const c = await prisma.contract.findFirst({
    where: { numero: "CTR-2618" },
    include: {
      products: true,
      clientInvoices: {
        select: { numero: true, total: true, lignes: { select: { designation: true } } },
        orderBy: { numero: "asc" },
        take: 3,
      },
    },
  });
  console.log("CTR-2618:", JSON.stringify(Object.keys(c ?? {})));
  console.log("Full:", JSON.stringify(c, null, 2).slice(0, 1500));

  // Combien de factures n'ont pas de lignes ?
  const empty = await prisma.clientInvoice.count({ where: { lignes: { none: {} } } });
  const total = await prisma.clientInvoice.count();
  console.log(`\n${empty} factures sur ${total} sans aucune ligne.`);
}
main().finally(() => prisma.$disconnect());
