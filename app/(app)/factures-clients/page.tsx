import {
  Banknote,
  CircleCheck,
  Clock,
  FileStack,
  Hourglass,
  LayoutList,
  Repeat,
  Rows3,
  Send,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import { formatInt } from "@/components/arena/format";
import { ProgressRing } from "@/components/arena/progress-ring";
import { SectionCard } from "@/components/arena/section-card";
import { EmptyState } from "@/components/arena/empty-state";
import { RoleFinanceHero } from "@/components/contrats/finance-hero-presets";
import { FinanceTabs } from "@/components/contrats/finance-tabs";
import { ClientInvoiceFilters } from "@/components/factures-clients/client-invoice-filters";
import {
  InvoiceRow,
  InvoiceTableHeader,
  OverdueCard,
  type InvoiceRowData,
} from "@/components/factures-clients/invoice-rows";
import { SendAllDraftsButton } from "@/components/factures-clients/send-all-drafts-button";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { formatCHF } from "@/lib/format";
import { getClientCashTrend, getFinancePulse } from "@/lib/queries/contracts";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

import type { Prisma } from "@prisma/client";

export const metadata = { title: "Factures clients" };
export const dynamic = "force-dynamic";

/** Statuts de contrat dont les factures (hors brouillon) sont affichées. */
const EXECUTED = ["ACTIF", "SUSPENDU", "RESILIE", "EXPIRE"] as const;

const STATUT_CHIPS: { value: string; label: string }[] = [
  { value: "", label: "Toutes" },
  { value: "BROUILLON", label: "Brouillon" },
  { value: "ENVOYEE", label: "Envoyée" },
  { value: "EN_RETARD", label: "En retard" },
  { value: "PAYEE", label: "Payée" },
];

/** Nombre de factures payées affichées dans la vue par étapes. */
const PAID_PREVIEW = 30;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FacturesClientsPage({ searchParams }: PageProps) {
  const user = await requireAdmin();
  const raw = await searchParams;

  // --- Lecture des query params ---
  const filterStatut = typeof raw.statut === "string" ? raw.statut : undefined;
  const filterType = typeof raw.type === "string" ? raw.type : undefined;
  const filterProspectId =
    typeof raw.prospectId === "string" ? raw.prospectId : undefined;
  const q = typeof raw.q === "string" ? raw.q.trim() : undefined;
  const sortBy = typeof raw.sortBy === "string" ? raw.sortBy : "dateEmission";
  const sortDir =
    typeof raw.sortDir === "string" && raw.sortDir === "asc" ? "asc" : "desc";
  // Aucun tri de colonne demandé → vue « par étapes » avec l'ordre métier
  // (brouillons → retards → envoyées → payées). Tri demandé → vue tableau.
  const explicitSort = typeof raw.sortBy === "string";

  const now = new Date();
  // Brouillons "à envoyer MAINTENANT" : on n'affiche QUE ceux dont la date
  // d'émission est déjà arrivée (émission ≤ fin de journée aujourd'hui). Les
  // brouillons pré-générés pour un mois futur (mensualités de novembre, décembre…)
  // restent masqués jusqu'à leur date d'émission : ils ne sont pas supprimés et
  // réapparaissent automatiquement le jour venu. Évite toute confusion entre
  // "à traiter" et "planifié", et tout envoi anticipé par erreur.
  const brouillonHorizon = new Date(now);
  brouillonHorizon.setHours(23, 59, 59, 999);

  // --- Construction du WHERE ---
  // Visibilité croisée statut facture × statut contrat × fenêtre glissante :
  //   - BROUILLON : visible quel que soit le statut du contrat (y compris un
  //     contrat encore en attente de signature / validation : l'admin peut
  //     avoir créé une facture ponctuelle / d'acompte à l'avance et doit la
  //     retrouver ici), tant que la date d'émission est arrivée.
  //   - Autres statuts (ENVOYEE/PAYEE/EN_RETARD/ANNULEE) : seulement si le
  //     contrat est exécutoire ou historique (ACTIF/SUSPENDU/RESILIE/EXPIRE).
  const visibility: Prisma.ClientInvoiceWhereInput = {
    OR: [
      { statut: "BROUILLON", dateEmission: { lte: brouillonHorizon } },
      { statut: { not: "BROUILLON" }, contract: { statut: { in: [...EXECUTED] } } },
    ],
  };
  const whereConditions: Prisma.ClientInvoiceWhereInput[] = [visibility];

  if (user.role !== "ADMIN") {
    whereConditions.push({ contract: { assigneAId: user.id } });
  }
  if (filterStatut === "EN_RETARD") {
    // « En retard » = statut EN_RETARD, ou envoyée dont l'échéance est passée
    // (le cron nocturne la bascule ensuite en EN_RETARD).
    whereConditions.push({
      OR: [{ statut: "EN_RETARD" }, { statut: "ENVOYEE", dateEcheance: { lt: now } }],
    });
  } else if (filterStatut) {
    whereConditions.push({ statut: filterStatut as never });
  }
  if (filterType) {
    whereConditions.push({ type: filterType as never });
  }
  if (filterProspectId) {
    whereConditions.push({ contract: { prospectId: filterProspectId } });
  }
  if (q) {
    whereConditions.push({
      OR: [
        { numero: { contains: q, mode: "insensitive" } },
        { notesClient: { contains: q, mode: "insensitive" } },
        {
          contract: {
            prospect: { raisonSociale: { contains: q, mode: "insensitive" } },
          },
        },
        {
          contract: { numero: { contains: q, mode: "insensitive" } },
        },
      ],
    });
  }
  const where: Prisma.ClientInvoiceWhereInput =
    whereConditions.length > 0 ? { AND: whereConditions } : {};

  // --- orderBy dynamique ---
  const orderBy: Prisma.ClientInvoiceOrderByWithRelationInput = (() => {
    switch (sortBy) {
      case "numero":
        return { numero: sortDir };
      case "dateEcheance":
        return { dateEcheance: sortDir };
      case "type":
        return { type: sortDir };
      case "total":
        return { total: sortDir };
      case "statut":
        return { statut: sortDir };
      case "raisonSociale":
        return { contract: { prospect: { raisonSociale: sortDir } } };
      case "dateEmission":
      default:
        return { dateEmission: sortDir };
    }
  })();

  // Tous les brouillons à envoyer (indépendant de la limite d'affichage et du
  // filtre courant) : alimente le bouton « Envoyer tous les brouillons ».
  const draftsWhere: Prisma.ClientInvoiceWhereInput = {
    statut: "BROUILLON",
    // Même règle que l'affichage : on n'envoie / ne compte QUE les brouillons dont
    // la date d'émission est déjà arrivée (≤ aujourd'hui). Le statut du contrat
    // n'est volontairement PAS restreint : un brouillon créé pour un contrat
    // encore en attente de signature doit pouvoir être compté (KPI) et envoyé.
    dateEmission: { lte: brouillonHorizon },
    ...(user.role !== "ADMIN" ? { contract: { assigneAId: user.id } } : {}),
  };

  const [
    invoices,
    stats,
    prospectsList,
    draftRows,
    chipGroups,
    overdueSentCount,
    awaiting,
    pulse,
    cash,
  ] = await Promise.all([
    prisma.clientInvoice.findMany({
      where,
      include: {
        contract: {
          select: {
            id: true,
            numero: true,
            assigneAId: true,
            prospect: {
              select: {
                id: true,
                raisonSociale: true,
                email: true,
                emailFacturation: true,
              },
            },
          },
        },
        lignes: {
          select: { designation: true },
          orderBy: { ordre: "asc" },
          take: 1,
        },
        _count: { select: { lignes: true } },
      },
      orderBy,
      take: explicitSort ? 100 : 300,
    }),
    prisma.clientInvoice.groupBy({
      by: ["statut"],
      where: user.role === "ADMIN" ? {} : { contract: { assigneAId: user.id } },
      _count: true,
      _sum: { total: true },
    }),
    // Liste des clients pour le dropdown du filtre (uniquement ceux qui
    // ont des factures pour éviter le bruit)
    prisma.prospect.findMany({
      where: {
        contracts: { some: { clientInvoices: { some: {} } } },
      },
      select: { id: true, raisonSociale: true },
      orderBy: { raisonSociale: "asc" },
    }),
    prisma.clientInvoice.findMany({
      where: draftsWhere,
      select: {
        id: true,
        numero: true,
        total: true,
        devise: true,
        contract: {
          select: {
            prospect: {
              select: {
                raisonSociale: true,
                email: true,
                emailFacturation: true,
              },
            },
          },
        },
      },
      orderBy: { total: "desc" },
    }),
    // Compteurs des pastilles de statut (même visibilité que la liste).
    prisma.clientInvoice.groupBy({
      by: ["statut"],
      where: visibility,
      _count: true,
    }),
    prisma.clientInvoice.count({
      where: {
        statut: "ENVOYEE",
        dateEcheance: { lt: now },
        contract: { statut: { in: [...EXECUTED] } },
      },
    }),
    // En attente de paiement : envoyées, pas encore échues.
    prisma.clientInvoice.aggregate({
      where: {
        statut: "ENVOYEE",
        dateEcheance: { gte: now },
        contract: { statut: { in: [...EXECUTED] } },
      },
      _count: true,
      _sum: { total: true },
    }),
    getFinancePulse(user),
    getClientCashTrend(),
  ]);

  const drafts = draftRows.map((d) => ({
    id: d.id,
    numero: d.numero,
    clientName: d.contract.prospect.raisonSociale,
    clientEmail:
      d.contract.prospect.emailFacturation ?? d.contract.prospect.email,
    total: Number(d.total),
    devise: d.devise,
  }));

  // Début du mois courant : sert à repérer les brouillons "en retard de
  // traitement" (émis un mois précédent et toujours pas envoyés).
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // En retard (visuel) : EN_RETARD, ou ENVOYEE dont l'échéance est passée.
  // Brouillon en retard : émis avant le mois courant (à envoyer d'urgence).
  const rows: InvoiceRowData[] = invoices.map((inv) => ({
    id: inv.id,
    numero: inv.numero,
    type: inv.type,
    devise: inv.devise,
    total: Number(inv.total),
    statut: inv.statut,
    dateEmission: inv.dateEmission,
    dateEcheance: inv.dateEcheance,
    datePaiement: inv.datePaiement,
    envoiClientLe: inv.envoiClientLe,
    rappelJ20EnvoyeLe: inv.rappelJ20EnvoyeLe,
    designation: inv.lignes[0]?.designation ?? inv.notesClient ?? null,
    extraLines: Math.max(0, inv._count.lignes - 1),
    isOverdue:
      inv.statut === "EN_RETARD" ||
      (inv.statut === "ENVOYEE" && inv.dateEcheance < now),
    isStaleDraft: inv.statut === "BROUILLON" && inv.dateEmission < startOfMonth,
    contract: {
      id: inv.contract.id,
      numero: inv.contract.numero,
      prospect: {
        id: inv.contract.prospect.id,
        raisonSociale: inv.contract.prospect.raisonSociale,
        email: inv.contract.prospect.emailFacturation ?? inv.contract.prospect.email,
      },
    },
  }));

  // Groupes de la vue par étapes.
  const draftGroup = rows
    .filter((i) => i.statut === "BROUILLON")
    // Le plus ANCIEN en premier (= le plus en retard à envoyer remonte en haut).
    .sort((a, b) => a.dateEmission.getTime() - b.dateEmission.getTime());
  const overdueGroup = rows
    .filter((i) => i.isOverdue)
    .sort((a, b) => a.dateEcheance.getTime() - b.dateEcheance.getTime());
  // Montant d'un groupe, par devise (« 3'450 CHF + 200 EUR »), vide si nul.
  const totalsLabel = (list: InvoiceRowData[]): string => {
    const byDevise = new Map<string, number>();
    for (const r of list) byDevise.set(r.devise, (byDevise.get(r.devise) ?? 0) + r.total);
    return [...byDevise.entries()]
      .filter(([, t]) => t > 0)
      .map(([d, t]) => `${formatInt(t)} ${d}`)
      .join(" + ");
  };
  const draftsAmount = totalsLabel(draftGroup);
  const overdueAmount = totalsLabel(overdueGroup);
  const sentGroup = rows
    .filter((i) => i.statut === "ENVOYEE" && !i.isOverdue)
    .sort((a, b) => a.dateEcheance.getTime() - b.dateEcheance.getTime());
  const paidGroup = rows
    .filter((i) => i.statut === "PAYEE")
    .sort(
      (a, b) =>
        (b.datePaiement?.getTime() ?? b.dateEmission.getTime()) -
        (a.datePaiement?.getTime() ?? a.dateEmission.getTime()),
    );
  const cancelledGroup = rows.filter((i) => i.statut === "ANNULEE");

  const byStatut = Object.fromEntries(stats.map((s) => [s.statut, s]));
  const totalPayees = Number(byStatut.PAYEE?._sum.total ?? 0);

  const chipCount: Record<string, number> = {};
  for (const g of chipGroups) chipCount[g.statut] = g._count;
  const countForChip = (v: string): number => {
    if (v === "") return Object.values(chipCount).reduce((s, n) => s + n, 0);
    if (v === "EN_RETARD") return (chipCount.EN_RETARD ?? 0) + overdueSentCount;
    return chipCount[v] ?? 0;
  };

  // Liens qui conservent les autres filtres (recherche, type, client).
  const baseParams = new URLSearchParams();
  if (q) baseParams.set("q", q);
  if (filterType) baseParams.set("type", filterType);
  if (filterProspectId) baseParams.set("prospectId", filterProspectId);
  const hrefWith = (patch: Record<string, string | null>, keepSort = false) => {
    const sp = new URLSearchParams(baseParams);
    if (filterStatut) sp.set("statut", filterStatut);
    if (keepSort && explicitSort) {
      sp.set("sortBy", sortBy);
      sp.set("sortDir", sortDir);
    }
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `/factures-clients?${s}` : "/factures-clients";
  };

  const inv = pulse.invoices;
  const draftsCount = drafts.length;
  const sentToday = inv?.sentToday ?? 0;
  const dayTotal = sentToday + draftsCount;
  const dayPct = dayTotal > 0 ? Math.round((sentToday / dayTotal) * 100) : 0;

  const months = cash.months;
  const curMonth = months[months.length - 1]?.total ?? 0;
  const prevMonth = months[months.length - 2]?.total ?? 0;
  const trendPct = prevMonth > 0 ? Math.round(((curMonth - prevMonth) / prevMonth) * 100) : null;
  const maxMonth = Math.max(1, ...months.map((m) => m.total));

  const show = (k: string) => !filterStatut || filterStatut === k;
  // Le filtre « Envoyée » remonte aussi les envoyées déjà échues : elles
  // s'affichent dans la zone rouge.
  const showOverdue =
    show("EN_RETARD") || (filterStatut === "ENVOYEE" && overdueGroup.length > 0);

  return (
    <div className="flex flex-col gap-6 [&>div:first-child]:mb-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="finance"
        title="Factures clients"
        description={`${formatInt(invoices.length)} facture(s) émise(s) par ACLR Sàrl. Génération automatique à la signature et à chaque renouvellement.`}
      />

      <RoleFinanceHero
        pulse={pulse}
        primary={
          draftsCount > 0 ? (
            <SendAllDraftsButton
              drafts={drafts}
              variant="hero"
              label={
                draftsCount > 1
                  ? `Envoyer les ${formatInt(draftsCount)} brouillons`
                  : "Envoyer le dernier brouillon"
              }
            />
          ) : undefined
        }
      />

      <FinanceTabs
        active="factures"
        isAdmin
        counts={{
          contrats: pulse.aValider,
          factures: draftsCount + (inv?.overdueCount ?? 0),
          signatures: pulse.enAttenteSignature,
        }}
      />

      {/* KPI factures */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-2 rounded-[20px] border border-border bg-card p-5 shadow-arena">
          <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            Encaissé · {pulse.monthLabel}
          </p>
          <p className="score-number text-[30px] text-win-700">
            {formatInt(inv?.paidMonthTotal ?? 0)}
            <span className="ml-1 text-base">CHF</span>
          </p>
          <div
            role="img"
            aria-label={`Encaissé des 6 derniers mois : ${months
              .map((m) => `${m.label} ${formatInt(m.total)} CHF`)
              .join(", ")}`}
            className="flex h-10 items-end gap-1.5"
          >
            {months.map((m, i) => (
              <span
                key={m.key}
                className={cn(
                  "flex-1 rounded-[4px]",
                  i === months.length - 1 ? "bg-win-500" : "bg-win-500/35",
                )}
                style={{ height: `${Math.max(8, Math.round((m.total / maxMonth) * 100))}%` }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {trendPct !== null && (
              <strong className={trendPct >= 0 ? "text-win-700" : "text-alert-700"}>
                {trendPct >= 0 ? "+" : ""}
                {trendPct} %{" "}
              </strong>
            )}
            {trendPct !== null ? `vs ${months[months.length - 2]?.label} · ` : ""}
            {formatInt(inv?.paidMonthCount ?? 0)} facture(s) · {formatCHF(totalPayees)} depuis le début
          </p>
        </div>

        <KpiCard
          label="En attente de paiement"
          value={formatInt(Number(awaiting._sum.total ?? 0))}
          valueClass="text-info-700"
          lines={[
            `${formatInt(awaiting._count)} envoyée(s), pas encore échue(s)`,
            "Les échues basculent seules en retard",
          ]}
        />
        <KpiCard
          label="En retard"
          labelClass="text-alert-700"
          value={formatInt(inv?.overdueTotal ?? 0)}
          valueClass="text-alert-700"
          className="border-coral-100"
          lines={[
            `${formatInt(inv?.overdueCount ?? 0)} facture(s) échue(s)`,
            (inv?.overdueCount ?? 0) > 0
              ? `Le plus ancien : ${formatInt(inv?.overdueOldestDays ?? 0)} jours`
              : "Zéro retard, garde la zone rouge vide",
          ]}
        />
        <KpiCard
          label="Brouillons"
          value={formatInt(draftsCount)}
          unit=""
          lines={["à envoyer (émis à ce jour)", "Les mensualités futures restent cachées"]}
        />
        <div className="flex min-w-0 items-center gap-3.5 rounded-[20px] border border-border bg-card p-5 shadow-arena">
          <ProgressRing
            value={Math.min(cash.avgDaysToCash ?? 0, 30)}
            max={30}
            size={76}
            stroke={9}
            tone="gold"
            label={
              cash.avgDaysToCash !== null
                ? `Délai moyen d'encaissement : ${cash.avgDaysToCash} jours`
                : "Délai moyen d'encaissement : pas encore de données"
            }
          >
            <span className="font-display text-lg font-extrabold">
              {cash.avgDaysToCash !== null ? `${cash.avgDaysToCash} j` : "-"}
            </span>
          </ProgressRing>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              Délai d&apos;encaissement
            </p>
            <p className="text-[13px] font-semibold">Moyenne sur 90 jours</p>
            <p className="text-xs font-bold text-gold-700">
              {cash.fastShare !== null
                ? `${Math.round(cash.fastShare * 100)} % payées en 10 j ou moins`
                : "Pas encore de facture payée"}
            </p>
          </div>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Filtrer par statut" className="flex flex-wrap gap-1.5">
            {STATUT_CHIPS.map((c) => {
              const on = (filterStatut ?? "") === c.value;
              const n = countForChip(c.value);
              const hot = c.value === "EN_RETARD" && n > 0 && !on;
              return (
                <Link
                  key={c.value || "all"}
                  href={hrefWith({ statut: c.value || null }, true)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold transition-colors",
                    on
                      ? "border-navy-700 bg-navy-700 text-white"
                      : hot
                        ? "border-coral-100 bg-alert-50 text-alert-700 hover:bg-coral-100"
                        : "border-border-strong bg-card text-foreground hover:bg-navy-50",
                  )}
                >
                  {c.label}
                  <span className="text-xs font-extrabold tabular-nums opacity-85">
                    {formatInt(n)}
                  </span>
                </Link>
              );
            })}
          </div>
          {explicitSort ? (
            <Link
              href={hrefWith({ sortBy: null, sortDir: null })}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-bold text-info-700 hover:underline"
            >
              <LayoutList aria-hidden="true" className="size-4" />
              Vue par étapes
            </Link>
          ) : (
            <Link
              href={hrefWith({ sortBy: "dateEmission", sortDir: "desc" })}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-bold text-info-700 hover:underline"
            >
              <Rows3 aria-hidden="true" className="size-4" />
              Vue tableau triable
            </Link>
          )}
        </div>
        {/* Filtres avancés : recherche + type + client */}
        <ClientInvoiceFilters prospects={prospectsList} />
      </div>

      {explicitSort ? (
        <SectionCard
          title="Toutes les factures"
          icon={FileStack}
          tone="navy"
          description={`${formatInt(rows.length)} affichée(s) · clique un en-tête pour trier`}
        >
          {rows.length === 0 ? (
            <EmptyState icon={FileStack} title="Aucune facture pour ce filtre." />
          ) : (
            <div className="flex flex-col gap-2">
              <InvoiceTableHeader />
              <ul className="flex flex-col gap-2">
                {rows.map((r) => (
                  <InvoiceRow key={r.id} inv={r} variant="flat" now={now} />
                ))}
              </ul>
            </div>
          )}
        </SectionCard>
      ) : (
        <>
          {/* Brouillons : facturation du jour */}
          {show("BROUILLON") && (
            <section
              id="brouillons"
              aria-label="Brouillons à envoyer"
              className="flex scroll-mt-24 flex-col gap-4 rounded-[20px] border border-border bg-card p-5 shadow-arena sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 flex-[1_1_320px] items-center gap-3.5">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-navy-100 text-navy-700"
                  >
                    <Send className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-[0.08em] text-coral-600 uppercase">
                      Objectif du jour
                      {draftsAmount ? ` · ${draftsAmount} à facturer` : ""}
                    </p>
                    <h2 className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
                      Lancer la facturation du jour
                    </h2>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      Du plus ancien au plus récent. Les mensualités futures restent
                      cachées jusqu&apos;à leur date.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-[180px] flex-1">
                    <div className="mb-1.5 flex justify-between gap-2 text-xs font-bold text-muted-foreground">
                      <span>
                        {formatInt(sentToday)} / {formatInt(dayTotal)} envoyées aujourd&apos;hui
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Facturation du jour"
                      aria-valuemin={0}
                      aria-valuemax={Math.max(dayTotal, 1)}
                      aria-valuenow={sentToday}
                      aria-valuetext={`${sentToday} sur ${dayTotal}`}
                      className="h-2.5 overflow-hidden rounded-full bg-coral-100"
                    >
                      <div
                        className="h-full rounded-full bg-gradient-coral transition-[width] duration-700"
                        style={{ width: `${dayTotal === 0 ? 0 : dayPct}%` }}
                      />
                    </div>
                  </div>
                  {draftsCount > 0 && <SendAllDraftsButton drafts={drafts} />}
                </div>
              </div>

              {draftGroup.length === 0 ? (
                <div
                  className={cn(
                    "rounded-[14px] px-4 py-4 text-center text-sm font-semibold",
                    sentToday > 0 ? "bg-win-50 text-win-700" : "border border-dashed border-border-strong text-muted-foreground",
                  )}
                >
                  {sentToday > 0
                    ? `${formatInt(sentToday)} facture(s) parties aujourd'hui · facturation du jour terminée.`
                    : "Plus aucun brouillon émis à ce jour. Les prochaines mensualités apparaîtront à leur date."}
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {draftGroup.map((r) => (
                    <InvoiceRow key={r.id} inv={r} variant="draft" now={now} />
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Zone rouge : retards */}
          {showOverdue && (
            <section
              aria-label="Factures en retard"
              className="flex flex-col gap-4 rounded-[20px] border border-coral-100 bg-card p-5 shadow-arena sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-alert-50 text-alert-700"
                  >
                    <TriangleAlert className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
                      Zone rouge · {formatInt(overdueGroup.length)} en retard
                      {overdueAmount ? ` · ${overdueAmount} à encaisser` : ""}
                    </h2>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {overdueGroup.length > 0
                        ? "Encaisse-les en premier : relance ou marque payée dès que le virement tombe."
                        : "Plus rien dans la zone rouge. Garde-la vide."}
                    </p>
                  </div>
                </div>
              </div>
              {overdueGroup.length === 0 ? (
                <p className="rounded-[14px] bg-win-50 px-4 py-4 text-center text-[15px] font-extrabold text-win-700">
                  Zéro retard. La caisse est propre.
                </p>
              ) : (
                <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-3">
                  {overdueGroup.map((r) => (
                    <OverdueCard key={r.id} inv={r} now={now} />
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Envoyées en attente */}
          {show("ENVOYEE") && (
            <SectionCard
              title="Envoyées · en attente de paiement"
              icon={Hourglass}
              tone="blue"
              description={`${formatInt(sentGroup.length)} facture(s) · ${formatCHF(
                sentGroup.reduce((s, r) => s + r.total, 0),
              )}`}
            >
              {sentGroup.length === 0 ? (
                <p className="rounded-[14px] border border-dashed border-border-strong px-4 py-4 text-center text-sm font-semibold text-muted-foreground">
                  Aucune facture en attente sur ce filtre.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {sentGroup.map((r) => (
                    <InvoiceRow key={r.id} inv={r} variant="sent" now={now} />
                  ))}
                </ul>
              )}
            </SectionCard>
          )}

          {/* Payées */}
          {show("PAYEE") && (
            <SectionCard
              title="Payées récemment"
              icon={CircleCheck}
              tone="green"
              description="Encaisseur éclair = payée en 10 jours ou moins après l'envoi"
              action={
                !filterStatut && paidGroup.length > PAID_PREVIEW ? (
                  <Link
                    href={hrefWith({ statut: "PAYEE" })}
                    className="text-[13px] font-bold text-info-700 underline underline-offset-2"
                  >
                    Voir les {formatInt(paidGroup.length)} payées
                  </Link>
                ) : undefined
              }
            >
              {paidGroup.length === 0 ? (
                <p className="rounded-[14px] border border-dashed border-border-strong px-4 py-4 text-center text-sm font-semibold text-muted-foreground">
                  Aucune facture payée sur ce filtre.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {(filterStatut ? paidGroup : paidGroup.slice(0, PAID_PREVIEW)).map((r) => (
                    <InvoiceRow key={r.id} inv={r} variant="paid" now={now} />
                  ))}
                </ul>
              )}
            </SectionCard>
          )}

          {/* Annulées (rares) */}
          {cancelledGroup.length > 0 && (
            <SectionCard title="Annulées" icon={XCircle} tone="navy">
              <ul className="flex flex-col gap-2">
                {cancelledGroup.map((r) => (
                  <InvoiceRow key={r.id} inv={r} variant="cancelled" now={now} />
                ))}
              </ul>
            </SectionCard>
          )}

          {rows.length === 0 && filterStatut && (
            <EmptyState
              icon={Banknote}
              title="Aucune facture pour ce filtre."
              description="Change de statut ou réinitialise la recherche."
            />
          )}
        </>
      )}

      <div className="flex items-start gap-3.5 rounded-[16px] bg-mail-50 px-4 py-4">
        <Repeat aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-mail-700" />
        <p className="text-[13px] leading-relaxed text-foreground">
          <strong>Pilote automatique actif.</strong> Les factures sont générées
          automatiquement à la signature d&apos;un contrat selon sa modalité de
          paiement, chaque mois pour les mensualités et à chaque anniversaire pour
          l&apos;année renouvelée. La relance J+20 part toute seule (une fois) et les
          échues passent en retard chaque nuit. Marque-les payées au moment de
          l&apos;encaissement.
        </p>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock aria-hidden="true" className="size-3.5" />
        Montants des cartes en CHF (factures EUR comptées à leur valeur nominale).
      </p>
    </div>
  );
}

function KpiCard({
  label,
  labelClass,
  value,
  valueClass,
  unit = "CHF",
  lines,
  className,
}: {
  label: string;
  labelClass?: string;
  value: string;
  valueClass?: string;
  unit?: string;
  lines: string[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-[20px] border border-border bg-card p-5 shadow-arena",
        className,
      )}
    >
      <p
        className={cn(
          "text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase",
          labelClass,
        )}
      >
        {label}
      </p>
      <p className={cn("score-number text-[30px] text-foreground", valueClass)}>
        {value}
        {unit && <span className="ml-1 text-base">{unit}</span>}
      </p>
      {lines.map((l, i) => (
        <p
          key={i}
          className={cn("text-muted-foreground", i === 0 ? "text-[13px]" : "text-xs")}
        >
          {l}
        </p>
      ))}
    </div>
  );
}
