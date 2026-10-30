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
    // On ne compte QUE les commissions sur contrats réellement signés : un
    // contrat en attente de signature (proposition) n'a pas encore généré de
    // commission « à venir », sinon les totaux étaient massivement gonflés.
    where: {
      commission: {
        ...(userFilter ? { userId: userFilter } : {}),
        // Collaborateurs ACTIFS uniquement (Arthur reprend le portefeuille des
        // partants, donc l'admin est bien commissionné ; les ex-collaborateurs
        // comme Sophie/Lou-Anne, désactivés, ne paraissent plus).
        user: { isActive: true },
        contract: {
          statut: {
            notIn: ["ATTENTE_SIGNATURE_CLIENT", "ATTENTE_VALIDATION_ADMIN"],
          },
        },
      },
    },
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
    if (p.statut === "ANNULE") {
      annule += montant;
      continue;
    }
    // « À verser ce mois » = fiche de paye du mois : TOUT versement (signature
    // 25 %, étalement du 50 %, renouvellement 10 %) dont la date prévue tombe
    // dans le mois courant, qu'il soit déjà payé ou encore prévu. C'est le vrai
    // montant dû à la personne pour le mois (cohérent avec le calendrier).
    if (p.dateVersementPrevue >= startMonth && p.dateVersementPrevue <= endMonth) {
      acquisMoisCourant += montant;
    }
    if (p.statut === "PAYE") {
      const ref = p.dateVersement ?? p.dateVersementPrevue;
      if (ref >= startYear) acquisYTD += montant;
    } else if (p.statut === "PREVU") {
      // « À venir » = versements prévus des mois SUIVANTS (hors mois courant,
      // déjà compté dans « à verser ce mois »).
      if (p.dateVersementPrevue > endMonth) aVenirTotal += montant;
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
// FRISE DES COMMISSIONS (historique + calendrier des versements)
// ---------------------------------------------------------------------------

const zurichDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const shortMonthFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: "UTC", month: "short" });
const longMonthFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/** Clé « AAAA-MM » du mois (vu de Suisse) contenant l'instant `d`. */
export function zurichMonthKey(d: Date): string {
  return zurichDayFmt.format(d).slice(0, 7);
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Clé « AAAA-MM » → « Octobre 2026 » (chaîne vide si absente ou invalide). */
export function formatMonthKey(key: string | null | undefined): string {
  const m = key ? /^(\d{4})-(\d{2})$/.exec(key) : null;
  if (!m) return "";
  return capitalizeFirst(longMonthFmt.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))));
}

export interface TimelineMonth {
  /** « AAAA-MM » */
  key: string;
  /** « Oct. » */
  label: string;
  /** « 26 » */
  year2: string;
  /** « Octobre 2026 » */
  full: string;
  /** Part versée à la signature (SIGNATURE). */
  signature: number;
  /** Part récurrente (ETALEMENT + RENOUVELLEMENT). */
  recurrent: number;
  /** Déjà acquis (PAYE). */
  acquis: number;
  /** Encore prévu (PREVU). */
  aVenir: number;
  /** Contrats signés ce mois-là (null si non calculé ou mois futur). */
  contrats: number | null;
  isCurrent: boolean;
  isFuture: boolean;
}

type TimelinePayment = Pick<
  CommissionPaymentDetail,
  "montant" | "statut" | "typePart" | "dateVersement" | "dateVersementPrevue"
>;

/**
 * Frise mois par mois : `pastMonths` mois passés (les mois vides en tête sont
 * retirés), le mois en cours, puis `futureMonths` mois à venir. Les versements
 * annulés sont exclus. Date de référence = date de versement réelle, sinon
 * date prévue (même règle que le calendrier du cockpit).
 */
