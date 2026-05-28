/**
 * Requêtes de lecture pour le module Catalogue.
 */
import { prisma } from "@/lib/db";

export async function getProducts() {
  const products = await prisma.product.findMany({
    orderBy: [{ categorie: "asc" }, { type: "asc" }, { nom: "asc" }],
  });

  // Sépare unitaires vs packs
  const unitaires = products.filter((p) => p.type !== "PACK");
  const packs = products.filter((p) => p.type === "PACK");

  return { all: products, unitaires, packs };
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

/**
 * Résout les IDs des composants d'un pack en produits complets.
 * Retourne un tableau dans le même ordre que composantsIds.
 */
export async function resolvePackComponents(composantsIds: unknown) {
  if (!Array.isArray(composantsIds) || composantsIds.length === 0) {
    return [];
  }
  const ids = composantsIds.filter((id): id is string => typeof id === "string");
  if (ids.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      nom: true,
      type: true,
      prixOneShot: true,
      prixMensuel: true,
      prixAnnuel: true,
    },
  });
  // Reconserve l'ordre original
  const map = new Map(products.map((p) => [p.id, p]));
  return ids.map((id) => map.get(id)).filter((p) => p !== undefined);
}
