import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "supprime" BOOLEAN NOT NULL DEFAULT false`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "emails" ADD COLUMN IF NOT EXISTS "supprimeeLe" TIMESTAMP(3)`,
  );
  const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'emails' AND column_name IN ('supprime','supprimeeLe') ORDER BY column_name`,
  );
  console.log("colonnes corbeille :", cols.map((c) => c.column_name).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
