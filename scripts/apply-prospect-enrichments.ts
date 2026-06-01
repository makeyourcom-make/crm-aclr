/**
 * Applique les enrichissements web sur les prospects de la DB.
 *
 * Règles :
 * - Frakaxessoires : raison sociale complète "FrakaXessoires, Pascal Fracheboud"
 * - Autres HIGH confidence : conservation du nom commercial actuel, on remplit
 *   uniquement adresse / IDE / TVA / contact / telephone / siteWeb / canton.
 * - MEDIUM confidence : pareil (adresse/contact OK, IDE peut être null)
 * - LOW / non trouvés : skip
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

interface Enrichment {
  /** Filtre pour matcher le prospect (insensitive contains) */
  match: string;
  /** Si défini, remplace raisonSociale */
  raisonSociale?: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  canton?: string;
  pays?: string;
  numeroIDE?: string;
  numeroTVA?: string;
  contactNom?: string;
  contactPrenom?: string;
  telephone?: string;
  siteWeb?: string;
}

const ENRICHMENTS: Enrichment[] = [
  // ── Frakaxessoires : raison sociale officielle complète
  {
    match: "Frakaxessoires",
    raisonSociale: "FrakaXessoires, Pascal Fracheboud",
    adresse: "Rue du Pré Court 1",
    codePostal: "1893",
    ville: "Muraz (Collombey)",
    canton: "VS",
    pays: "Suisse",
    numeroIDE: "CHE-113.807.194",
    contactNom: "Fracheboud",
    contactPrenom: "Pascal",
    telephone: "+41 24 471 98 50",
    siteWeb: "https://frakaxessoires.ch",
  },
  // ── HIGH confidence : on conserve le nom commercial existant
  {
    match: "ARCOZ AG",
    adresse: "Bischmattstrasse 7",
    codePostal: "2544",
    ville: "Bettlach",
    canton: "SO",
    pays: "Suisse",
    numeroIDE: "CHE-107.590.359",
    contactNom: "Cozza",
    contactPrenom: "Marco",
    telephone: "+41 32 628 29 29",
    siteWeb: "https://arcoz.ch",
  },
  {
    match: "Good4Bees",
    adresse: "Rue de la Gabelle 7",
    codePostal: "2503",
    ville: "Biel/Bienne",
    canton: "BE",
    pays: "Suisse",
    numeroIDE: "CHE-184.676.741",
    numeroTVA: "CHE-184.676.741 TVA",
    contactNom: "Gallina",
    contactPrenom: "Julien",
    telephone: "+41 76 204 46 01",
    siteWeb: "https://www.good4bees.com",
  },
  {
    match: "Unleash Lab",
    adresse: "Rue Gustave-Moynier 1",
    codePostal: "1202",
    ville: "Genève",
    canton: "GE",
    pays: "Suisse",
    numeroIDE: "CHE-293.855.378",
    contactNom: "Kashef",
    contactPrenom: "Marwan",
    telephone: "+41 78 474 42 19",
    siteWeb: "https://www.unleash-lab.tech",
  },
  {
    match: "Qerkini",
    adresse: "Route du Verney 10b",
    codePostal: "1870",
    ville: "Monthey",
    canton: "VS",
    pays: "Suisse",
    numeroIDE: "CHE-112.339.836",
    contactNom: "Qerkini",
    contactPrenom: "Jakup",
    telephone: "+41 79 667 52 00",
    siteWeb: "https://www.menuiserie-monthey.ch",
  },
  {
    match: "SP Industriel",
    adresse: "Route du Bois-de-Bay 27",
    codePostal: "1242",
    ville: "Satigny",
    canton: "GE",
    pays: "Suisse",
    numeroIDE: "CHE-321.124.052",
    numeroTVA: "CHE-321.124.052 TVA",
    contactNom: "Beaumont",
    contactPrenom: "Eric",
    telephone: "+41 22 733 03 77",
    siteWeb: "https://spindustriel.ch",
  },
  {
    match: "Hôtel de Torgon",
    adresse: "Rue de la Lanche 5",
    codePostal: "1899",
    ville: "Torgon",
    canton: "VS",
    pays: "Suisse",
    numeroIDE: "CHE-103.157.383",
    contactNom: "Vereecke",
    contactPrenom: "Myriam",
    telephone: "+41 24 481 15 71",
    siteWeb: "https://www.hotel-de-torgon.ch",
  },
  {
    match: "Lina Coiffure",
    adresse: "Rue du Marché 3",
    codePostal: "1820",
    ville: "Montreux",
    canton: "VD",
    pays: "Suisse",
    numeroIDE: "CHE-112.522.381",
    contactNom: "Lacapra",
    contactPrenom: "Carmela",
    telephone: "+41 21 963 00 92",
    siteWeb: "https://www.linacoiffure.ch",
  },
  {
    match: "Passeport Beauté",
    adresse: "c/o Claudio Bocchia, Rue Croix-de-Rives 11 A",
    codePostal: "1028",
    ville: "Préverenges",
    canton: "VD",
    pays: "Suisse",
    numeroIDE: "CHE-106.046.001",
    contactNom: "Bocchia",
    contactPrenom: "Claudio",
    telephone: "+41 21 802 65 68",
    siteWeb: "https://passeportbeaute.ch",
  },
  {
    match: "Casavue",
    adresse: "Grand-Rue 42A",
    codePostal: "1296",
    ville: "Coppet",
    canton: "VD",
    pays: "Suisse",
    numeroIDE: "CHE-287.748.395",
    contactNom: "Kever",
    contactPrenom: "Vincent",
    telephone: "+41 22 554 98 98",
    siteWeb: "https://www.opticien-coppet.ch",
  },
  {
    match: "LocFactory",
    adresse: "Route du Villars d'Avry 6",
    codePostal: "1645",
    ville: "Le Bry",
    canton: "FR",
    pays: "Suisse",
    numeroIDE: "CHE-136.589.571",
    numeroTVA: "CHE-136.589.571 TVA",
    contactNom: "Kury",
    contactPrenom: "Sébastien",
    telephone: "+41 26 411 30 00",
    siteWeb: "https://www.locfactory.ch",
  },
  {
    match: "Roch SA",
    adresse: "Route de Brent 11",
    codePostal: "1816",
    ville: "Chailly-Montreux",
    canton: "VD",
    pays: "Suisse",
    numeroIDE: "CHE-101.850.361",
    contactNom: "Roch",
    contactPrenom: "Samuel",
    telephone: "+41 21 964 64 79",
    siteWeb: "https://www.roch-sa.ch",
  },
  {
    match: "AN Sanitaire",
    adresse: "Rue des Eaux-Vives 55",
    codePostal: "1207",
    ville: "Genève",
    canton: "GE",
    pays: "Suisse",
    numeroIDE: "CHE-481.004.067",
    contactNom: "Ait Bihi",
    contactPrenom: "Nourdine",
    telephone: "+41 78 223 80 60",
    siteWeb: "https://www.sanitaire-geneve.com",
  },
  {
    match: "L&L Coiffure",
    adresse: "Avenue de la Gare 24",
    codePostal: "1870",
    ville: "Monthey",
    canton: "VS",
    pays: "Suisse",
    numeroIDE: "CHE-267.833.810",
    contactNom: "Chaar",
    contactPrenom: "Ibrahim",
    telephone: "+41 24 472 12 87",
    siteWeb: "https://www.coiffure-monthey.ch",
  },
  {
    match: "La Dent Byantse",
    adresse: "Rue du Moléson 14",
    codePostal: "1630",
    ville: "Bulle",
    canton: "FR",
    pays: "Suisse",
    contactNom: "Giraud",
    contactPrenom: "Fabienne",
    telephone: "+41 76 624 16 30",
    siteWeb: "https://www.dent-byantse.ch",
  },
  // ── MEDIUM confidence : on applique adresse/contact, IDE null si manquant
  {
    match: "SRT FORMATION",
    adresse: "25 Boulevard Massenet",
    codePostal: "13014",
    ville: "Marseille",
    pays: "France",
    numeroIDE: "83424570600033", // SIRET
    numeroTVA: "FR69834245706",
    contactNom: "Kouatelay",
    contactPrenom: "Albert",
    siteWeb: "https://www.srt-groupe.fr",
  },
  {
    match: "Coiffure St Honoré",
    adresse: "Rue des Bains 54",
    codePostal: "1205",
    ville: "Genève",
    canton: "GE",
    pays: "Suisse",
    telephone: "+41 22 328 33 88",
    siteWeb: "https://st-honore-coiffure.ch",
  },
  {
    match: "Lionel Briquet",
    adresse: "Avenue du Casino 45",
    codePostal: "1820",
    ville: "Montreux",
    canton: "VD",
    pays: "Suisse",
    contactNom: "Briquet",
    contactPrenom: "Lionel",
    telephone: "+41 21 961 23 23",
    siteWeb: "https://www.physio-montreux.ch",
  },
  {
    match: "SOS Pneus",
    adresse: "Rue de la Filature 42",
    codePostal: "1227",
    ville: "Carouge",
    canton: "GE",
    pays: "Suisse",
    telephone: "+41 79 762 23 22",
    siteWeb: "https://sospneus-geneve.ch",
  },
  {
    match: "M A K E & Beyond",
    codePostal: "1899",
    ville: "Torgon",
    canton: "VS",
    pays: "Suisse",
    contactNom: "Chazelle",
    contactPrenom: "Arthur",
    telephone: "+41 78 704 29 16",
    siteWeb: "https://makeyourcom.ch",
  },
];

async function main() {
  let updated = 0;
  let skipped = 0;
  for (const e of ENRICHMENTS) {
    const prospect = await prisma.prospect.findFirst({
      where: { raisonSociale: { contains: e.match, mode: "insensitive" } },
    });
    if (!prospect) {
      console.log(`✗ "${e.match}" introuvable en DB — skip`);
      skipped++;
      continue;
    }
    const { match: _match, ...data } = e;
    await prisma.prospect.update({
      where: { id: prospect.id },
      data,
    });
    console.log(`✓ ${prospect.raisonSociale.padEnd(28)} → enrichi`);
    updated++;
  }
  console.log(`\nBilan : ${updated} prospects enrichis, ${skipped} skip.`);
}
main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
