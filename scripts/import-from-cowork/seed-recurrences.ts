/**
 * Seed des charges récurrentes connues, basé sur les charges importées de Cowork.
 *
 * Ces templates généreront automatiquement la charge mensuelle en EN_ATTENTE
 * dès qu'on cliquera sur "Générer" pour le mois en cours.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Spec = {
  label: string;
  categorie:
    | "LOYER"
    | "SOFTWARE_SAAS"
    | "MARKETING"
    | "PUBLICITE"
    | "DEPLACEMENTS"
    | "RESTAURATION"
    | "MATERIEL_BUREAU"
    | "ASSURANCES"
    | "TELECOM"
    | "FORMATION"
    | "HONORAIRES"
    | "IMPOTS"
    | "BANQUE_FRAIS"
    | "AUTRE";
  fournisseur: string;
  description?: string;
  montantEstime: number;
  tauxTVA?: number;
  frequence?: "MENSUEL" | "TRIMESTRIEL" | "ANNUEL";
  jourMois?: number;
  prospectName?: string; // pour rattacher au client
};

async function main() {
  const SEEDS: Spec[] = [
    // Télécom
    {
      label: "Sunrise — Mobile + Internet/TV",
      categorie: "TELECOM",
      fournisseur: "Sunrise",
      montantEstime: 169.95,
      tauxTVA: 0.081,
      jourMois: 5,
    },
    // Software récurrent
    {
      label: "Google Workspace Business Standard",
      categorie: "SOFTWARE_SAAS",
      fournisseur: "Google",
      montantEstime: 13.99,
      tauxTVA: 0,
      jourMois: 1,
    },
    {
      label: "Claude IA Max Plan 5x",
      categorie: "SOFTWARE_SAAS",
      fournisseur: "Anthropic",
      montantEstime: 89.5,
      tauxTVA: 0,
      jourMois: 12,
    },
    {
      label: "Claude Pro",
      categorie: "SOFTWARE_SAAS",
      fournisseur: "Anthropic",
      montantEstime: 18.41,
      tauxTVA: 0,
      jourMois: 12,
    },
    {
      label: "Netlify Base Plan",
      categorie: "SOFTWARE_SAAS",
      fournisseur: "Netlify",
      montantEstime: 17.9,
      tauxTVA: 0,
      jourMois: 1,
    },
    // Honoraires freelance
    {
      label: "Lucas Carlin — Community Manager",
      categorie: "HONORAIRES",
      fournisseur: "Lucas Carlin (EI)",
      montantEstime: 500,
      tauxTVA: 0,
      jourMois: 28,
    },
    // Frais bancaires
    {
      label: "Frais bancaires UBS",
      categorie: "BANQUE_FRAIS",
      fournisseur: "UBS",
      montantEstime: 9,
      tauxTVA: 0,
      jourMois: 28,
    },
    // CFF mensuel
    {
      label: "Abonnement CFF mensuel Evian-Lausanne",
      categorie: "DEPLACEMENTS",
      fournisseur: "CFF",
      montantEstime: 292,
      tauxTVA: 0.081,
      jourMois: 5,
    },
    // LWS domaines clients (12 mois) — annuels
    {
      label: "LWS — Nom de domaine srt-formation.fr",
      categorie: "SOFTWARE_SAAS",
      fournisseur: "LWS",
      montantEstime: 4.74,
      tauxTVA: 0,
      frequence: "ANNUEL",
      jourMois: 23,
      prospectName: "SRT FORMATION",
    },
    {
      label: "LWS — Nom de domaine cmo-suisse.ch",
      categorie: "SOFTWARE_SAAS",
      fournisseur: "LWS",
      montantEstime: 11.39,
      tauxTVA: 0,
      frequence: "ANNUEL",
      jourMois: 23,
    },
    {
      label: "LWS — Nom de domaine make-marketing.ch",
      categorie: "SOFTWARE_SAAS",
      fournisseur: "LWS",
      montantEstime: 11.39,
      tauxTVA: 0,
      frequence: "ANNUEL",
      jourMois: 17,
      prospectName: "M A K E & Beyond",
    },
    {
      label: "LWS — Nom de domaine physio-montreux.ch",
      categorie: "SOFTWARE_SAAS",
      fournisseur: "LWS",
      montantEstime: 7.4,
      tauxTVA: 0,
      frequence: "ANNUEL",
      jourMois: 23,
      prospectName: "Lionel Briquet",
    },
    {
      label: "LWS — Nom de domaine qerkini.ch",
      categorie: "SOFTWARE_SAAS",
      fournisseur: "LWS",
      montantEstime: 11.39,
      tauxTVA: 0,
      frequence: "ANNUEL",
      jourMois: 20,
      prospectName: "Qerkini Sàrl",
    },
    {
      label: "Infomaniak — Domaine + Mail arcoz-ag.ch",
      categorie: "SOFTWARE_SAAS",
      fournisseur: "Infomaniak",
      montantEstime: 27.36,
      tauxTVA: 0.081,
      frequence: "ANNUEL",
      jourMois: 26,
      prospectName: "ARCOZ AG",
    },
  ];

  console.log(`Seeding ${SEEDS.length} récurrences...`);
  let created = 0;
  let skipped = 0;

  for (const s of SEEDS) {
    const existing = await prisma.expenseRecurrence.findFirst({
      where: { label: s.label },
    });
    if (existing) {
      skipped++;
      console.log(`  ⊘ Existe : ${s.label}`);
      continue;
    }

    let prospectId: string | null = null;
    if (s.prospectName) {
      const p = await prisma.prospect.findFirst({
        where: {
          raisonSociale: { equals: s.prospectName, mode: "insensitive" },
        },
      });
      prospectId = p?.id ?? null;
    }

    await prisma.expenseRecurrence.create({
      data: {
        label: s.label,
        categorie: s.categorie,
        fournisseur: s.fournisseur,
        description: s.description ?? null,
        montantEstime: s.montantEstime,
        tauxTVA: s.tauxTVA ?? 0.077,
        frequence: s.frequence ?? "MENSUEL",
        jourMois: s.jourMois ?? 1,
        prospectId,
        actif: true,
      },
    });
    created++;
    console.log(
      `  ✓ ${s.frequence ?? "MENSUEL"} : ${s.label} (${s.montantEstime} CHF)${prospectId ? " → " + s.prospectName : ""}`,
    );
  }

  console.log(`\n✓ ${created} créées, ${skipped} déjà existantes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
