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
import { assignProspectsToDays, dateOnly } from "@/lib/social-sequence";

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
  /** AAAA-MM (mois de référence pour la distribution sur jours ouvrables) */
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "Format AAAA-MM attendu"),
  /** Une ligne par prospect : "Nom | URL"  ou juste URL */
  rawInput: z.string().min(1),
  /** Si fourni, force le démarrage de tous les prospects à cette date */
  forceStartDate: z.string().optional(),
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
      // Format : "Nom | URL"  ou juste URL
      let nom = "";
      let url = "";
      if (line.includes("|")) {
        const [n, u] = line.split("|").map((x) => x.trim());
        nom = n ?? "";
        url = u ?? "";
      } else {
        url = line;
      }
      if (!/^https?:\/\//i.test(url)) {
        errors.push(`Ligne ${i + 1} : URL invalide (${line.slice(0, 60)})`);
        continue;
      }
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

    // Distribution sur les jours du mois (ou date forcée)
    const [yearStr, monthStr] = parsed.data.yearMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);

    const dates: Date[] = parsed.data.forceStartDate
      ? items.map(() => dateOnly(parsed.data.forceStartDate!))
      : assignProspectsToDays(items.length, year, month, 10);

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
