"use server";

/**
 * Actions du planning de production. Cloisonnement : chacun agit sur SON
 * planning ; l'admin peut agir sur tous.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { addMonths, todayZurich } from "@/lib/planning/dates";
import {
  applyDedupe,
  createLigne,
  deleteFutureGenerated,
  generateTasks,
  placeRules,
  setLigneActif,
  setRegleActif,
} from "@/lib/planning/engine";
import { SERVICES, type ServiceCode } from "@/lib/planning/templates";
import { requireUser } from "@/lib/session";

type Result = { ok: boolean; error?: string };

const STATUTS = ["A_FAIRE", "EN_COURS", "ATTENTE_CLIENT", "FAIT", "ABANDONNEE"] as const;
const FREQUENCES = ["MENSUELLE", "BIMENSUELLE", "HEBDO", "BIMESTRIELLE", "TRIMESTRIELLE", "ANNUELLE", "PONCTUELLE"] as const;

async function canAccess(ownerId: string): Promise<boolean> {
  const user = await requireUser();
  return user.role === "ADMIN" || user.id === ownerId;
}

function done() {
  revalidatePath("/dossiers/planning");
  revalidatePath("/");
}

/** Régénère le calendrier glissant après un changement de règle. */
async function refresh(ownerId: string) {
  await placeRules(ownerId, { rebalance: false });
  const start = addMonths(todayZurich(), 0);
  await generateTasks(ownerId, start, addMonths(start, 12));
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

// ---------------------------------------------------------------------------
// Tâches
// ---------------------------------------------------------------------------

export async function setTacheStatut(id: string, statut: (typeof STATUTS)[number]): Promise<Result> {
  if (!STATUTS.includes(statut)) return { ok: false, error: "Statut invalide." };
  const t = await prisma.planningTache.findUnique({ where: { id }, select: { ownerId: true } });
  if (!t || !(await canAccess(t.ownerId))) return { ok: false, error: "Accès refusé." };
  await prisma.planningTache.update({
    where: { id },
    data: { statut, faitLe: statut === "FAIT" ? new Date() : null },
  });
  done();
  return { ok: true };
}

const UpdateTache = z.object({
  id: z.string().min(1),
  titre: z.string().trim().min(1).max(200).optional(),
  date: ymd.optional(),
  dureeMin: z.number().int().min(5).max(600).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function updateTache(input: unknown): Promise<Result> {
  const p = UpdateTache.safeParse(input);
  if (!p.success) return { ok: false, error: "Formulaire invalide." };
  const t = await prisma.planningTache.findUnique({ where: { id: p.data.id }, select: { ownerId: true } });
  if (!t || !(await canAccess(t.ownerId))) return { ok: false, error: "Accès refusé." };
  await prisma.planningTache.update({
    where: { id: p.data.id },
    data: {
      ...(p.data.titre ? { titre: p.data.titre } : {}),
      ...(p.data.date ? { date: toDate(p.data.date) } : {}),
      ...(p.data.dureeMin ? { dureeMin: p.data.dureeMin } : {}),
      ...(p.data.notes !== undefined ? { notes: p.data.notes?.trim() || null } : {}),
    },
  });
  done();
  return { ok: true };
}

/** Tâche manuelle : supprimée. Tâche récurrente : abandonnée (sinon elle reviendrait). */
export async function deleteTache(id: string): Promise<Result> {
  const t = await prisma.planningTache.findUnique({ where: { id }, select: { ownerId: true, regleId: true } });
  if (!t || !(await canAccess(t.ownerId))) return { ok: false, error: "Accès refusé." };
  if (t.regleId) {
    await prisma.planningTache.update({ where: { id }, data: { statut: "ABANDONNEE", faitLe: null } });
  } else {
    await prisma.planningTache.delete({ where: { id } });
  }
  done();
  return { ok: true };
}

const CreateTache = z.object({
  ligneId: z.string().min(1),
  titre: z.string().trim().min(1).max(200),
  date: ymd,
  dureeMin: z.number().int().min(5).max(600),
});

export async function createTacheManuelle(input: unknown): Promise<Result> {
  const p = CreateTache.safeParse(input);
  if (!p.success) return { ok: false, error: "Formulaire invalide." };
  const l = await prisma.planningLigne.findUnique({ where: { id: p.data.ligneId }, select: { ownerId: true } });
  if (!l || !(await canAccess(l.ownerId))) return { ok: false, error: "Accès refusé." };
  await prisma.planningTache.create({
    data: {
      ownerId: l.ownerId,
      ligneId: p.data.ligneId,
      titre: p.data.titre,
      date: toDate(p.data.date),
      dureeMin: p.data.dureeMin,
    },
  });
  done();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Règles (récurrences)
// ---------------------------------------------------------------------------

const RegleInput = z.object({
  titre: z.string().trim().min(1).max(200),
  frequence: z.enum(FREQUENCES),
  fixe: z.boolean(),
  /** Date fixe : jour du mois. Sinon fenêtre [fenetreDebut, fenetreFin]. */
  jourFixe: z.number().int().min(1).max(31).optional(),
  fenetreDebut: z.number().int().min(1).max(31),
  fenetreFin: z.number().int().min(1).max(31),
  jourSemaine: z.number().int().min(1).max(5).nullable().optional(),
  dureeMin: z.number().int().min(5).max(600),
  actif: z.boolean(),
  datePonctuelle: ymd.nullable().optional(),
});

function regleData(d: z.infer<typeof RegleInput>) {
  const fenetreDebut = Math.min(d.fenetreDebut, d.fenetreFin);
  const fenetreFin = Math.max(d.fenetreDebut, d.fenetreFin);
  return {
    titre: d.titre,
    frequence: d.frequence,
    fixe: d.fixe,
    fenetreDebut,
    fenetreFin,
    // Date fixe : jour imposé. Fenêtre : vide → replacé par l'étalement.
    jours: d.fixe && d.jourFixe ? [d.jourFixe] : [],
    jourSemaine: d.frequence === "HEBDO" ? (d.jourSemaine ?? 1) : null,
    dureeMin: d.dureeMin,
    datePonctuelle:
      d.frequence === "PONCTUELLE" && d.datePonctuelle ? toDate(d.datePonctuelle) : null,
  };
}

export async function updateRegle(id: string, input: unknown): Promise<Result> {
  const p = RegleInput.safeParse(input);
  if (!p.success) return { ok: false, error: "Formulaire invalide." };
  const r = await prisma.planningRegle.findUnique({
    where: { id },
    select: { ligne: { select: { ownerId: true } } },
  });
  if (!r || !(await canAccess(r.ligne.ownerId))) return { ok: false, error: "Accès refusé." };
  // Les tâches futures non commencées sont recalculées selon la nouvelle règle
  // (celles déjà faites / en cours restent).
  await deleteFutureGenerated([id]);
  await prisma.planningRegle.update({
    where: { id },
    data: { ...regleData(p.data), dateDebut: todayZurich() },
  });
  if (!p.data.actif) await setRegleActif(id, false);
  else await prisma.planningRegle.update({ where: { id }, data: { actif: true } });
  await refresh(r.ligne.ownerId);
  done();
  return { ok: true };
}

export async function createRegle(ligneId: string, input: unknown): Promise<Result> {
  const p = RegleInput.safeParse(input);
  if (!p.success) return { ok: false, error: "Formulaire invalide." };
  const l = await prisma.planningLigne.findUnique({ where: { id: ligneId }, select: { ownerId: true } });
  if (!l || !(await canAccess(l.ownerId))) return { ok: false, error: "Accès refusé." };
  await prisma.planningRegle.create({
    data: { ligneId, code: "CUSTOM", ...regleData(p.data), actif: true, dateDebut: todayZurich() },
  });
  await refresh(l.ownerId);
  done();
  return { ok: true };
}

export async function deleteRegle(id: string): Promise<Result> {
  const r = await prisma.planningRegle.findUnique({
    where: { id },
    select: { code: true, ligne: { select: { ownerId: true } } },
  });
  if (!r || !(await canAccess(r.ligne.ownerId))) return { ok: false, error: "Accès refusé." };
  await deleteFutureGenerated([id]);
  if (r.code === "CUSTOM") {
    await prisma.planningRegle.delete({ where: { id } });
  } else {
    // Règle de base : désactivée (réactivable), jamais supprimée.
    await setRegleActif(id, false);
  }
  done();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lignes (services d'un client)
// ---------------------------------------------------------------------------

const AddLigne = z.object({
  ownerId: z.string().min(1),
  prospectId: z.string().min(1),
  service: z.string().min(1),
  libelle: z.string().trim().max(100).nullable().optional(),
});

export async function addLigne(input: unknown): Promise<Result> {
  const p = AddLigne.safeParse(input);
  if (!p.success) return { ok: false, error: "Formulaire invalide." };
  if (!(p.data.service in SERVICES)) return { ok: false, error: "Service inconnu." };
  if (!(await canAccess(p.data.ownerId))) return { ok: false, error: "Accès refusé." };
  await createLigne(p.data.ownerId, p.data.prospectId, p.data.service as ServiceCode, {
    auto: false,
    libelle: p.data.libelle ?? null,
  });
  await applyDedupe(p.data.ownerId, p.data.prospectId);
  await refresh(p.data.ownerId);
  done();
  return { ok: true };
}

export async function retirerLigne(ligneId: string): Promise<Result> {
  const l = await prisma.planningLigne.findUnique({
    where: { id: ligneId },
    select: { ownerId: true, prospectId: true },
  });
  if (!l || !(await canAccess(l.ownerId))) return { ok: false, error: "Accès refusé." };
  // Masquée (et plus resynchronisée tant que le contrat ne repasse pas actif).
  await prisma.planningLigne.update({ where: { id: ligneId }, data: { auto: false } });
  await setLigneActif(ligneId, false);
  await applyDedupe(l.ownerId, l.prospectId);
  await refresh(l.ownerId);
  done();
  return { ok: true };
}

/** ADS : ACLR avance-t-il les frais pub ? (sinon pas de tâche de refacturation) */
export async function setFraisPubAvances(ligneId: string, value: boolean): Promise<Result> {
  const l = await prisma.planningLigne.findUnique({
    where: { id: ligneId },
    select: { ownerId: true, prospectId: true },
  });
  if (!l || !(await canAccess(l.ownerId))) return { ok: false, error: "Accès refusé." };
  await prisma.planningLigne.update({ where: { id: ligneId }, data: { fraisPubAvances: value } });
  await applyDedupe(l.ownerId, l.prospectId);
  await refresh(l.ownerId);
  done();
  return { ok: true };
}

/**
 * Recalcule l'étalement : les tâches futures non commencées (hors dates
 * imposées) sont replacées pour lisser la charge.
 */
export async function reequilibrer(ownerId: string): Promise<Result & { deplacees?: number }> {
  if (!(await canAccess(ownerId))) return { ok: false, error: "Accès refusé." };
  const regles = await prisma.planningRegle.findMany({
    where: { actif: true, fixe: false, ligne: { ownerId, actif: true } },
    select: { id: true },
  });
  const today = todayZurich();
  const res = await prisma.planningTache.deleteMany({
    where: {
      regleId: { in: regles.map((r) => r.id) },
      statut: "A_FAIRE",
      faitLe: null,
      date: { gte: today },
    },
  });
  await placeRules(ownerId, { rebalance: true });
  const start = addMonths(today, 0);
  await generateTasks(ownerId, start, addMonths(start, 12));
  done();
  return { ok: true, deplacees: res.count };
}
