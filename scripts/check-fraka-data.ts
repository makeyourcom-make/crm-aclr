import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.prospect.findFirst({
    where: { raisonSociale: { contains: "Frakaxessoires", mode: "insensitive" } },
  });
  console.log(p);
}
main().finally(() => prisma.$disconnect());
