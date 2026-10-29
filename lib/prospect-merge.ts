/**
 * Fusion de deux fiches entreprise (doublons).
 *
 * Toutes les données de la fiche SOURCE (doublon) sont déplacées vers la fiche
 * CIBLE (maître conservée) : activités, deals, contrats, emails, charges,
 * allocations de charges, récurrences, tags, dossiers, lignes de planning.
 * Les champs vides de la cible sont complétés depuis la source. La source
 * n'est JAMAIS supprimée : elle est marquée « fusionnée » (mergedIntoId),
 * renommée « [Fusionnée] … » et sortie de la prospection active
 * (statut NE_PAS_RAPPELER), avec un lien vers la cible.
 *
 * Idempotent-safe : une source déjà fusionnée est ignorée.
 */
// NB : module serveur uniquement (utilise prisma). Le paquet `server-only`
// n'est pas installé dans ce projet ; ne pas l'importer depuis un composant client.
import { prisma } from "@/lib/db";

export interface MergeResult {
  ok: boolean;
  error?: string;
  moved?: Record<string, number>;
}

/** Champs texte/scalaires de la cible complétés depuis la source s'ils sont vides. */
const FILLABLE = [
  "email",
  "emailFacturation",
  "telephone",
  "telephoneMobile",
  "contactNom",
  "contactPrenom",
  "contactFonction",
  "adresse",
  "codePostal",
  "ville",
  "canton",
  "numeroIDE",
  "numeroTVA",
  "siteWeb",
  "linkedIn",
  "facebook",
  "instagram",
  "noga",
  "effectif",
  "secteur",
  "source",
] as const;

export async function mergeProspects(
  cibleId: string,
  sourceId: string,
): Promise<MergeResult> {
  if (cibleId === sourceId) return { ok: false, error: "Même fiche." };

  const [cible, source] = await Promise.all([
    prisma.prospect.findUnique({ where: { id: cibleId } }),
    prisma.prospect.findUnique({ where: { id: sourceId } }),
  ]);
  if (!cible) return { ok: false, error: "Fiche cible introuvable." };
  if (!source) return { ok: false, error: "Fiche source introuvable." };
  if (source.mergedIntoId) return { ok: false, error: "Fiche déjà fusionnée." };

  const moved: Record<string, number> = {};

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Déplacer les relations simples (prospectId → cible).
        moved.activites = (
          await tx.activity.updateMany({ where: { prospectId: sourceId }, data: { prospectId: cibleId } })
        ).count;
        moved.deals = (
          await tx.deal.updateMany({ where: { prospectId: sourceId }, data: { prospectId: cibleId } })
        ).count;
        moved.contrats = (
          await tx.contract.updateMany({ where: { prospectId: sourceId }, data: { prospectId: cibleId } })
        ).count;
        moved.emails = (
          await tx.email.updateMany({ where: { prospectId: sourceId }, data: { prospectId: cibleId } })
        ).count;
        moved.charges = (
          await tx.expense.updateMany({ where: { prospectId: sourceId }, data: { prospectId: cibleId } })
        ).count;
        moved.recurrences = (
          await tx.expenseRecurrence.updateMany({ where: { prospectId: sourceId }, data: { prospectId: cibleId } })
        ).count;
        moved.dossiers = (
          await tx.dossier.updateMany({ where: { prospectId: sourceId }, data: { prospectId: cibleId } })
        ).count;
        moved.planning = (
          await tx.planningLigne.updateMany({ where: { prospectId: sourceId }, data: { prospectId: cibleId } })
        ).count;

        // 2. Allocations de charges : contrainte d'unicité éventuelle → déplacer
        //    seulement celles dont la charge n'est pas déjà allouée à la cible.
        const allocs = await tx.expenseAllocation.findMany({
          where: { prospectId: sourceId },
          select: { id: true, expenseId: true },
        });
        let allocMoved = 0;
        for (const a of allocs) {
          const clash = await tx.expenseAllocation.findFirst({
            where: { prospectId: cibleId, expenseId: a.expenseId },
            select: { id: true },
          });
          if (!clash) {
            await tx.expenseAllocation.update({ where: { id: a.id }, data: { prospectId: cibleId } });
            allocMoved++;
          }
        }
        moved.allocations = allocMoved;

        // 3. Tags : clé composite (prospectId, tagId) → déplacer ceux absents de la cible.
        const tags = await tx.prospectTagAssignment.findMany({
          where: { prospectId: sourceId },
          select: { tagId: true },
        });
        let tagMoved = 0;
        for (const t of tags) {
          const exists = await tx.prospectTagAssignment.findUnique({
            where: { prospectId_tagId: { prospectId: cibleId, tagId: t.tagId } },
          });
          if (!exists) {
            await tx.prospectTagAssignment.update({
              where: { prospectId_tagId: { prospectId: sourceId, tagId: t.tagId } },
              data: { prospectId: cibleId },
            });
            tagMoved++;
          }
        }
        moved.tags = tagMoved;

        // 4. Compléter les champs vides de la cible depuis la source.
        const sourceRow = source as unknown as Record<string, unknown>;
        const cibleRow = cible as unknown as Record<string, unknown>;
        const fill: Record<string, unknown> = {};
        for (const f of FILLABLE) {
          const cur = cibleRow[f];
          const src = sourceRow[f];
          if ((cur === null || cur === undefined || cur === "") && src != null && src !== "") {
            fill[f] = src;
          }
        }
        // Notes : on concatène celles de la source (sans rien perdre).
        const srcNotes = (sourceRow["notesGenerales"] as string | null)?.trim();
        if (srcNotes) {
          const curNotes = (cibleRow["notesGenerales"] as string | null)?.trim();
          fill["notesGenerales"] = curNotes
            ? `${curNotes}\n\n[Fusion de « ${source.raisonSociale} »]\n${srcNotes}`
            : srcNotes;
        }
        if (Object.keys(fill).length > 0) {
          await tx.prospect.update({ where: { id: cibleId }, data: fill });
        }

        // 5. Marquer la source comme fusionnée (conservée, jamais supprimée).
        await tx.prospect.update({
          where: { id: sourceId },
          data: {
            mergedIntoId: cibleId,
            statut: "NE_PAS_RAPPELER",
            raisonSociale: source.raisonSociale.startsWith("[Fusionnée]")
              ? source.raisonSociale
              : `[Fusionnée] ${source.raisonSociale}`,
          },
        });
      },
      { timeout: 30_000 },
    );
    return { ok: true, moved };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur de fusion." };
  }
}
