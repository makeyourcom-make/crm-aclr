"use server";

/**
 * Server actions du module Social Media Prospection.
 *
 * Permissions :
 *  - Admin : voit / agit sur tous les comptes
 *  - Commercial : voit / agit uniquement sur les comptes dont il est responsable
 *
 * Le scope est dérivé de SocialAccount.responsableId.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  assignProspectsFromDate,
  assignProspectsToDays,
  dateOnly,
} from "@/lib/social-sequence";

// ===========================================================================
// HELPERS
// ===========================================================================

async function assertCanAccessAccount(
  accountId: string,
): Promise<void> {
  const user = await requireUser();
  if (user.role === "ADMIN") return;
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
    select: { responsableId: true },
  });
  if (!account || account.responsableId !== user.id) {
    throw new Error("Accès refusé à ce compte social.");
  }
}

async function assertCanAccessProspect(prospectId: string): Promise<{
  userId: string;
  prospect: { id: string; accountId: string };
}> {
  const user = await requireUser();
  const prospect = await prisma.socialProspect.findUnique({
    where: { id: prospectId },
    select: {
      id: true,
      accountId: true,
      account: { select: { responsableId: true } },
    },
  });
  if (!prospect) throw new Error("Prospect introuvable.");
  if (user.role !== "ADMIN" && prospect.account.responsableId !== user.id) {
    throw new Error("Accès refusé.");
  }
  return { userId: user.id, prospect };
}

// ===========================================================================
// TOGGLE STEP — cocher / décocher une étape
// ===========================================================================

const TOGGLE_STEPS = [0, 2, 4, 6] as const;
const ToggleStepSchema = z.object({
  prospectId: z.string().min(1),
  step: z.union([z.literal(0), z.literal(2), z.literal(4), z.literal(6)]),
  /** true = coche, false = décoche */
  done: z.boolean(),
});

