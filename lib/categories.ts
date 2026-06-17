import { ProductCategorie } from "@prisma/client";

import { prisma } from "@/lib/db";

/** Tous les codes de catégorie (ordre par défaut). */
export const CATEGORIE_CODES: ProductCategorie[] = [
  "SITE",
  "RS",
  "SEO",
  "ADS",
  "CMO",
  "METRICOOL",
  "PACK",
];

/** Libellés par défaut (utilisés si aucun renommage en base). */
export const DEFAULT_CATEGORIE_LABELS: Record<ProductCategorie, string> = {
  SITE: "Site web",
  RS: "Réseaux sociaux",
  SEO: "Référencement",
  ADS: "Publicité Google/Meta",
  CMO: "CMO fractionné",
  METRICOOL: "Licence Metricool",
  PACK: "Pack",
};

/**
 * Libellés EFFECTIFS des catégories : défauts surchargés par les renommages
 * stockés en base (ProductCategorieMeta). À appeler côté serveur.
 */
export async function getCategorieLabels(): Promise<Record<string, string>> {
  const overrides = await prisma.productCategorieMeta.findMany();
  const map: Record<string, string> = { ...DEFAULT_CATEGORIE_LABELS };
  for (const o of overrides) map[o.code] = o.label;
  return map;
}
