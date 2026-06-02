/**
 * Schemas Zod pour le module Activités.
 *
 * Distincts car :
 *   - Une création peut être "manuelle" (formulaire) ou "click-to-call"
 *     (l'app crée l'activity au moment où la commerciale clique sur un
 *     téléphone, AVANT que l'appel ait eu lieu).
 *   - Une fois l'appel terminé, on enregistre le résultat (replanification
 *     éventuelle), c'est `RecordCallResultSchema`.
 */
import {
  ActivityResultat,
  ActivityStatut,
  ActivityType,
} from "@prisma/client";
import { z } from "zod";

const stringOptional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

// ---------------------------------------------------------------------------
// CREATE — manuel (formulaire "Logger une activité")
// ---------------------------------------------------------------------------

export const ActivityCreateSchema = z.object({
  /** Prospect lié — optionnel. Null = note interne sans client. */
  prospectId: stringOptional,
  /** Si fourni (admin only), assigne l'activité à cet utilisateur. Sinon = user courant. */
  userId: stringOptional,
  type: z.nativeEnum(ActivityType),
  date: z.coerce.date(),
  sujet: z.string().trim().min(1, "Sujet obligatoire.").max(255),
  contenu: stringOptional,
  duree: z.coerce.number().int().min(0).max(1440).optional(), // minutes
  statut: z.nativeEnum(ActivityStatut).default("FAIT"),
  resultat: z.nativeEnum(ActivityResultat).optional(),
  notesResultat: stringOptional,
});

export type ActivityCreateInput = z.infer<typeof ActivityCreateSchema>;

// ---------------------------------------------------------------------------
// UPDATE — patch partiel
// ---------------------------------------------------------------------------

export const ActivityUpdateSchema = ActivityCreateSchema.partial();
export type ActivityUpdateInput = z.infer<typeof ActivityUpdateSchema>;

// ---------------------------------------------------------------------------
// CLICK-TO-CALL — démarrage d'appel (étape 6b/c)
// ---------------------------------------------------------------------------

export const StartCallSchema = z.object({
  prospectId: z.string().min(1),
  /** Le numéro composé (peut être tel mobile ou fixe selon ce qui est cliqué) */
  numero: z.string().min(1),
});

export type StartCallInput = z.infer<typeof StartCallSchema>;

// ---------------------------------------------------------------------------
// CLICK-TO-CALL — enregistrement du résultat à la fin de l'appel
// ---------------------------------------------------------------------------

/** Délai prédéfini pour la replanification d'un rappel automatique. */
export const RappelDelaiSchema = z.union([
  z.literal("J+1"),
  z.literal("J+2"),
  z.literal("J+3"),
  z.literal("J+7"),
  z.literal("J+14"),
  z.literal("J+30"),
  z.literal("custom"),
]);
export type RappelDelai = z.infer<typeof RappelDelaiSchema>;

/** Mappage délai → nombre de jours. */
export const RAPPEL_DELAI_JOURS: Record<Exclude<RappelDelai, "custom">, number> = {
  "J+1": 1,
  "J+2": 2,
  "J+3": 3,
  "J+7": 7,
  "J+14": 14,
  "J+30": 30,
};

export const RecordCallResultSchema = z
  .object({
    activityId: z.string().min(1),
    resultat: z.nativeEnum(ActivityResultat),
    notesResultat: stringOptional,
    /** Durée réelle en secondes mesurée par le widget */
    duree2: z.coerce.number().int().min(0).max(7200).optional(),
    /** Présent si le résultat déclenche un rappel auto */
    rappelDelai: RappelDelaiSchema.optional(),
    /** Si rappelDelai === "custom" */
    rappelDateCustom: z.coerce.date().optional(),
  })
  .refine(
    (data) =>
      data.rappelDelai !== "custom" || !!data.rappelDateCustom,
    {
      message: "Date custom obligatoire si on a choisi 'autre date'.",
      path: ["rappelDateCustom"],
    },
  );

export type RecordCallResultInput = z.infer<typeof RecordCallResultSchema>;

// ---------------------------------------------------------------------------
// LIST PARAMS — pour /activites
// ---------------------------------------------------------------------------

export const ActivitySortFieldSchema = z.enum([
  "date",
  "createdAt",
  "type",
  "statut",
]);
export type ActivitySortField = z.infer<typeof ActivitySortFieldSchema>;

export const ActivityListParamsSchema = z.object({
  q: stringOptional,
  type: z.nativeEnum(ActivityType).optional(),
  statut: z.nativeEnum(ActivityStatut).optional(),
  prospectId: stringOptional,
  userId: stringOptional,
  /** "today" | "week" | "month" | "all" | "overdue" */
  range: z
    .enum(["today", "week", "month", "all", "overdue"])
    .default("all")
    .optional(),
  sortBy: ActivitySortFieldSchema.default("date"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
});
export type ActivityListParams = z.infer<typeof ActivityListParamsSchema>;
