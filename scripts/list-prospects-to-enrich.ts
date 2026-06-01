/**
 * Liste tous les prospects ayant au moins un contrat (donc clients réels)
 * et n'ayant pas d'adresse OU pas d'IDE en DB — candidats à enrichir.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const prospects = await prisma.prospect.findMany({
    where: {
      contracts: { some: {} }, // au moins un contrat
    },
    select: {
      id: true,
      raisonSociale: true,
      contactPrenom: true,
      contactNom: true,
      email: true,
      telephone: true,
      adresse: true,
      codePostal: true,
      ville: true,
      canton: true,
      pays: true,
      numeroIDE: true,
      numeroTVA: true,
      siteWeb: true,
    },
    orderBy: { raisonSociale: "asc" },
  });

  console.log(`${prospects.length} clients (avec contrat signé) :\n`);
  for (const p of prospects) {
    const missing: string[] = [];
    if (!p.adresse) missing.push("adresse");
    if (!p.codePostal) missing.push("CP");
    if (!p.ville) missing.push("ville");
    if (!p.numeroIDE) missing.push("IDE");
    if (!p.contactNom && !p.contactPrenom) missing.push("contact");

    console.log(
      `${p.raisonSociale.padEnd(28)} | site: ${(p.siteWeb ?? "—").padEnd(40)} | manque: ${missing.join(", ")}`,
    );
  }
}
main().finally(() => prisma.$disconnect());
