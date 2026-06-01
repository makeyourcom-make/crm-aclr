/**
 * Génération automatique des charges récurrentes.
 *
 * Principe :
 *   • L'admin déclare ses charges récurrentes via /charges/recurrences
 *     (Sunrise mensuel, Workspace mensuel, Lucas freelance mensuel, etc.)
 *   • Chaque mois (déclenché manuellement par l'admin ou par cron), on génère
 *     une charge en EN_ATTENTE avec montant estimé pré-rempli
 *   • L'admin n'a plus qu'à uploader le ticket réel et ajuster le montant
 *     si besoin, puis marquer payée
 *
 * Idempotence :
 *   • On ne génère pas deux fois la même charge pour la même période
 *     (clé d'unicité = recurrenceId + date du 1er du mois)
 */
import { prisma } from "@/lib/db";

export interface GenerateResult {
  created: number;
  skipped: number;
  details: Array<{ recurrenceLabel: string; expenseId: string; date: Date }>;
}

/**
 * Génère les charges récurrentes attendues entre `from` et `to` (exclu).
 * Par défaut : du 1er du mois en cours au 1er du mois suivant.
 */
export async function generateRecurrentExpenses(opts?: {
  from?: Date;
  to?: Date;
  createdById?: string;
}): Promise<GenerateResult> {
  const now = new Date();
  const from =
    opts?.from ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const to =
    opts?.to ?? new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const recurrences = await prisma.expenseRecurrence.findMany({
    where: {
      actif: true,
      OR: [{ dateFin: null }, { dateFin: { gte: from } }],
    },
  });

  let created = 0;
  let skipped = 0;
  const details: GenerateResult["details"] = [];

  for (const r of recurrences) {
    // Calcule les dates de génération attendues sur la fenêtre [from, to)
    const expected = computeExpectedDates(r, from, to);

    for (const date of expected) {
      // Vérifie idempotence : déjà une charge générée pour cette récurrence
      // à cette date exacte (ou ±2 jours pour tolérer un décalage de planning) ?
      const dayMs = 24 * 60 * 60 * 1000;
      const existing = await prisma.expense.findFirst({
        where: {
          recurrenceId: r.id,
          date: {
            gte: new Date(date.getTime() - 2 * dayMs),
            lt: new Date(date.getTime() + 2 * dayMs),
          },
        },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const tva = Math.round(Number(r.montantEstime) * Number(r.tauxTVA) * 100) / 100;
      const ht = Math.round((Number(r.montantEstime) - tva) * 100) / 100;
      const exp = await prisma.expense.create({
        data: {
          date,
          statutPaiement: "EN_ATTENTE",
          categorie: r.categorie,
          fournisseur: r.fournisseur,
          description: `${r.label} — ${monthLabel(date)} ${date.getFullYear()}`,
          montantHT: ht,
          tauxTVA: r.tauxTVA,
          montantTVA: tva,
          montantTTC: r.montantEstime,
          tvaRecuperable: Number(r.tauxTVA) > 0,
          prospectId: r.prospectId,
          recurrenceId: r.id,
          createdById: opts?.createdById ?? null,
        },
      });
      created++;
      details.push({
        recurrenceLabel: r.label,
        expenseId: exp.id,
        date,
      });
    }
  }

  return { created, skipped, details };
}

function computeExpectedDates(
  r: { frequence: string; jourMois: number | null; dateFin: Date | null },
  from: Date,
  to: Date,
): Date[] {
  const jour = r.jourMois ?? 1;
  const stepMonths =
    r.frequence === "MENSUEL"
      ? 1
      : r.frequence === "BIMESTRIEL"
        ? 2
        : r.frequence === "TRIMESTRIEL"
          ? 3
          : r.frequence === "SEMESTRIEL"
            ? 6
            : r.frequence === "ANNUEL"
              ? 12
              : 1;

  const result: Date[] = [];
  // On part du début du mois de `from` et on avance par pas de stepMonths
  // sur 24 mois max (sécurité)
  const start = new Date(from.getFullYear(), from.getMonth(), jour);
  let cursor = new Date(start);
  for (let i = 0; i < 240; i++) {
    if (cursor >= to) break;
    if (cursor >= from && (!r.dateFin || cursor < r.dateFin)) {
      result.push(new Date(cursor));
    }
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + stepMonths,
      jour,
    );
  }
  return result;
}

function monthLabel(d: Date): string {
  return [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ][d.getMonth()];
}
