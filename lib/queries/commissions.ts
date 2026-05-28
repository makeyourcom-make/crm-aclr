/**
 * Requêtes de lecture pour le module Commissions (étape 13).
 *
 * Centrées sur la visualisation pour la commerciale (sa propre vue) ou
 * l'admin (vue équipe). Le moteur de calcul vit dans lib/commissions-engine.ts.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { type SessionUser } from "@/lib/session";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type CommissionPaymentDetail = Prisma.CommissionPaymentGetPayload<{
  include: {
    commission: {
      include: {
        contract: {
          select: {
            id: true;
            numero: true;
            prospect: { select: { id: true; raisonSociale: true } };
          };
        };
        user: { select: { id: true; name: true } };
      };
    };
  };
}>;

export interface CommissionsCockpit {
  /** Tous les versements (PREVU + PAYE + ANNULE) liés à l'utilisateur (ou tous si admin) */
  payments: CommissionPaymentDetail[];

  /** Acquis depuis le 1er janvier de l'année courante */
  acquisYTD: number;
  /** Acquis ce mois (sera dans la prochaine facture mensuelle) */
  acquisMoisCourant: number;
  /** Total à venir : statut PREVU, date prévue future */
  aVenirTotal: number;
  /** Total annulé suite à résiliations */
  annule: number;

  /** Calendrier mois par mois sur 13 mois (mois courant + 12 à venir) */
  parMois: Array<{
    mois: Date;
    label: string;
    acquis: number;
    aVenir: number;
  }>;
}

// ---------------------------------------------------------------------------
// MAIN QUERY
// ---------------------------------------------------------------------------

export async function getCommissionsCockpit(
  user: SessionUser,
  /** Si admin, peut filtrer sur un utilisateur précis */
  filterUserId?: string,
): Promise<CommissionsCockpit> {
  // Scope
  const userFilter =
    filterUserId ?? (user.role === "ADMIN" ? undefined : user.id);

  const payments = await prisma.commissionPayment.findMany({
    where: userFilter
      ? {
          commission: { userId: userFilter },
        }
      : {},
    include: {
      commission: {
        include: {
          contract: {
            select: {
              id: true,
              numero: true,
              prospect: { select: { id: true, raisonSociale: true } },
            },
          },
          user: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ dateVersementPrevue: "asc" }],
  });

  // ---- Agrégats ----
  const now = new Date();
  const startYear = new Date(now.getFullYear(), 0, 1);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
  );

  let acquisYTD = 0;
  let acquisMoisCourant = 0;
  let aVenirTotal = 0;
  let annule = 0;

  for (const p of payments) {
    const montant = Number(p.montant);
    if (p.statut === "PAYE") {
      const ref = p.dateVersement ?? p.dateVersementPrevue;
      if (ref >= startYear) acquisYTD += montant;
      if (ref >= startMonth && ref <= endMonth) acquisMoisCourant += montant;
    } else if (p.statut === "PREVU") {
      if (p.dateVersementPrevue >= now) aVenirTotal += montant;
    } else if (p.statut === "ANNULE") {
      annule += montant;
    }
  }

  // ---- Calendrier 13 mois (courant + 12 à venir) ----
  const parMois: CommissionsCockpit["parMois"] = [];
  for (let i = 0; i < 13; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + i + 1, 0, 23, 59, 59);
    let acquis = 0;
    let aVenir = 0;
    for (const p of payments) {
      const ref = p.dateVersement ?? p.dateVersementPrevue;
      if (ref >= start && ref <= end) {
        if (p.statut === "PAYE") acquis += Number(p.montant);
        else if (p.statut === "PREVU") aVenir += Number(p.montant);
      }
    }
    parMois.push({
      mois: start,
      label: start
        .toLocaleDateString("fr-CH", { month: "short", year: "2-digit" })
        .replace(".", ""),
      acquis,
      aVenir,
    });
  }

  return {
    payments,
    acquisYTD,
    acquisMoisCourant,
    aVenirTotal,
    annule,
    parMois,
  };
}

// ---------------------------------------------------------------------------
// VUE AGRÉGÉE PAR COMMERCIALE (admin seulement)
// ---------------------------------------------------------------------------

export async function getCommissionsByUser() {
  const grouped = await prisma.commissionPayment.groupBy({
    by: ["commissionId", "statut"],
    _sum: { montant: true },
  });

  const commissions = await prisma.commission.findMany({
    select: { id: true, userId: true, user: { select: { id: true, name: true } } },
  });

  const map = new Map<
    string,
    { userId: string; userName: string; acquis: number; aVenir: number; annule: number }
  >();

  for (const c of commissions) {
    const cur = map.get(c.userId) ?? {
      userId: c.userId,
      userName: c.user.name,
      acquis: 0,
      aVenir: 0,
      annule: 0,
    };
    for (const g of grouped) {
      if (g.commissionId === c.id) {
        const m = Number(g._sum.montant ?? 0);
        if (g.statut === "PAYE") cur.acquis += m;
        else if (g.statut === "PREVU") cur.aVenir += m;
        else if (g.statut === "ANNULE") cur.annule += m;
      }
    }
    map.set(c.userId, cur);
  }

  return Array.from(map.values()).sort((a, b) =>
    a.userName.localeCompare(b.userName),
  );
}
