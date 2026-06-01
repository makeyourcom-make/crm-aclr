import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const arcoz = await p.prospect.findFirst({
    where: { raisonSociale: { contains: "ARCOZ" } },
    include: {
      contracts: {
        include: {
          clientInvoices: { select: { numero: true, total: true, statut: true } },
        },
      },
    },
  });
  console.log(JSON.stringify(arcoz, null, 2));
}
main().finally(() => p.$disconnect());
