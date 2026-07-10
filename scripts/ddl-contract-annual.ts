import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main(){
  await prisma.$executeRawUnsafe(`ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "renouvellementAnnuelLe" TIMESTAMP(3)`);
  const ok = await prisma.$queryRawUnsafe<{column_name:string}[]>(`SELECT column_name FROM information_schema.columns WHERE table_name='contracts' AND column_name='renouvellementAnnuelLe'`);
  console.log("colonne renouvellementAnnuelLe:", ok.length===1?"OK":"ABSENTE");
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
