import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.expense.findFirst({
    where: {
      description: { contains: "Frais bancaires UBS - Compte CHF 7502 (Mai 2026)" },
    },
  });
  if (existing) {
    console.log("Existe déjà :", existing.id);
    return;
  }
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const e = await prisma.expense.create({
    data: {
      date: new Date("2026-05-29"),
      dateReglement: new Date("2026-05-29"),
      statutPaiement: "PAYE",
      categorie: "BANQUE_FRAIS",
      fournisseur: "UBS",
      description: "Frais bancaires UBS - Compte CHF 7502 (Mai 2026)",
      montantHT: 35.47,
      tauxTVA: 0,
      montantTVA: 0,
      montantTTC: 35.47,
      tvaRecuperable: false,
      methodPaiement: "PRELEVEMENT",
      ocrUtilise: false,
      createdById: admin?.id ?? null,
    },
  });
  console.log(`✓ Créé : ${e.id} — 35.47 CHF PAYE`);
}
main().finally(() => prisma.$disconnect());
