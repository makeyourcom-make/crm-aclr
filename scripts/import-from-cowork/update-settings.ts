/**
 * Met à jour les Settings d'ACLR avec les vraies infos métier (CONVENTIONS-METIER §1).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.setting.findFirst();
  const data = {
    raisonSociale: "ACLR Sàrl",
    marque: "MakeYourCom",
    adresse: "Route de la Jorette 66",
    codePostal: "1899",
    ville: "Torgon",
    pays: "Suisse",
    numeroIDE: "CHE-147.095.764",
    numeroTVA: null, // NON assujettie
    iban: "CH34 0024 7247 3054 7502 T",
    bicSwift: "UBSWCHZH80A",
    nomBanque: "UBS Switzerland AG",
    emailContact: "contact@makeyourcom.ch",
    siteWeb: "makeyourcom.ch",
    tvaActive: false,
    tauxTVA: 0,
  };

  if (existing) {
    await prisma.setting.update({ where: { id: existing.id }, data });
    console.log("✓ Settings mis à jour");
  } else {
    await prisma.setting.create({ data });
    console.log("✓ Settings créés");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
