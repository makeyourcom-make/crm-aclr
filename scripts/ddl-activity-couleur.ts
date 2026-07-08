import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Additif, idempotent — pas de prisma db push sur la prod partagée.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "couleur" TEXT`,
  );
  const check = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'couleur'`,
  );
  console.log("activities.couleur présent :", check.length === 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
