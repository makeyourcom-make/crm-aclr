/**
 * Requêtes de lecture pour le module Contrats.
 */
import { Prisma, type ContractStatut } from "@prisma/client";

import { getNextRenewalDate } from "@/lib/contract-renewal";
import { prisma } from "@/lib/db";
import type { ContractListParams } from "@/lib/schemas/contract";
import { type SessionUser } from "@/lib/session";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type ContractListItem = Prisma.ContractGetPayload<{
  include: {
    prospect: { select: { id: true; raisonSociale: true; ville: true } };
    assigneA: { select: { id: true; name: true; role: true } };
    products: { select: { nom: true } };
  };
}>;

export type ContractDetail = Prisma.ContractGetPayload<{
  include: {
    prospect: {
      select: {
        id: true;
        raisonSociale: true;
        contactPrenom: true;
        contactNom: true;
        email: true;
        telephone: true;
        adresse: true;
        codePostal: true;
        ville: true;
        canton: true;
      };
    };
    assigneA: { select: { id: true; name: true } };
    deal: { select: { id: true; titre: true } };
    products: {
      select: { id: true; nom: true; prixOneShot: true; prixMensuel: true };
    };
    payments: { orderBy: { date: "asc" } };
    commissions: {
      include: {
        payments: { orderBy: { dateVersementPrevue: "asc" } };
      };
    };
    clientInvoices: { orderBy: { dateEmission: "asc" } };
    signatures: { orderBy: { createdAt: "desc" } };
  };
}>;

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

export interface ContractListResult {
  items: ContractListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getContracts(
  user: SessionUser,
  params: ContractListParams,
): Promise<ContractListResult> {
  const where = buildWhere(user, params);

  // Mapping sortBy → orderBy Prisma. "raisonSociale" est sur Prospect,
  // donc on utilise la syntaxe imbriquée { prospect: { raisonSociale: dir } }.
  const orderBy: Prisma.ContractOrderByWithRelationInput = (() => {
    switch (params.sortBy) {
      case "raisonSociale":
        return { prospect: { raisonSociale: params.sortDir } };
      case "numero":
        return { numero: params.sortDir };
      case "valeurAn1":
        return { valeurAn1: params.sortDir };
      case "montantMensuel":
        return { montantMensuel: params.sortDir };
      case "statut":
        return { statut: params.sortDir };
      case "dateSignature":
      default:
        return { dateSignature: params.sortDir };
    }
  })();

  const [items, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: {
        prospect: {
          select: { id: true, raisonSociale: true, ville: true },
        },
        assigneA: { select: { id: true, name: true, role: true } },
        products: { select: { nom: true } },
      },
      orderBy,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.contract.count({ where }),
  ]);

  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function getContractStats(user: SessionUser) {
  const scopeWhere = user.role === "ADMIN" ? {} : { assigneAId: user.id };
  const [total, parStatut] = await Promise.all([
    prisma.contract.count({ where: scopeWhere }),
    prisma.contract.groupBy({
      by: ["statut"],
      where: scopeWhere,
      _count: true,
      _sum: { valeurAn1: true, montantMensuel: true },
    }),
  ]);
  const byStatut = Object.fromEntries(
    parStatut.map((s) => [s.statut, s._count]),
  );
  const valeurAn1Active = parStatut
    .filter((s) => s.statut === "ACTIF")
    .reduce((sum, s) => sum + Number(s._sum.valeurAn1 ?? 0), 0);
  const mensuelActif = parStatut
    .filter((s) => s.statut === "ACTIF")
    .reduce((sum, s) => sum + Number(s._sum.montantMensuel ?? 0), 0);
  return { total, byStatut, valeurAn1Active, mensuelActif };
}

// ---------------------------------------------------------------------------
// DETAIL
// ---------------------------------------------------------------------------

export async function getContractById(
  user: SessionUser,
  id: string,
): Promise<ContractDetail | null> {
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      prospect: {
        select: {
          id: true,
          raisonSociale: true,
          contactPrenom: true,
          contactNom: true,
          email: true,
          telephone: true,
          adresse: true,
          codePostal: true,
          ville: true,
          canton: true,
        },
      },
      assigneA: { select: { id: true, name: true } },
      deal: { select: { id: true, titre: true } },
      products: {
        select: {
          id: true,
          nom: true,
          prixOneShot: true,
          prixMensuel: true,
        },
      },
      payments: { orderBy: { date: "asc" } },
      commissions: {
        include: {
          payments: { orderBy: { dateVersementPrevue: "asc" } },
        },
      },
      clientInvoices: { orderBy: { dateEmission: "asc" } },
      signatures: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!contract) return null;
  if (user.role !== "ADMIN" && contract.assigneAId !== user.id) {
    return null;
  }
  return contract;
}

