import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const users = await p.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      role: true,
      _count: { select: { prospectsAssignes: true, contratsAssignes: true } },
    },
  });
  console.log("Répartition actuelle :\n");
  for (const u of users) {
    console.log(
      `  ${u.name.padEnd(20)} (${u.role}) — ${u._count.prospectsAssignes} entreprises · ${u._count.contratsAssignes} contrats`,
    );
  }
}
main().finally(() => p.$disconnect());
