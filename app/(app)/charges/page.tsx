import {
  CalendarDays,
  CircleCheck,
  Download,
  Hourglass,
  Lightbulb,
  ListOrdered,
  Pencil,
  Plus,
  ReceiptText,
  Repeat,
  Sparkles,
  Tag,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { EmptyState, SectionCard, StatTile } from "@/components/arena";
import { ExpenseFilters } from "@/components/charges/expense-filters";
import {
  CategoryChip,
  ExpenseStatutPill,
  RecurringChip,
} from "@/components/charges/expense-statut-pill";
import { CATEGORIE_LABEL } from "@/components/charges/labels";
import { MarkPaidButton } from "@/components/charges/mark-paid-button";
import {
  TABLE_CLASS,
  THEAD_CLASS,
  TR_CLASS,
  TableEmptyRow,
  TableScroll,
  Td,
  Th,
} from "@/components/common/arena-table";
import { Callout } from "@/components/common/callout";
import { ChfValue } from "@/components/common/chf-value";
import { DocumentPreviewButton } from "@/components/common/document-preview-button";
import { PageShell } from "@/components/common/page-shell";
import { SortableHeader } from "@/components/common/sortable-header";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatCHF, formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

import type { Prisma } from "@prisma/client";

export const metadata = { title: "Charges" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ROW_ACTION =
  "inline-flex h-9 items-center gap-1 rounded-[10px] border border-border-strong bg-card px-2.5 text-xs font-bold text-foreground transition-colors hover:bg-navy-50";

export default async function ChargesPage({ searchParams }: PageProps) {
  await requireAdmin();
  const raw = await searchParams;

  // --- Lecture des query params ---
  const q = typeof raw.q === "string" ? raw.q.trim() : undefined;
  const filterCat =
    typeof raw.categorie === "string" ? raw.categorie : undefined;
  const filterPeriode =
    typeof raw.periode === "string" ? raw.periode : undefined;
  const filterStatut =
    typeof raw.statut === "string" ? raw.statut : undefined;
  const sortBy = typeof raw.sortBy === "string" ? raw.sortBy : "date";
  const sortDir =
    typeof raw.sortDir === "string" && raw.sortDir === "asc" ? "asc" : "desc";

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startYear = new Date(now.getFullYear(), 0, 1);

  // --- Calcul de la fenêtre temporelle selon le filtre période ---
  let periodeFrom: Date | undefined;
  let periodeTo: Date | undefined;
  if (filterPeriode === "month") {
    periodeFrom = startMonth;
  } else if (filterPeriode === "prev-month") {
    periodeFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    periodeTo = startMonth;
  } else if (filterPeriode === "quarter") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    periodeFrom = new Date(now.getFullYear(), q, 1);
  } else if (filterPeriode === "ytd") {
    periodeFrom = startYear;
  } else if (filterPeriode === "12m") {
    periodeFrom = new Date(now);
    periodeFrom.setMonth(periodeFrom.getMonth() - 12);
  }

  // --- Construction du WHERE ---
  const whereConditions: Prisma.ExpenseWhereInput[] = [];
  if (filterCat) {
    whereConditions.push({ categorie: filterCat as never });
  }
  if (filterStatut) {
    whereConditions.push({ statutPaiement: filterStatut as never });
  }
  if (periodeFrom || periodeTo) {
    whereConditions.push({
      date: {
        ...(periodeFrom ? { gte: periodeFrom } : {}),
        ...(periodeTo ? { lt: periodeTo } : {}),
      },
    });
  }
  if (q) {
    whereConditions.push({
      OR: [
        { description: { contains: q, mode: "insensitive" } },
        { fournisseur: { contains: q, mode: "insensitive" } },
        { reference: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  const where: Prisma.ExpenseWhereInput =
    whereConditions.length > 0 ? { AND: whereConditions } : {};

  // --- orderBy dynamique ---
  const orderBy: Prisma.ExpenseOrderByWithRelationInput = (() => {
    switch (sortBy) {
      case "categorie":
        return { categorie: sortDir };
      case "fournisseur":
        return { fournisseur: sortDir };
      case "montantHT":
        return { montantHT: sortDir };
      case "montantTVA":
        return { montantTVA: sortDir };
      case "montantTTC":
        return { montantTTC: sortDir };
      case "date":
      default:
        return { date: sortDir };
    }
  })();

  const [expenses, statsMonth, statsYear, byCategorie, byFournisseur, enAttente] =
    await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy,
      take: 100,
      include: {
        createdBy: { select: { name: true } },
        attachments: { select: { id: true, fileUrl: true, kind: true } },
        prospect: { select: { id: true, raisonSociale: true } },
        allocations: {
          select: {
            id: true,
            montantHT: true,
            prospect: { select: { id: true, raisonSociale: true } },
          },
        },
      },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: startMonth } },
      _sum: { montantTTC: true, montantTVA: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { date: { gte: startYear } },
      _sum: { montantTTC: true, montantTVA: true },
      _count: true,
    }),
    prisma.expense.groupBy({
      by: ["categorie"],
      where: { date: { gte: startYear } },
      _sum: { montantTTC: true },
      orderBy: { _sum: { montantTTC: "desc" } },
    }),
    // Vue d'ensemble : cumul annuel par fournisseur (poste), le plus gros en
    // haut. C'est ici qu'on voit « Google Ads » gonfler mois après mois.
    prisma.expense.groupBy({
      by: ["fournisseur"],
      where: { date: { gte: startYear } },
      _sum: { montantTTC: true },
      _count: true,
      orderBy: { _sum: { montantTTC: "desc" } },
    }),
    prisma.expense.aggregate({
      where: { statutPaiement: "EN_ATTENTE" },
      _sum: { montantTTC: true },
      _count: true,
    }),
  ]);

  const ttcYear = Number(statsYear._sum.montantTTC ?? 0);

  // Top postes de l'année (fournisseurs), cumul décroissant, part relative.
  const postes = byFournisseur
    .map((f) => ({
      fournisseur: f.fournisseur,
      total: Number(f._sum.montantTTC ?? 0),
      count: f._count,
    }))
    .filter((p) => p.total > 0)
    .slice(0, 12);
  const postesMax = postes[0]?.total ?? 0;

  const hasFilters = !!(q || filterCat || filterPeriode || filterStatut);

  return (
    <PageShell>
      <PageHeader
        rubrique="finance"
        title="Charges"
        description="Suivi des charges de l'entreprise (tickets, factures fournisseurs)."
        actions={
          <>
            <Link
              href="/charges/recurrences"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <Repeat aria-hidden="true" />
              Modèles récurrents
            </Link>
            <Link
              href={buildExportUrl(raw)}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <Download aria-hidden="true" />
              Exporter CSV
            </Link>
            <Link
              href="/charges/nouveau"
              className={buttonVariants({ variant: "default", size: "lg" })}
            >
              <Plus aria-hidden="true" />
              Nouvelle charge
            </Link>
          </>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Charges ce mois"
          value={<ChfValue amount={Number(statsMonth._sum.montantTTC ?? 0)} />}
          sub={`${statsMonth._count} ticket(s)`}
          tone="navy"
          icon={CalendarDays}
          href="/charges?periode=month"
        />
        <StatTile
          label="Charges YTD"
          value={<ChfValue amount={ttcYear} />}
          sub={`${statsYear._count} ticket(s) cumulés`}
          tone="red"
          icon={Wallet}
          href="/charges?periode=ytd"
        />
        <StatTile
          label="À réconcilier"
          value={enAttente._count}
          sub={
            enAttente._count > 0
              ? `${formatCHF(Number(enAttente._sum.montantTTC ?? 0))} en attente de débit`
              : "Tout est à jour"
          }
          tone={enAttente._count > 0 ? "gold" : "green"}
          icon={enAttente._count > 0 ? Hourglass : CircleCheck}
          href={enAttente._count > 0 ? "/charges?statut=EN_ATTENTE" : undefined}
        />
        <StatTile
          label="Top catégorie YTD"
          value={
            byCategorie[0] ? (
              <span className="text-[26px] sm:text-[30px]">
                {CATEGORIE_LABEL[byCategorie[0].categorie] ??
                  byCategorie[0].categorie}
              </span>
            ) : (
              <span className="text-[26px] text-muted-foreground">Aucune</span>
            )
          }
          sub={
            byCategorie[0]
              ? formatCHF(Number(byCategorie[0]._sum.montantTTC ?? 0))
              : "Aucune charge"
          }
          tone="violet"
          icon={Tag}
        />
      </div>

      {/* Vue d'ensemble : plus gros postes cumulés sur l'année */}
      {postes.length > 0 && (
        <SectionCard
          className="mb-6"
          title={`Plus gros postes · année ${now.getFullYear()}`}
          description={`Cumul (récurrences comprises) · ${formatCHF(ttcYear)} au total`}
          icon={ListOrdered}
          tone="navy"
        >
          <ul className="grid gap-x-8 gap-y-3 lg:grid-cols-2">
            {postes.map((p) => {
              const pct = ttcYear > 0 ? (p.total / ttcYear) * 100 : 0;
              const barPct = postesMax > 0 ? (p.total / postesMax) * 100 : 0;
              return (
                <li key={p.fournisseur ?? "sans-fournisseur"} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-bold">
                      {p.fournisseur ?? "Sans fournisseur"}
                    </span>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums">
                      {formatCHF(p.total)}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${p.fournisseur ?? "Sans fournisseur"} : ${pct.toFixed(0)} % des charges de l'année`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(pct)}
                    className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-navy-50"
                  >
                    <div
                      className="h-full rounded-full bg-navy-500 transition-[width] duration-700 motion-safe:animate-meter-fill"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {p.count} charge(s) · {pct.toFixed(0)} % du total
                  </p>
                </li>
              );
            })}
          </ul>
          <Callout tone="blue" icon={Lightbulb} className="mt-5">
            Chaque charge récurrente (ex. Google Ads mensuel) est comptée une
            seule fois par mois : le total ci-dessus est bien le cumul réel,
            sans double comptage.
          </Callout>
        </SectionCard>
      )}

      {/* Filtres */}
      <div className="mb-4">
        <ExpenseFilters />
      </div>

      {/* Liste */}
      <SectionCard
        className="overflow-hidden"
        title="Liste des charges"
        description={
          expenses.length >= 100
            ? "Les 100 premières selon le tri choisi"
            : `${expenses.length} charge(s)${hasFilters ? " pour ces filtres" : ""}`
        }
        icon={ReceiptText}
        tone="navy"
        contentClassName="-mx-5 -mb-5 sm:-mx-6 sm:-mb-6"
      >
        {/* Vue CARTES sur mobile */}
        <div className="divide-y divide-border border-t border-border md:hidden">
          {expenses.length === 0 ? (
            <div className="p-4">
              <EmptyCharges hasFilters={hasFilters} />
            </div>
          ) : (
            expenses.map((e) => (
              <div key={e.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold">
                      <span className="truncate">{e.fournisseur ?? "Sans fournisseur"}</span>
                      {e.recurrenceId && <RecurringChip short />}
                    </p>
                    {e.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {e.description}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-[15px] font-extrabold tabular-nums">
                    {formatCHF(Number(e.montantTTC))}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <ExpenseStatutPill statut={e.statutPaiement} />
                  <CategoryChip categorie={e.categorie} />
                  <span className="font-medium text-muted-foreground tabular-nums">
                    {formatDate(e.date)}
                  </span>
                  {e.prospect ? (
                    <Link
                      href={`/prospects/${e.prospect.id}`}
                      className="font-bold text-info-700 hover:underline"
                    >
                      {e.prospect.raisonSociale}
                    </Link>
                  ) : e.allocations.length > 0 ? (
                    <span className="font-bold text-info-700">
                      {e.allocations.length} client(s)
                    </span>
                  ) : (
                    <span className="text-muted-foreground">interne</span>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {e.ticketUrl && (
                    <DocumentPreviewButton
                      url={e.ticketUrl}
                      filename={e.ticketName ?? undefined}
                      label="Ticket"
                      icon="Eye"
                    />
                  )}
                  {e.statutPaiement === "EN_ATTENTE" && (
                    <MarkPaidButton
                      expenseId={e.id}
                      defaultDate={e.date.toISOString().slice(0, 10)}
                    />
                  )}
                  <Link href={`/charges/${e.id}`} className={ROW_ACTION}>
                    <Pencil aria-hidden="true" className="size-3.5" />
                    Détail
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Vue TABLEAU sur desktop */}
        <TableScroll label="Liste des charges" className="hidden md:block">
          <table className={TABLE_CLASS}>
            <thead className={THEAD_CLASS}>
              <tr>
                <Th className="pl-5 sm:pl-6">
                  <SortableHeader
                    label="Date"
                    field="date"
                    defaultSortBy="date"
                    defaultDir="desc"
                  />
                </Th>
                <Th>Statut</Th>
                <Th>
                  <SortableHeader
                    label="Catégorie"
                    field="categorie"
                    defaultSortBy="date"
                  />
                </Th>
                <Th>
                  <SortableHeader
                    label="Fournisseur / Description"
                    field="fournisseur"
                    defaultSortBy="date"
                  />
                </Th>
                <Th className="hidden lg:table-cell">Client</Th>
                <Th className="text-right">
                  <SortableHeader
                    label="HT"
                    field="montantHT"
                    defaultSortBy="date"
                    defaultDir="desc"
                  />
                </Th>
                <Th className="text-right">
                  <SortableHeader
                    label="TTC"
                    field="montantTTC"
                    defaultSortBy="date"
                    defaultDir="desc"
                  />
                </Th>
                <Th>Ticket</Th>
                <Th className="pr-5 text-right sm:pr-6">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <TableEmptyRow colSpan={9}>
                  <EmptyCharges hasFilters={hasFilters} />
                </TableEmptyRow>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className={TR_CLASS}>
                    <Td className="pl-5 text-xs whitespace-nowrap tabular-nums sm:pl-6">
                      <span className="font-semibold">{formatDate(e.date)}</span>
                      {e.dateReglement && (
                        <div className="text-[11px] text-muted-foreground">
                          réglé {formatDate(e.dateReglement)}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <ExpenseStatutPill statut={e.statutPaiement} />
                    </Td>
                    <Td>
                      <CategoryChip categorie={e.categorie} />
                    </Td>
                    <Td className="max-w-[280px]">
                      <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold">
                        <span className="truncate">
                          {e.fournisseur ?? "Sans fournisseur"}
                        </span>
                        {e.recurrenceId && <RecurringChip />}
                      </p>
                      {e.description && (
                        <p className="truncate text-xs text-muted-foreground">
                          {e.description}
                        </p>
                      )}
                    </Td>
                    <Td className="hidden lg:table-cell">
                      {e.prospect ? (
                        <Link
                          href={`/prospects/${e.prospect.id}`}
                          className="text-xs font-bold text-info-700 hover:underline"
                        >
                          {e.prospect.raisonSociale}
                        </Link>
                      ) : e.allocations.length > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-bold text-info-700"
                          title={e.allocations
                            .map(
                              (a) =>
                                `${a.prospect.raisonSociale}: ${formatCHF(Number(a.montantHT))}`,
                            )
                            .join("\n")}
                        >
                          <Users aria-hidden="true" className="size-3.5" />
                          {e.allocations.length} client(s)
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">interne</span>
                      )}
                    </Td>
                    <Td className="text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatCHF(Number(e.montantHT))}
                    </Td>
                    <Td className="text-right font-extrabold whitespace-nowrap tabular-nums">
                      {formatCHF(Number(e.montantTTC))}
                    </Td>
                    <Td>
                      {e.ticketUrl ? (
                        <div className="inline-flex items-center gap-1.5">
                          <DocumentPreviewButton
                            url={e.ticketUrl}
                            filename={e.ticketName ?? undefined}
                            label="Voir"
                            icon="Eye"
                          />
                          {e.ocrUtilise && (
                            <Sparkles
                              className="size-3.5 text-lvl-700"
                              aria-label="Pré-rempli par l'IA"
                              role="img"
                            />
                          )}
                          {e.attachments.length > 0 && (
                            <span
                              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-navy-100 px-1.5 text-[11px] font-extrabold text-navy-700"
                              title={`${e.attachments.length} pièce(s) jointe(s) complémentaire(s)`}
                            >
                              +{e.attachments.length}
                              <span className="sr-only"> pièce(s) jointe(s)</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Aucun</span>
                      )}
                    </Td>
                    <Td className="pr-5 sm:pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        {e.statutPaiement === "EN_ATTENTE" && (
                          <MarkPaidButton
                            expenseId={e.id}
                            defaultDate={e.date.toISOString().slice(0, 10)}
                          />
                        )}
                        <Link
                          href={`/charges/${e.id}`}
                          className={cn(ROW_ACTION, "w-9 justify-center px-0")}
                          title="Détail"
                          aria-label={`Détail de la charge ${e.fournisseur ?? ""}`.trim()}
                        >
                          <Pencil aria-hidden="true" className="size-3.5" />
                        </Link>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScroll>
      </SectionCard>

      <Callout tone="violet" icon={Sparkles} className="mt-4">
        Pour ajouter une charge : prends le ticket en photo, clique{" "}
        <strong>« Nouvelle charge »</strong>, charge la photo et utilise{" "}
        <strong>« Analyser le ticket (IA) »</strong> pour pré-remplir
        automatiquement les champs.
      </Callout>
    </PageShell>
  );
}

function EmptyCharges({ hasFilters }: { hasFilters: boolean }) {
  return hasFilters ? (
    <EmptyState
      icon={ReceiptText}
      tone="navy"
      title="Aucune charge pour ces filtres"
      description="Élargis la période ou réinitialise les filtres pour tout revoir."
    />
  ) : (
    <EmptyState
      icon={ReceiptText}
      tone="navy"
      title="Aucune charge enregistrée"
      description="Ajoute ton premier ticket : l'IA pré-remplit les champs depuis la photo."
      action={
        <Link
          href="/charges/nouveau"
          className={buttonVariants({ variant: "default", size: "lg" })}
        >
          <Plus aria-hidden="true" />
          Nouvelle charge
        </Link>
      }
    />
  );
}

function buildExportUrl(
  raw: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === "string" && val) params.set(key, val);
  }
  const qs = params.toString();
  return `/api/charges/export${qs ? `?${qs}` : ""}`;
}