export async function toggleStep(input: {
  prospectId: string;
  step: 0 | 2 | 4 | 6;
  done: boolean;
}): Promise<{ ok: boolean; error?: string; sequenceCompleted?: boolean }> {
  try {
    const parsed = ToggleStepSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalide" };
    await assertCanAccessProspect(parsed.data.prospectId);

    const field = `step${parsed.data.step}Done` as
      | "step0Done"
      | "step2Done"
      | "step4Done"
      | "step6Done";

    const updated = await prisma.socialProspect.update({
      where: { id: parsed.data.prospectId },
      data: { [field]: parsed.data.done ? new Date() : null },
      select: {
        step0Done: true,
        step2Done: true,
        step4Done: true,
        step6Done: true,
        statut: true,
      },
    });

    // Séquence terminée si les 4 sont cochées
    const allDone =
      !!updated.step0Done &&
      !!updated.step2Done &&
      !!updated.step4Done &&
      !!updated.step6Done;

    // Si 4/4 et statut "EN_COURS" → bascule en "PAS_REPONSE" par défaut
    // (l'user peut ensuite passer à GAGNE/PERDU via updateStatut)
    if (allDone && updated.statut === "EN_COURS") {
      await prisma.socialProspect.update({
        where: { id: parsed.data.prospectId },
        data: { statut: "PAS_REPONSE" },
      });
    }

    revalidatePath("/social");
    revalidatePath("/social/aujourdhui");
    return { ok: true, sequenceCompleted: allDone };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

// ===========================================================================
// UPDATE STATUT — Pas de réponse / Gagné / Perdu / En cours
// ===========================================================================

const StatutSchema = z.object({
  prospectId: z.string().min(1),
  statut: z.enum(["EN_COURS", "PAS_REPONSE", "GAGNE", "PERDU"]),
  notes: z.string().optional(),
});

export async function updateProspectStatut(input: {
  prospectId: string;
  statut: "EN_COURS" | "PAS_REPONSE" | "GAGNE" | "PERDU";
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const parsed = StatutSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalide" };
    await assertCanAccessProspect(parsed.data.prospectId);

    await prisma.socialProspect.update({
      where: { id: parsed.data.prospectId },
      data: {
        statut: parsed.data.statut,
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      },
    });
    revalidatePath("/social");
    revalidatePath("/social/aujourdhui");
    revalidatePath("/social/stats");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

// ===========================================================================
// BULK IMPORT — chargement mensuel
// ===========================================================================

const BulkImportSchema = z.object({
  accountId: z.string().min(1),
  /** Une ligne par prospect : "Nom | URL"  ou juste URL */
  rawInput: z.string().min(1),
  /** Mode de distribution :
   *   - "fromToday" (défaut) : étale 10/jour ouvrable à partir d'aujourd'hui
   *   - "month"             : étale sur les jours ouvrables d'un mois précis
   *   - "fixedDate"         : force tous à la même date (option exceptionnelle) */
  mode: z.enum(["fromToday", "month", "fixedDate"]).default("fromToday"),
  /** Si mode = "month" : AAAA-MM */
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  /** Si mode = "fixedDate" : la date à utiliser pour tous */
  fixedDate: z.string().optional(),
});

export interface BulkImportResult {
  ok: boolean;
  count?: number;
  errors?: string[];
  error?: string;
}

export async function bulkImportSocialProspects(
  input: unknown,
): Promise<BulkImportResult> {
  try {
    const parsed = BulkImportSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
    }
    await assertCanAccessAccount(parsed.data.accountId);

    // Parse les lignes
    const rows = parsed.data.rawInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const items: Array<{ nom: string; profilUrl: string }> = [];
    const errors: string[] = [];
    for (const [i, line] of rows.entries()) {
      // Parsing tolérant : on cherche l'URL dans la ligne (peu importe ce
      // qui est avant), le nom = le texte avant l'URL nettoyé des
      // séparateurs courants ( | ¦ ; , tab "→" "-" ).
      const urlMatch = line.match(/https?:\/\/\S+/i);
      if (!urlMatch) {
        errors.push(`Ligne ${i + 1} : pas d'URL trouvée (${line.slice(0, 60)})`);
        continue;
      }
      // Nettoie ponctuation finale (ex. "...com/," ou "...com/)" )
      const url = urlMatch[0].replace(/[.,;)\]>}'"]+$/, "");
      const before = line.slice(0, urlMatch.index).trim();
      // Nettoie séparateurs en fin de "before" : | ¦ ; , tab → -
      let nom = before.replace(/[|¦;,\t→\-]+\s*$/u, "").trim();
      if (!nom) {
        // Devine depuis l'URL : dernier segment du path
        try {
          const u = new URL(url);
          const segs = u.pathname.split("/").filter(Boolean);
          nom = decodeURIComponent(segs[segs.length - 1] ?? "(sans nom)");
        } catch {
          nom = "(sans nom)";
        }
      }
      items.push({ nom, profilUrl: url });
    }

    if (items.length === 0) {
      return { ok: false, error: "Aucune ligne valide.", errors };
    }

    // Distribution selon le mode choisi
    let dates: Date[];
    if (parsed.data.mode === "fixedDate") {
      const fd = parsed.data.fixedDate;
      if (!fd) return { ok: false, error: "Date forcée manquante." };
      dates = items.map(() => dateOnly(fd));
    } else if (parsed.data.mode === "month") {
      const ym = parsed.data.yearMonth;
      if (!ym) return { ok: false, error: "Mois manquant." };
      const [yearStr, monthStr] = ym.split("-");
      dates = assignProspectsToDays(
        items.length,
        Number(yearStr),
        Number(monthStr),
        10,
      );
    } else {
      // "fromToday" (défaut) — étale dès aujourd'hui sur les jours ouvrables
      const today = new Date();
      today.setUTCHours(12, 0, 0, 0);
      dates = assignProspectsFromDate(items.length, today, 10);
    }

    await prisma.socialProspect.createMany({
      data: items.map((it, idx) => ({
        accountId: parsed.data.accountId,
        nom: it.nom,
        profilUrl: it.profilUrl,
        dateDemarrage: dates[idx]!,
      })),
    });

    revalidatePath("/social");
    revalidatePath("/social/aujourdhui");
    return { ok: true, count: items.length, errors };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

// ===========================================================================
// DELETE
// ===========================================================================

export async function deleteSocialProspect(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanAccessProspect(id);
    await prisma.socialProspect.delete({ where: { id } });
    revalidatePath("/social");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

// ===========================================================================
// UPDATE INFO (nom, URL, date)
// ===========================================================================

const UpdateInfoSchema = z.object({
  prospectId: z.string().min(1),
  nom: z.string().trim().min(1).optional(),
  profilUrl: z.string().trim().url().optional(),
  dateDemarrage: z.string().optional(),
});

export async function updateProspectInfo(input: {
  prospectId: string;
  nom?: string;
  profilUrl?: string;
  dateDemarrage?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const parsed = UpdateInfoSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalide" };
    await assertCanAccessProspect(parsed.data.prospectId);
    await prisma.socialProspect.update({
      where: { id: parsed.data.prospectId },
      data: {
        ...(parsed.data.nom !== undefined ? { nom: parsed.data.nom } : {}),
        ...(parsed.data.profilUrl !== undefined
          ? { profilUrl: parsed.data.profilUrl }
          : {}),
        ...(parsed.data.dateDemarrage
          ? { dateDemarrage: dateOnly(parsed.data.dateDemarrage) }
          : {}),
      },
    });
    revalidatePath("/social");
    revalidatePath("/social/aujourdhui");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

void TOGGLE_STEPS; // silenceur d'unused

// ===========================================================================
// REDISTRIBUER les prospects EN_COURS d'un compte sur les jours ouvrables
// ===========================================================================

const RedistribSchema = z.object({
  accountId: z.string().min(1),
  /** AAAA-MM */
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  /** Cible : 10 prospects par jour ouvrable par défaut */
  perDay: z.number().int().min(1).max(50).default(10),
  /** Si true, n'écrase que les prospects dont 0 étape n'est cochée
   *  (ceux qu'on n'a pas encore commencé à travailler). Défaut true. */
  onlyUnstarted: z.boolean().default(true),
});

export async function redistributeProspects(input: {
  accountId: string;
  yearMonth: string;
  perDay?: number;
  onlyUnstarted?: boolean;
}): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const parsed = RedistribSchema.safeParse({
      perDay: 10,
      onlyUnstarted: true,
      ...input,
    });
    if (!parsed.success) return { ok: false, error: "Invalide" };
    await assertCanAccessAccount(parsed.data.accountId);

    // Mois ciblé
    const [yearStr, monthStr] = parsed.data.yearMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));

    // Cherche les prospects EN_COURS du compte, démarrage dans ce mois
    const prospects = await prisma.socialProspect.findMany({
      where: {
        accountId: parsed.data.accountId,
        statut: "EN_COURS",
        dateDemarrage: { gte: monthStart, lt: monthEnd },
        ...(parsed.data.onlyUnstarted
          ? {
              step0Done: null,
              step2Done: null,
              step4Done: null,
              step6Done: null,
            }
          : {}),
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    if (prospects.length === 0) {
      return {
        ok: true,
        count: 0,
        error: "Aucun prospect à redistribuer pour ce mois.",
      };
    }

    // Calcule les nouvelles dates (10/jour ouvrable)
    const newDates = assignProspectsToDays(
      prospects.length,
      year,
      month,
      parsed.data.perDay,
    );

    // Update en transaction (1 update par prospect, batch côté serveur)
    await prisma.$transaction(
      prospects.map((p, idx) =>
        prisma.socialProspect.update({
          where: { id: p.id },
          data: { dateDemarrage: newDates[idx] },
        }),
      ),
    );

    revalidatePath("/social");
    revalidatePath("/social/aujourdhui");
    revalidatePath("/social/prospects");
    return { ok: true, count: prospects.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}
