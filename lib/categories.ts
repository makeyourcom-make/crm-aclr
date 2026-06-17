import { ProductCategorie } from "@prisma/client";

import { prisma } from "@/lib/db";

/** Codes des catégories SYSTÈME (liées à l'enum, pilotent la commission ADS). */
export const SYSTEM_CATEGORIE_CODES: ProductCategorie[] = [
  "SITE",
  "RS",
  "SEO",
  "ADS",
  "CMO",
  "METRICOOL",
  "PACK",
];

/** Libellés par défaut des catégories système (repli si rien en base). */
export const DEFAULT_CATEGORIE_LABELS: Record<string, string> = {
  SITE: "Site web",
  RS: "Réseaux sociaux",
  SEO: "Référencement",
  ADS: "Publicité Google/Meta",
  CMO: "CMO fractionné",
  METRICOOL: "Licence Metricool",
  PACK: "Pack",
};

export interface Categorie {
  code: string;
  label: string;
  ordre: number;
  systeme: boolean;
}

/** Toutes les catégories (système + ajoutées), triées. Côté serveur. */
export async function getCategories(): Promise<Categorie[]> {
  const rows = await prisma.productCategorieMeta.findMany({
    orderBy: [{ systeme: "desc" }, { ordre: "asc" }, { label: "asc" }],
  });
  if (rows.length === 0) {
    // Repli défensif (avant seed) : renvoie les catégories système par défaut.
    return SYSTEM_CATEGORIE_CODES.map((code, i) => ({
      code,
      label: DEFAULT_CATEGORIE_LABELS[code] ?? code,
      ordre: i,
      systeme: true,
    }));
  }
  return rows.map((r) => ({
    code: r.code,
    label: r.label,
    ordre: r.ordre,
    systeme: r.systeme,
  }));
}

/** Map code → libellé (toutes catégories). Côté serveur. */
export async function getCategorieLabels(): Promise<Record<string, string>> {
  const cats = await getCategories();
  const map: Record<string, string> = { ...DEFAULT_CATEGORIE_LABELS };
  for (const c of cats) map[c.code] = c.label;
  return map;
}