// ---------------------------------------------------------------------------
// WHERE builder
// ---------------------------------------------------------------------------

function buildWhere(
  user: SessionUser,
  params: ContractListParams,
): Prisma.ContractWhereInput {
  const conditions: Prisma.ContractWhereInput[] = [];

  if (user.role !== "ADMIN") {
    conditions.push({ assigneAId: user.id });
  }

  // Par défaut, on cache les contrats encore EN ATTENTE de signature/validation
  // (qui apparaissent dans /pipeline ou dans le filtre statut explicite).
  // Le user choisit explicitement le statut pour les voir.
  if (params.statut) {
    conditions.push({ statut: params.statut });
  } else {
    conditions.push({
      statut: { in: ["ACTIF", "SUSPENDU", "RESILIE", "EXPIRE"] },
    });
  }
  if (params.assigneAId) conditions.push({ assigneAId: params.assigneAId });

  if (params.q) {
    conditions.push({
      OR: [
        { numero: { contains: params.q, mode: "insensitive" } },
        {
          prospect: {
            raisonSociale: { contains: params.q, mode: "insensitive" },
          },
        },
      ],
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

// ===========================================================================
// MYC ARENA : POULS FINANCE (héros Contrats / Factures / Signatures)
// ===========================================================================
//
// Lecture seule. Mêmes définitions que le reste du CRM :
//   - MRR = somme des mensualités des contrats ACTIF (cf. getContractStats)
//   - contrat signé = statut hors ATTENTE_SIGNATURE_CLIENT /
//     ATTENTE_VALIDATION_ADMIN, daté par dateSignature (cf. stats.ts)
//   - brouillon « à envoyer » = BROUILLON émis au plus tard aujourd'hui
//     (même horizon que /factures-clients et l'envoi groupé)
//   - facture en retard = EN_RETARD, ou ENVOYEE dont l'échéance est passée
//     (le cron nocturne bascule ces dernières en EN_RETARD)
// Les mois sont découpés en fuseau Europe/Zurich (dates stockées en UTC).

const ZURICH = "Europe/Zurich";

const zurichPartsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: ZURICH,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zurichParts(at: Date): Record<string, number> {
  const p: Record<string, number> = {};
  for (const part of zurichPartsFmt.formatToParts(at)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return p;
}

/** Décalage (ms) entre l'heure de Zurich et UTC à l'instant `at`. */
function zurichOffsetMs(at: Date): number {
  const p = zurichParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Instant UTC de minuit (heure de Zurich) du jour y / m0 (0-11) / d. */
function zurichMidnight(y: number, m0: number, d: number): Date {
  const guess = Date.UTC(y, m0, d);
  const first = guess - zurichOffsetMs(new Date(guess));
  return new Date(guess - zurichOffsetMs(new Date(first)));
}

/** Mois calendaire (Zurich) contenant `now`, décalé de `shift` mois. Fin exclusive. */
export function zurichMonthRange(
  now: Date = new Date(),
  shift = 0,
): { start: Date; end: Date; key: string } {
  const p = zurichParts(now);
  const m0 = p.month - 1 + shift;
  const start = zurichMidnight(p.year, m0, 1);
  const end = zurichMidnight(p.year, m0 + 1, 1);
  const ref = new Date(Date.UTC(p.year, m0, 1));
  const key = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, end, key };
}

/** Minuit (Zurich) du jour contenant `now`. */
export function zurichTodayStart(now: Date = new Date()): Date {
  const p = zurichParts(now);
  return zurichMidnight(p.year, p.month - 1, p.day);
}

/** Clé « AAAA-MM » (Zurich) d'un instant. */
export function zurichMonthKey(at: Date): string {
  const p = zurichParts(at);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/** Nom du mois en français (« octobre »), fuseau Zurich. */
export function zurichMonthLabel(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("fr-CH", { month: "long", timeZone: ZURICH }).format(at);
}

/** « mardi 27.10.2026 » (fuseau Zurich). */
export function zurichDayLabel(at: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat("fr-CH", {
    weekday: "long",
    timeZone: ZURICH,
  }).format(at);
  const p = zurichParts(at);
  return `${weekday} ${String(p.day).padStart(2, "0")}.${String(p.month).padStart(2, "0")}.${p.year}`;
}

const REAL_SIGNED: Prisma.EnumContractStatutFilter = {
  notIn: ["ATTENTE_SIGNATURE_CLIENT", "ATTENTE_VALIDATION_ADMIN"],
};

/** Statuts de contrat dont les factures (hors brouillon) sont affichées. */
const EXECUTED_STATUTS: ContractStatut[] = ["ACTIF", "SUSPENDU", "RESILIE", "EXPIRE"];

export interface InvoicePulse {
  draftsCount: number;
  draftsTotal: number;
  /** Factures réellement envoyées aujourd'hui (envoiClientLe). */
  sentToday: number;
  overdueCount: number;
  overdueTotal: number;
  /** Retard du plus ancien impayé échu, en jours. */
  overdueOldestDays: number;
  paidMonthTotal: number;
  paidMonthCount: number;
}

export interface FinancePulse {
  isAdmin: boolean;
  monthLabel: string;
  dayLabel: string;
  /** Mensualités des contrats ACTIF (périmètre de l'utilisateur). */
  mrr: number;
  activeCount: number;
  valeurAn1Active: number;
  /** Contrats réellement signés ce mois. */
  signedCount: number;
  signedValue: number;
  signedMensuel: number;
  /** Objectifs MENSUEL actifs (somme équipe pour l'admin), null si aucun. */
  signedTarget: number | null;
  caTarget: number | null;
  aValider: number;
  enAttenteSignature: number;
  /** Données factures clients : admin uniquement (page réservée). */
  invoices: InvoicePulse | null;
}

async function getInvoicePulse(now: Date): Promise<InvoicePulse> {
  // Même horizon que /factures-clients : fin de journée (heure serveur).
  const horizon = new Date(now);
  horizon.setHours(23, 59, 59, 999);
  const month = zurichMonthRange(now);
  const todayStart = zurichTodayStart(now);

  const [drafts, overdue, sentToday, paidMonth] = await Promise.all([
    prisma.clientInvoice.aggregate({
      where: { statut: "BROUILLON", dateEmission: { lte: horizon } },
      _count: true,
      _sum: { total: true },
    }),
    prisma.clientInvoice.findMany({
      where: {
        OR: [
          { statut: "EN_RETARD" },
          { statut: "ENVOYEE", dateEcheance: { lt: now } },
        ],
        contract: { statut: { in: EXECUTED_STATUTS } },
      },
      select: { total: true, dateEcheance: true },
    }),
    prisma.clientInvoice.count({
      where: { envoiClientLe: { gte: todayStart } },
    }),
    prisma.clientInvoice.aggregate({
      where: {
        statut: "PAYEE",
        datePaiement: { gte: month.start, lt: month.end },
      },
      _count: true,
      _sum: { total: true },
    }),
  ]);

  const oldest = overdue.reduce(
    (m, i) => Math.min(m, i.dateEcheance.getTime()),
    Number.POSITIVE_INFINITY,
  );

  return {
    draftsCount: drafts._count,
    draftsTotal: Number(drafts._sum.total ?? 0),
    sentToday,
    overdueCount: overdue.length,
    overdueTotal: overdue.reduce((s, i) => s + Number(i.total), 0),
    overdueOldestDays: Number.isFinite(oldest)
      ? Math.max(0, Math.floor((now.getTime() - oldest) / 86_400_000))
      : 0,
    paidMonthTotal: Number(paidMonth._sum.total ?? 0),
    paidMonthCount: paidMonth._count,
  };
}

/**
 * Pouls finance de l'utilisateur : MRR, signatures du mois vs objectif,
 * contrats en attente et (admin) caisse des factures clients.
 */
export async function getFinancePulse(user: SessionUser): Promise<FinancePulse> {
  const isAdmin = user.role === "ADMIN";
  const scope: Prisma.ContractWhereInput = isAdmin ? {} : { assigneAId: user.id };
  const now = new Date();
  const month = zurichMonthRange(now);

  const [active, signed, pending, objectives, invoices] = await Promise.all([
    prisma.contract.aggregate({
      where: { ...scope, statut: "ACTIF" },
      _count: true,
      _sum: { montantMensuel: true, valeurAn1: true },
    }),
    prisma.contract.aggregate({
      where: {
        ...scope,
        statut: REAL_SIGNED,
        dateSignature: { gte: month.start, lt: month.end },
      },
      _count: true,
      _sum: { valeurAn1: true, montantMensuel: true },
    }),
    prisma.contract.groupBy({
      by: ["statut"],
      where: {
        ...scope,
        statut: { in: ["ATTENTE_SIGNATURE_CLIENT", "ATTENTE_VALIDATION_ADMIN"] },
      },
      _count: true,
    }),
    prisma.objective.findMany({
      where: {
        periode: "MENSUEL",
        isActif: true,
        dateDebut: { lte: month.end },
        dateFin: { gte: month.start },
        ...(isAdmin ? { user: { isActive: true } } : { userId: user.id }),
      },
      select: {
        userId: true,
        nbSignaturesObjectif: true,
        caObjectif: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    isAdmin ? getInvoicePulse(now) : Promise.resolve(null),
  ]);

  // Un objectif par utilisateur (le plus récent), sommés pour l'équipe.
  const seen = new Set<string>();
  let signedTarget: number | null = null;
  let caTarget: number | null = null;
  for (const o of objectives) {
    if (seen.has(o.userId)) continue;
    seen.add(o.userId);
    if (o.nbSignaturesObjectif != null) {
      signedTarget = (signedTarget ?? 0) + o.nbSignaturesObjectif;
    }
    if (o.caObjectif != null) caTarget = (caTarget ?? 0) + Number(o.caObjectif);
  }

  const pendingBy: Partial<Record<ContractStatut, number>> = {};
  for (const p of pending) pendingBy[p.statut] = p._count;

  return {
    isAdmin,
    monthLabel: zurichMonthLabel(now),
    dayLabel: zurichDayLabel(now),
    mrr: Number(active._sum.montantMensuel ?? 0),
    activeCount: active._count,
    valeurAn1Active: Number(active._sum.valeurAn1 ?? 0),
    signedCount: signed._count,
    signedValue: Number(signed._sum.valeurAn1 ?? 0),
    signedMensuel: Number(signed._sum.montantMensuel ?? 0),
    signedTarget,
    caTarget,
    aValider: pendingBy.ATTENTE_VALIDATION_ADMIN ?? 0,
    enAttenteSignature: pendingBy.ATTENTE_SIGNATURE_CLIENT ?? 0,
    invoices,
  };
}

// ---------------------------------------------------------------------------
// FILE « À TRAITER » (signatures, validations, renouvellements)
// ---------------------------------------------------------------------------

export interface QueueSignature {
  id: string;
  statut: string;
  lienSignature: string;
  signeParClient: boolean;
  signeParAclr: boolean;
  dateSignatureClient: Date | null;
  dateSignatureAclr: Date | null;
  nomAclr: string | null;
  expireA: Date;
  createdAt: Date;
  documentSigneUrl: string | null;
}

export interface QueueContract {
  id: string;
  numero: string;
  statut: "ATTENTE_SIGNATURE_CLIENT" | "ATTENTE_VALIDATION_ADMIN";
  raisonSociale: string;
  valeurAn1: number;
  montantMensuel: number;
  devise: string;
  createdAt: Date;
  assigneAId: string;
  assigneName: string;
  lastSignature: QueueSignature | null;
}

export interface QueueRenewal {
  id: string;
  numero: string;
  raisonSociale: string;
  renewal: Date;
  days: number;
  valeurAn1: number;
  montantMensuel: number;
}

export interface ContractWorkQueue {
  pending: QueueContract[];
  renewals: QueueRenewal[];
}

/** Contrats en attente (signature / validation) + renouvellements ≤ 30 jours. */
export async function getContractWorkQueue(
  user: SessionUser,
): Promise<ContractWorkQueue> {
  const scope: Prisma.ContractWhereInput =
    user.role === "ADMIN" ? {} : { assigneAId: user.id };
  const now = new Date();

  const [pending, actifs] = await Promise.all([
    prisma.contract.findMany({
      where: {
        ...scope,
        statut: { in: ["ATTENTE_VALIDATION_ADMIN", "ATTENTE_SIGNATURE_CLIENT"] },
      },
      select: {
        id: true,
        numero: true,
        statut: true,
        valeurAn1: true,
        montantMensuel: true,
        devise: true,
        createdAt: true,
        assigneAId: true,
        assigneA: { select: { name: true } },
        prospect: { select: { raisonSociale: true } },
        signatures: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            statut: true,
            lienSignature: true,
            signeParClient: true,
            signeParAclr: true,
            dateSignatureClient: true,
            dateSignatureAclr: true,
            nomAclr: true,
            expireA: true,
            createdAt: true,
            documentSigneUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.contract.findMany({
      where: { ...scope, statut: "ACTIF", reconductible: true },
      select: {
        id: true,
        numero: true,
        statut: true,
        dateDebut: true,
        dureeMois: true,
        reconductible: true,
        valeurAn1: true,
        montantMensuel: true,
        prospect: { select: { raisonSociale: true } },
      },
    }),
  ]);

  const renewals: QueueRenewal[] = [];
  for (const c of actifs) {
    const r = getNextRenewalDate(
      {
        dateDebut: c.dateDebut,
        dureeMois: c.dureeMois,
        statut: c.statut,
        reconductible: c.reconductible,
      },
      now,
    );
    if (!r) continue;
    const days = Math.round((r.getTime() - now.getTime()) / 86_400_000);
    if (days > 30) continue;
    renewals.push({
      id: c.id,
      numero: c.numero,
      raisonSociale: c.prospect.raisonSociale,
      renewal: r,
      days,
      valeurAn1: Number(c.valeurAn1),
      montantMensuel: Number(c.montantMensuel),
    });
  }
  renewals.sort((a, b) => a.renewal.getTime() - b.renewal.getTime());

  return {
    pending: pending.map((c) => ({
      id: c.id,
      numero: c.numero,
      statut: c.statut as QueueContract["statut"],
      raisonSociale: c.prospect.raisonSociale,
      valeurAn1: Number(c.valeurAn1),
      montantMensuel: Number(c.montantMensuel),
      devise: c.devise,
      createdAt: c.createdAt,
      assigneAId: c.assigneAId,
      assigneName: c.assigneA.name,
      lastSignature: c.signatures[0] ?? null,
    })),
    renewals,
  };
}

// ---------------------------------------------------------------------------
// CLASSEMENT DU MOIS (admin) : signatures réelles par commerciale
// ---------------------------------------------------------------------------

export interface SignatureBoardEntry {
  userId: string;
  name: string;
  role: string;
  signed: number;
  valeurAn1: number;
  mensuel: number;
  target: number | null;
  rank: number;
}

export async function getMonthlySignatureBoard(): Promise<SignatureBoardEntry[]> {
  const month = zurichMonthRange(new Date());
  const [users, grouped, objectives] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
    }),
    prisma.contract.groupBy({
      by: ["assigneAId"],
      where: {
        statut: REAL_SIGNED,
        dateSignature: { gte: month.start, lt: month.end },
      },
      _count: true,
      _sum: { valeurAn1: true, montantMensuel: true },
    }),
    prisma.objective.findMany({
      where: {
        periode: "MENSUEL",
        isActif: true,
        dateDebut: { lte: month.end },
        dateFin: { gte: month.start },
      },
      select: { userId: true, nbSignaturesObjectif: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const byUser = new Map(grouped.map((g) => [g.assigneAId, g]));
  const targetByUser = new Map<string, number | null>();
  for (const o of objectives) {
    if (!targetByUser.has(o.userId)) targetByUser.set(o.userId, o.nbSignaturesObjectif);
  }

  return users
    .map((u) => {
      const g = byUser.get(u.id);
      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        signed: g?._count ?? 0,
        valeurAn1: Number(g?._sum.valeurAn1 ?? 0),
        mensuel: Number(g?._sum.montantMensuel ?? 0),
        target: targetByUser.get(u.id) ?? null,
        rank: 0,
      };
    })
    .filter((e) => e.signed > 0 || e.target != null)
    .sort((a, b) => b.valeurAn1 - a.valeurAn1 || b.signed - a.signed)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

// ---------------------------------------------------------------------------
// SIGNATURES (page /signatures)
// ---------------------------------------------------------------------------

export interface SignatureRow {
  id: string;
  statut: string;
  lienSignature: string;
  signeParClient: boolean;
  dateSignatureClient: Date | null;
  signeParAclr: boolean;
  dateSignatureAclr: Date | null;
  nomClient: string | null;
  nomAclr: string | null;
  ipClient: string | null;
  expireA: Date;
  createdAt: Date;
  documentSigneUrl: string | null;
  /** Tracé manuscrit présent (signature au doigt, QR ou lien). */
  drawnByClient: boolean;
  contract: {
    id: string;
    numero: string;
    statut: ContractStatut;
    assigneAId: string;
    assigneName: string;
    raisonSociale: string;
    valeurAn1: number;
    montantMensuel: number;
  };
}

export interface SignaturesOverview {
  rows: SignatureRow[];
  /** Signatures au doigt du client ce mois (QR / lien). */
  drawnThisMonth: number;
}

/** Signatures du périmètre (admin : toutes ; commerciale : ses contrats). */
export async function getSignaturesOverview(
  user: SessionUser,
): Promise<SignaturesOverview> {
  const scope: Prisma.SignatureWhereInput =
    user.role === "ADMIN" ? {} : { contract: { assigneAId: user.id } };
  const month = zurichMonthRange(new Date());

  const [rows, drawnThisMonth] = await Promise.all([
    prisma.signature.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 200,
      // Jamais les data URL des tracés (jusqu'à 200 ko chacun) dans une liste.
      select: {
        id: true,
        statut: true,
        lienSignature: true,
        signeParClient: true,
        dateSignatureClient: true,
        signeParAclr: true,
        dateSignatureAclr: true,
        nomClient: true,
        nomAclr: true,
        ipClient: true,
        expireA: true,
        createdAt: true,
        documentSigneUrl: true,
        contract: {
          select: {
            id: true,
            numero: true,
            statut: true,
            assigneAId: true,
            valeurAn1: true,
            montantMensuel: true,
            assigneA: { select: { name: true } },
            prospect: { select: { raisonSociale: true } },
          },
        },
      },
    }),
    prisma.signature.count({
      where: {
        ...scope,
        signatureClientDataUrl: { not: null },
        dateSignatureClient: { gte: month.start, lt: month.end },
      },
    }),
  ]);

  const ids = rows.map((r) => r.id);
  const drawn =
    ids.length > 0
      ? await prisma.signature.findMany({
          where: { id: { in: ids }, signatureClientDataUrl: { not: null } },
          select: { id: true },
        })
      : [];
  const drawnSet = new Set(drawn.map((d) => d.id));

  return {
    drawnThisMonth,
    rows: rows.map((r) => ({
      id: r.id,
      statut: r.statut,
      lienSignature: r.lienSignature,
      signeParClient: r.signeParClient,
      dateSignatureClient: r.dateSignatureClient,
      signeParAclr: r.signeParAclr,
      dateSignatureAclr: r.dateSignatureAclr,
      nomClient: r.nomClient,
      nomAclr: r.nomAclr,
      ipClient: r.ipClient,
      expireA: r.expireA,
      createdAt: r.createdAt,
      documentSigneUrl: r.documentSigneUrl,
      drawnByClient: drawnSet.has(r.id),
      contract: {
        id: r.contract.id,
        numero: r.contract.numero,
        statut: r.contract.statut,
        assigneAId: r.contract.assigneAId,
        assigneName: r.contract.assigneA.name,
        raisonSociale: r.contract.prospect.raisonSociale,
        valeurAn1: Number(r.contract.valeurAn1),
        montantMensuel: Number(r.contract.montantMensuel),
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// FACTURES CLIENTS : encaissements récents (sparkline, délai d'encaissement)
// ---------------------------------------------------------------------------

export interface CashTrend {
  /** 6 derniers mois (le plus ancien d'abord), mois courant inclus. */
  months: { key: string; label: string; total: number }[];
  /** Délai moyen envoi (ou émission) → paiement, 90 derniers jours. */
  avgDaysToCash: number | null;
  /** Part des factures payées en 10 jours ou moins (90 derniers jours). */
  fastShare: number | null;
  paidSample: number;
}

export async function getClientCashTrend(): Promise<CashTrend> {
  const now = new Date();
  const first = zurichMonthRange(now, -5);
  const since90 = new Date(now.getTime() - 90 * 86_400_000);
  const from = first.start < since90 ? first.start : since90;

  const paid = await prisma.clientInvoice.findMany({
    where: { statut: "PAYEE", datePaiement: { gte: from } },
    select: {
      total: true,
      datePaiement: true,
      dateEmission: true,
      envoiClientLe: true,
    },
  });

  const months: CashTrend["months"] = [];
  for (let s = -5; s <= 0; s++) {
    const r = zurichMonthRange(now, s);
    months.push({ key: r.key, label: zurichMonthLabel(r.start), total: 0 });
  }
  const idx = new Map(months.map((m, i) => [m.key, i]));

  let sumDays = 0;
  let n = 0;
  let fast = 0;
  for (const p of paid) {
    if (!p.datePaiement) continue;
    const i = idx.get(zurichMonthKey(p.datePaiement));
    if (i !== undefined) months[i].total += Number(p.total);
    if (p.datePaiement >= since90) {
      const ref = p.envoiClientLe ?? p.dateEmission;
      const days = Math.max(
        0,
        Math.round((p.datePaiement.getTime() - ref.getTime()) / 86_400_000),
      );
      sumDays += days;
      n++;
      if (days <= 10) fast++;
    }
  }

  return {
    months,
    avgDaysToCash: n > 0 ? Math.round(sumDays / n) : null,
    fastShare: n > 0 ? fast / n : null,
    paidSample: n,
  };
}
