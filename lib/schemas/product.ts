/**
 * Schemas Zod pour le module Catalogue produits.
 */
import { ProductCategorie, ProductType } from "@prisma/client";
import { z } from "zod";

const stringOptional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

/** Prix optionnel : "" → undefined, sinon nombre positif. */
const prixOptional = z
  .preprocess(
    (v) =>
      v === "" || v === null || v === undefined ? undefined : Number(v),
    z.number().min(0).max(1_000_000),
  )
  .optional();

export const ProductCreateSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Le nom est obligatoire (min 2 car).")
    .max(255),
  description: stringOptional,
  type: z.nativeEnum(ProductType),
  categorie: z.nativeEnum(ProductCategorie),
  prixOneShot: prixOptional,
  prixMensuel: prixOptional,
  prixAnnuel: prixOptional,
  /** Coûts internes (interne, jamais affiché client) — rentabilité projet */
  coutOneShot: prixOptional,
  coutMensuel: prixOptional,
  /** Pour les PACK : tableau d'IDs des produits composants */
  composantsIds: z.array(z.string()).optional(),
  isActive: z.coerce.boolean().default(true),
});

export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;

export const ProductUpdateSchema = ProductCreateSchema.partial();
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;

/** Édition inline d'un prix unique depuis la liste. */
export const ProductPriceUpdateSchema = z.object({
  productId: z.string().min(1),
  field: z.enum(["prixOneShot", "prixMensuel", "prixAnnuel"]),
  /** Null = "vide" (le prix n'est pas applicable à ce produit). */
  value: z.number().min(0).max(1_000_000).nullable(),
});
export type ProductPriceUpdateInput = z.infer<typeof ProductPriceUpdateSchema>;
