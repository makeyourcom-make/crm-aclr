import { prisma } from "@/lib/db";
import { DOSSIER_STATUTS } from "@/lib/dossiers";

import type { DossierStatut, DossierPriorite, Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/session";

export interface DossierForKanban {
  id: string;
  titre: string;
  statut: DossierStatut;
  priorite: DossierPriorite;
  echeance: Date | null;
  updatedAt: Date;
  assigneA: { id: string; name: string };
  prospect: { id: string; raisonSociale: string } | null;
  nbUpdates: number;
}

export interface DossierColumn {
  statut: DossierStatut;
  dossiers: DossierForKanban[];
}

export interface DossiersBoardData {
  columns: DossierColumn[];
  total: number;
}

/**
 * Charge le kanban des dossiers. RLS : l'admin voit tout ; un commercial voit
 * les dossiers qui lui sont assignés OU qu'il a créés.
 *
 * `assigneAId` (optionnel) : filtre admin sur un collaborateur précis.
 */
export async function getDossiersBoard(
  user: SessionUser,
  assigneAId?: string,
): Promise<DossiersBoardData> {
  const where: Prisma.DossierWhereInput = {};

  if (user.role !== "ADMIN") {
    where.OR = [{ assigneAId: user.id }, { creeParId: user.id }];
  } else if (assigneAId) {
    where.assigneAId = assigneAId;
  }

  const dossiers = await prisma.dossier.findMany({
    where,
    select: {
      id: true,
      titre: true,
      statut: true,
      priorite: true,
      echeance: true,
      updatedAt: true,
      assigneA: { select: { id: true, name: true } },
      prospect: { select: { id: true, raisonSociale: true } },
      _count: { select: { updates: true } },
    },
    orderBy: [{ priorite: "desc" }, { updatedAt: "desc" }],
  });

  const byStatut = new Map<DossierStatut, DossierForKanban[]>();
  for (const s of DOSSIER_STATUTS) byStatut.set(s, []);
  for (const d of dossiers) {
    byStatut.get(d.statut)?.push({
      id: d.id,
      titre: d.titre,
      statut: d.statut,
      priorite: d.priorite,
      echeance: d.echeance,
      updatedAt: d.updatedAt,
      assigneA: d.assigneA,
      prospect: d.prospect,
      nbUpdates: d._count.updates,
    });
  }

  return {
    columns: DOSSIER_STATUTS.map((statut) => ({
      statut,
      dossiers: byStatut.get(statut) ?? [],
    })),
    total: dossiers.length,
  };
}

/**
 * Détail complet d'un dossier (pour le panneau latéral). Renvoie null si absent
 * ou hors périmètre RLS (commercial ≠ assigné/créateur).
 */
export async function getDossierById(user: SessionUser, id: string) {
  const d = await prisma.dossier.findUnique({
    where: { id },
    select: {
      id: true,
      titre: true,
      description: true,
      statut: true,
      priorite: true,
      echeance: true,
      createdAt: true,
      termineLe: true,
      assigneAId: true,
      creeParId: true,
      assigneA: { select: { id: true, name: true } },
      creePar: { select: { id: true, name: true } },
      prospect: { select: { id: true, raisonSociale: true } },
      updates: {
        select: {
          id: true,
          contenu: true,
          createdAt: true,
          auteur: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!d) return null;
  if (
    user.role !== "ADMIN" &&
    d.assigneAId !== user.id &&
    d.creeParId !== user.id
  ) {
    return null;
  }
  return d;
}