export function buildCommissionTimeline(
  payments: TimelinePayment[],
  opts: {
    pastMonths: number;
    futureMonths: number;
    /** Contrats signés par mois (« AAAA-MM » → nombre). */
    signedByMonth?: Map<string, number>;
    now?: Date;
  },
): TimelineMonth[] {
  const now = opts.now ?? new Date();
  const [cy, cm] = zurichMonthKey(now).split("-").map(Number) as [number, number];

  const months: TimelineMonth[] = [];
  const index = new Map<string, TimelineMonth>();
  for (let i = -opts.pastMonths; i <= opts.futureMonths; i++) {
    const first = new Date(Date.UTC(cy, cm - 1 + i, 1));
    const key = `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}`;
    const m: TimelineMonth = {
      key,
      label: capitalizeFirst(shortMonthFmt.format(first)),
      year2: String(first.getUTCFullYear()).slice(2),
      full: capitalizeFirst(longMonthFmt.format(first)),
      signature: 0,
      recurrent: 0,
      acquis: 0,
      aVenir: 0,
      contrats: i <= 0 ? (opts.signedByMonth?.get(key) ?? (opts.signedByMonth ? 0 : null)) : null,
      isCurrent: i === 0,
      isFuture: i > 0,
    };
    months.push(m);
    index.set(key, m);
  }

  for (const p of payments) {
    if (p.statut === "ANNULE") continue;
    const ref = p.dateVersement ?? p.dateVersementPrevue;
    const m = index.get(zurichMonthKey(ref));
    if (!m) continue;
    const montant = Number(p.montant);
    if (p.typePart === "SIGNATURE") m.signature += montant;
    else m.recurrent += montant;
    if (p.statut === "PAYE") m.acquis += montant;
    else m.aVenir += montant;
  }

  // Retire les mois passés vides en tête (avant la toute première commission).
  let firstUseful = months.findIndex(
    (m) => m.isCurrent || m.isFuture || m.signature + m.recurrent > 0 || (m.contrats ?? 0) > 0,
  );
  if (firstUseful < 0) firstUseful = 0;
  return months.slice(firstUseful);
}

// ---------------------------------------------------------------------------
// VUE AGRÉGÉE PAR COMMERCIALE (admin seulement)
// ---------------------------------------------------------------------------

export async function getCommissionsByUser() {
  const grouped = await prisma.commissionPayment.groupBy({
    by: ["commissionId", "statut"],
    // Idem cockpit : uniquement les commissions sur contrats réellement signés
    // (on exclut les propositions en attente de signature).
    where: {
      commission: {
        user: { isActive: true },
        contract: {
          statut: {
            notIn: ["ATTENTE_SIGNATURE_CLIENT", "ATTENTE_VALIDATION_ADMIN"],
          },
        },
      },
    },
    _sum: { montant: true },
  });

  // Somme des paiements par commission et par statut.
  const sumByCommission = new Map<
    string,
    { acquis: number; aVenir: number; annule: number }
  >();
  for (const g of grouped) {
    const cur = sumByCommission.get(g.commissionId) ?? {
      acquis: 0,
      aVenir: 0,
      annule: 0,
    };
    const m = Number(g._sum.montant ?? 0);
    if (g.statut === "PAYE") cur.acquis += m;
    else if (g.statut === "PREVU") cur.aVenir += m;
    else if (g.statut === "ANNULE") cur.annule += m;
    sumByCommission.set(g.commissionId, cur);
  }

  // Commissions sur contrats signés (même filtre que l'agrégat ci-dessus) +
  // contexte contrat/client pour le détail dépliable.
  const commissions = await prisma.commission.findMany({
    where: {
      user: { isActive: true },
      contract: {
        statut: {
          notIn: ["ATTENTE_SIGNATURE_CLIENT", "ATTENTE_VALIDATION_ADMIN"],
        },
      },
    },
    select: {
      id: true,
      userId: true,
      user: { select: { id: true, name: true } },
      contract: {
        select: {
          id: true,
          numero: true,
          prospect: { select: { raisonSociale: true } },
        },
      },
    },
  });

  interface Detail {
    commissionId: string;
    contractId: string;
    contractNumero: string;
    clientName: string;
    acquis: number;
    aVenir: number;
    annule: number;
  }
  const map = new Map<
    string,
    {
      userId: string;
      userName: string;
      acquis: number;
      aVenir: number;
      annule: number;
      details: Detail[];
    }
  >();

  for (const c of commissions) {
    const s = sumByCommission.get(c.id) ?? { acquis: 0, aVenir: 0, annule: 0 };
    const cur = map.get(c.userId) ?? {
      userId: c.userId,
      userName: c.user.name,
      acquis: 0,
      aVenir: 0,
      annule: 0,
      details: [] as Detail[],
    };
    cur.acquis += s.acquis;
    cur.aVenir += s.aVenir;
    cur.annule += s.annule;
    cur.details.push({
      commissionId: c.id,
      contractId: c.contract.id,
      contractNumero: c.contract.numero,
      clientName: c.contract.prospect.raisonSociale,
      acquis: s.acquis,
      aVenir: s.aVenir,
      annule: s.annule,
    });
    map.set(c.userId, cur);
  }

  const rows = Array.from(map.values());
  for (const r of rows) {
    r.details.sort((a, b) => b.acquis + b.aVenir - (a.acquis + a.aVenir));
  }
  return rows.sort((a, b) => a.userName.localeCompare(b.userName));
}
