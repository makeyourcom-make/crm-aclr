/**
 * Renomme les emails de connexion des utilisateurs ACLR :
 *   - arthur@aclr.ch  → arthur@makeyourcom.ch
 *   - sophie@aclr.ch  → sophie@makeyourcom.ch
 *
 * Idempotent : ignore si l'ancien email n'existe plus.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { role: "asc" },
  });
  console.log("=== AVANT ===");
  for (const u of before) {
    console.log(`  ${u.role.padEnd(11)} ${(u.name ?? "—").padEnd(22)} ${u.email}`);
  }

  const updates = [
    { from: "arthur@aclr.ch", to: "arthur@makeyourcom.ch" },
    { from: "sophie@aclr.ch", to: "sophie@makeyourcom.ch" },
  ];

  console.log("\n=== MISE À JOUR ===");
  for (const u of updates) {
    const existing = await prisma.user.findUnique({ where: { email: u.from } });
    if (!existing) {
      console.log(`  ⊘ ${u.from} : non trouvé (peut-être déjà renommé)`);
      continue;
    }
    await prisma.user.update({
      where: { email: u.from },
      data: { email: u.to },
    });
    console.log(`  ✓ ${u.from} → ${u.to}`);
  }

  const after = await prisma.user.findMany({
    select: { name: true, email: true, role: true },
    orderBy: { role: "asc" },
  });
  console.log("\n=== APRÈS ===");
  for (const u of after) {
    console.log(`  ${u.role.padEnd(11)} ${(u.name ?? "—").padEnd(22)} ${u.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
