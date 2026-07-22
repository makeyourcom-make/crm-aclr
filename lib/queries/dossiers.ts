import { prisma } from "@/lib/db";
import {
  DOSSIER_STATUTS_PAR_PERSONNE,
  dossierColumnKey,
} from "@/lib/dossiers";

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
  /** Identifiant droppable — voir `dossierColumnKey`. */
  key: string;
  statut: DossierStatut;
  /** Collaborateur de la colonne ; null pour « Terminé » (colonne commune). */
  assigneAId: string | null;
  /** Prénom affiché en tête de colonne ("Arthur"). Vide pour « Terminé ». */
  assigneNom: string;
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
 * Les colonnes sont éclatées PAR COLLABORATEUR (« Arthur - à faire »,
 * « Sophie - en cours »…) puis une colonne « Terminé » commune. Un commercial
 * ne voit que ses propres colonnes : afficher celles des autres n'aurait aucun
 * sens puisque la RLS en masque déjà les cartes.
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

  // Collaborateurs dont on affiche les colonnes. L'admin d'abord (Arthur), puis
  // les commerciales par ordre alphabétique — c'est l'ordre demandé.
  const collaborateurs = await prisma.user.findMany({
    where:
      user.role === "ADMIN"
        ? { isActive: true, ...(assigneAId ? { id: assigneAId } : {}) }
        : { id: user.id },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

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

  // Colonnes : (chaque collaborateur × ses statuts) puis « Terminé ».
  //
  // L'ADMIN n'a PAS de colonne « En cours » (demande Arthur, 22.07.2026) : il
  // pilote et attribue, l'exécution se suit chez les commerciales. Un projet
  // qui serait malgré tout passé en EN_COURS sur son nom retombe dans son
  // « À faire » via le repli plus bas — aucune carte ne disparaît.
  const columns: DossierColumn[] = [];
  for (const c of collaborateurs) {
    const statuts =
      c.role === "ADMIN"
        ? (["A_FAIRE"] as typeof DOSSIER_STATUTS_PAR_PERSONNE)
        : DOSSIER_STATUTS_PAR_PERSONNE;
    for (const statut of statuts) {
      columns.push({
        key: dossierColumnKey(statut, c.id),
        statut,
        assigneAId: c.id,
        // Prénom seul : les en-têtes de colonne sont étroits.
        assigneNom: c.name.split(" ")[0]!,
        dossiers: [],
      });
    }
  }
  columns.push({
    key: dossierColumnKey("TERMINE", null),
    statut: "TERMINE",
    assigneAId: null,
    assigneNom: "",
    dossiers: [],
  });

  const byKey = new Map(columns.map((c) => [c.key, c]));
  for (const d of dossiers) {
    const card: DossierForKanban = {
      id: d.id,
      titre: d.titre,
      statut: d.statut,
      priorite: d.priorite,
      echeance: d.echeance,
      updatedAt: d.updatedAt,
      assigneA: d.assigneA,
      prospect: d.prospect,
      nbUpdates: d._count.updates,
    };
    // « Terminé » est commun ; les autres statuts vont dans la colonne du
    // collaborateur. Une carte dont la colonne n'existe pas (assignée à un
    // collaborateur désactivé, ou statut EN_ATTENTE résiduel) est rattachée au
    // « à faire » de son assigné pour ne JAMAIS disparaître de l'écran.
    const key =
      d.statut === "TERMINE"
        ? dossierColumnKey("TERMINE", null)
        : dossierColumnKey(d.statut, d.assigneA.id);
    (byKey.get(key) ?? byKey.get(dossierColumnKey("A_FAIRE", d.assigneA.id)))
      ?.dossiers.push(card);
  }

  return { columns, total: dossiers.length };
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
      attachments: {
        select: {
          id: true,
          nom: true,
          taille: true,
          mimeType: true,
          url: true,
          createdAt: true,
          ajoutePar: { select: { name: true } },
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

