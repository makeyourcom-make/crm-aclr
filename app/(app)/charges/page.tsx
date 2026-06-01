import Link from "next/link";

import { ExpenseFilters } from "@/components/charges/expense-filters";
import { MarkPaidButton } from "@/components/charges/mark-paid-button";
import { SortableHeader } from "@/components/common/sortable-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { formatCHF, formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

import type { Prisma } from "@prisma/client";

export const metadata = { title: "Charges" };
export const dynamic = "force-dynamic";

const CATEGORIE_LABEL: Record<string, string> = {
  LOYER: "Loyer",
  SOFTWARE_SAAS: "Software",
  MARKETING: "Marketing",
  PUBLICITE: "Publicité",
  DEPLACEMENTS: "Déplacements",
  RESTAURATION: "Restauration",
  MATERIEL_BUREAU: "Matériel",
  ASSURANCES: "Assurances",
  TELECOM: "Télécom",
  FORMATION: "Formation",
  HONORAIRES: "Honoraires",
  IMPOTS: "Impôts",
  BANQUE_FRAIS: "Frais bancaires",
  AUTRE: "Autre",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

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

  const [expenses, statsMonth, statsYear, byCategorie, enAttente] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy,
      take: 200,
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
    prisma.expense.aggregate({
      where: { statutPaiement: "EN_ATTENTE" },
      _sum: { montantTTC: true },
      _count: true,
    }),
  ]);

  const ttcYear = Number(statsYear._sum.montantTTC ?? 0);

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Charges"
        description="Suivi des charges de l'entreprise (tickets, factures fournisseurs)."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={buildExportUrl(raw)}
              className={buttonVariants({ variant: "outline" })}
            >
              <Icon name="Upload" className="mr-1.5 h-4 w-4 rotate-180" />
              Exporter CSV
            </Link>
            <Link
              href="/charges/nouveau"
              className={buttonVariants({ variant: "default" })}
            >
              <Icon name="Plus" className="mr-1.5 h-4 w-4" />
              Nouvelle charge
            </Link>
          </div>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Charges ce mois"
          value={formatCHF(Number(statsMonth._sum.montantTTC ?? 0))}
          subtitle={`${statsMonth._count} ticket(s)`}
        />
        <Kpi
          label="Charges YTD"
          value={formatCHF(ttcYear)}
          subtitle={`${statsYear._count} ticket(s) cumulés`}
          tone="primary"
        />
        <Kpi
          label="À réconcilier"
          value={`${enAttente._count}`}
          subtitle={
            enAttente._count > 0
              ? `${formatCHF(Number(enAttente._sum.montantTTC ?? 0))} en attente de débit`
              : "Tout est à jour ✓"
          }
          tone={enAttente._count > 0 ? "amber" : "emerald"}
        />
        <Kpi
          label="Top catégorie YTD"
          value={
            byCategorie[0]
              ? CATEGORIE_LABEL[byCategorie[0].categorie] ??
                byCategorie[0].categorie
              : "—"
          }
          subtitle={
            byCategorie[0]
              ? formatCHF(Number(byCategorie[0]._sum.montantTTC ?? 0))
              : "Aucune charge"
          }
        />
      </div>

      {/* Filtres */}
      <div className="mb-4">
        <ExpenseFilters />
      </div>

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>
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
                <Th>Client</Th>
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
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-12 text-center text-muted-foreground"
                  >
                    Aucune charge enregistrée.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {formatDate(e.date)}
                      {e.dateReglement && (
                        <div className="text-[10px] text-muted-foreground">
                          réglé {formatDate(e.dateReglement)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatutBadge statut={e.statutPaiement} />
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="font-normal">
                        {CATEGORIE_LABEL[e.categorie] ?? e.categorie}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-sm font-medium">
                        {e.fournisseur ?? "—"}
                      </p>
                      {e.description && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {e.description}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {e.prospect ? (
                        <Link
                          href={`/prospects/${e.prospect.id}`}
                          className="text-xs font-medium hover:text-primary"
                        >
                          {e.prospect.raisonSociale}
                        </Link>
                      ) : e.allocations.length > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] text-primary"
                          title={e.allocations
                            .map(
                              (a) =>
                                `${a.prospect.raisonSociale}: ${formatCHF(Number(a.montantHT))}`,
                            )
                            .join("\n")}
                        >
                          <Icon name="Users" className="h-3 w-3" />
                          {e.allocations.length} client(s)
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          interne
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">
                      {formatCHF(Number(e.montantHT))}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatCHF(Number(e.montantTTC))}
                    </td>
                    <td className="px-3 py-2">
                      {e.ticketUrl ? (
                        <div className="inline-flex items-center gap-1">
                          <a
                            href={e.ticketUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] hover:bg-muted"
                          >
                            <Icon name="Image" className="h-3 w-3" />
                            {e.ocrUtilise && (
                              <Icon
                                name="Sparkles"
                                className="h-3 w-3 text-primary"
                                aria-label="OCR"
                              />
                            )}
                            Voir
                          </a>
                          {e.attachments.length > 0 && (
                            <span
                              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary"
                              title={`${e.attachments.length} pièce(s) jointe(s) complémentaire(s)`}
                            >
                              +{e.attachments.length}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {e.statutPaiement === "EN_ATTENTE" && (
                          <MarkPaidButton
                            expenseId={e.id}
                            defaultDate={e.date.toISOString().slice(0, 10)}
                          />
                        )}
                        <Link
                          href={`/charges/${e.id}`}
                          className="inline-flex h-6 items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px] hover:bg-muted"
                          title="Détail"
                        >
                          <Icon name="Pencil" className="h-3 w-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        💡 Pour ajouter une charge : prends le ticket en photo, clique{" "}
        <strong>« Nouvelle charge »</strong>, charge la photo et utilise{" "}
        <strong>« Analyser le ticket (IA) »</strong> pour pré-remplir
        automatiquement les champs.
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone?: "emerald" | "primary" | "amber";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-1 text-2xl font-semibold tabular-nums ${
            tone === "emerald"
              ? "text-emerald-700"
              : tone === "amber"
                ? "text-amber-700"
                : tone === "primary"
                  ? "text-primary"
                  : ""
          }`}
        >
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function StatutBadge({ statut }: { statut: string }) {
  const config: Record<
    string,
    { label: string; cls: string }
  > = {
    EN_ATTENTE: {
      label: "En attente",
      cls: "bg-amber-100 text-amber-800 border-amber-200",
    },
    PAYE: {
      label: "Payé",
      cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    LITIGE: {
      label: "Litige",
      cls: "bg-rose-100 text-rose-800 border-rose-200",
    },
    REMBOURSE: {
      label: "Remboursé",
      cls: "bg-blue-100 text-blue-800 border-blue-200",
    },
  };
  const c = config[statut] ?? config.EN_ATTENTE;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${c.cls}`}
    >
      {c.label}
    </span>
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
