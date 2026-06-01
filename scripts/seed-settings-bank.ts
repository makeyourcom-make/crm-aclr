/**
 * Met à jour la table Setting avec les coordonnées bancaires ACLR.
 *
 *   - IBAN CHF : CH34 0024 7247 3054 7502 T  /  BIC UBSWCHZH80A
 *   - IBAN EUR : CH24 0024 7247 3054 7560 Z  /  BIC UBSWCHZH80A
 *   - Logo     : /brand/logo.png (à uploader dans public/brand/)
 *   - Adresse  : Route de la Jorette 66, 1899 Torgon, Suisse
 *   - Banque   : UBS Switzerland AG
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const data = {
    raisonSociale: "ACLR Sàrl",
    marque: "Make Your Com",
    adresse: "Route de la Jorette 66",
    codePostal: "1899",
    ville: "Torgon",
    pays: "Suisse",
    iban: "CH34 0024 7247 3054 7502 T",
    bicSwift: "UBSWCHZH80A",
    nomBanque: "UBS Switzerland AG",
    ibanEUR: "CH24 0024 7247 3054 7560 Z",
    bicSwiftEUR: "UBSWCHZH80A",
    logoUrl: "/brand/logo.png",
  };
  const existing = await prisma.setting.findFirst();
  if (existing) {
    await prisma.setting.update({ where: { id: existing.id }, data });
    console.log("✓ Setting mis à jour :");
  } else {
    await prisma.setting.create({ data: { id: 1, ...data } });
    console.log("✓ Setting créé :");
  }
  for (const [k, v] of Object.entries(data)) {
    console.log(`  ${k.padEnd(20)} = ${v}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
