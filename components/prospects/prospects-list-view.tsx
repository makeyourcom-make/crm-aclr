/**
 * Vue de la liste Entreprises : en-tête, héros, entonnoir,
 * vues rapides + filtres, liste et pagination. Aucune requête ici : les
 * données viennent de `loadProspectsPage` (lib/queries/prospects-pages.ts).
 * Server-safe.
 */
import { Building2, FileSpreadsheet, GitMerge, Plus, Sparkles, Upload } from "lucide-react";
import Link from "next/link";

import { formatInt } from "@/components/arena";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import type { ProspectsPageData } from "@/lib/queries/prospects-pages";
import { cn } from "@/lib/utils";

import { FRESH_LEGEND } from "./lead-heat";
import { VUE_META } from "./lead-views";
import { LeadsFunnel } from "./leads-funnel";
import { LeadsHero } from "./leads-hero";
import { LeadsViews } from "./leads-views";
import { prospectsHref } from "./list-href";
import { ProspectFilters } from "./prospect-filters";
import { ProspectsPagination } from "./prospects-pagination";
import { ProspectsTable } from "./prospects-table";
import { STATUT_META } from "./statut-meta";

const SORT_LABEL: Record<string, string> = {
  createdAt: "date d'ajout",
  updatedAt: "dernière modification",
  raisonSociale: "raison sociale",
  ville: "lieu",
  secteur: "secteur",
  statut: "statut",
  derniereActionLe: "dernière action",
  dernierAppelLe: "dernier appel",
  dateRdvLe: "date de RDV",
  contratDebutLe: "début de contrat",
};

export function ProspectsListView({
  data,
  pendingMergeCount = 0,
}: {
  data: ProspectsPageData;
  /** Nombre de demandes de fusion EN_ATTENTE (admin) : lien affiché si > 0. */
  pendingMergeCount?: number;
}) {
  const {
    user,
    raw,
    params,
    vue,
    fraicheur,
    nowMs,
    list,
    stats,
    overview,
    teamUsers,
    tags,
    products,
    player,
  } = data;
  const { items, total, page, pageSize, totalPages } = list;
  const isAdmin = user.role === "ADMIN";

  // Si l'admin a sélectionné une commerciale dans le filtre, le bandeau décrit
  // SON portefeuille (nombre d'entreprises attribuées) plutôt que le total global.
  const selectedCommercial =
    isAdmin && params.assigneAId
      ? teamUsers.find((u) => u.id === params.assigneAId)
      : undefined;

  const headerDescription = selectedCommercial
    ? `Portefeuille de ${selectedCommercial.name} · ${formatInt(stats.nbSignes)} client(s) signé(s) · ${formatInt(stats.nbActifs)} en cours de prospection`
    : isAdmin
      ? `Toute la base · ${formatInt(stats.nbSignes)} client(s) signé(s) · ${formatInt(stats.nbActifs)} en cours de prospection`
      : `Ta base de leads · ${formatInt(stats.nbSignes)} client(s) signé(s) · ${formatInt(stats.nbActifs)} en prospection`;

  const plural = stats.total > 1;
  const eyebrow = selectedCommercial
    ? `Portefeuille · ${selectedCommercial.name}`
    : isAdmin
      ? "Toute la base"
      : "Ton territoire";
  const totalSuffix = selectedCommercial
    ? `entreprise${plural ? "s" : ""} attribuée${plural ? "s" : ""}`
    : isAdmin
      ? `entreprise${plural ? "s" : ""} dans la base`
      : `entreprise${plural ? "s" : ""} dans ton secteur`;

  // Statut unique sélectionné → étape active de l'entonnoir.
  const activeStatut = params.statut.length === 1 ? params.statut[0] : null;

  const viewCounts = { toutes: stats.total, ...overview.vues };
  const listTitle = activeStatut ? STATUT_META[activeStatut].label : VUE_META[vue].label;
  const shown = items.length;
  const listSummary = `${formatInt(shown)} fiche${shown > 1 ? "s" : ""} affichée${shown > 1 ? "s" : ""} · ${formatInt(total)} au total · tri par ${SORT_LABEL[params.sortBy] ?? params.sortBy}`;

  const exportHref = `/api/prospects/export?${new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "" && v !== null)
      .map(([k, v]) => [k, String(v)]),
  ).toString()}`;

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Entreprises"
        rubrique="leads"
        description={headerDescription}
        actions={
          <>
            {isAdmin && (
              <>
                {pendingMergeCount > 0 && (
                  <Link
                    href="/prospects/fusions"
                    className={cn(buttonVariants({ variant: "outline" }), "border-gold-500 bg-gold-50 text-gold-700 hover:bg-gold-100")}
                  >
                    <GitMerge aria-hidden="true" />
                    Fusions à valider ({formatInt(pendingMergeCount)})
                  </Link>
                )}
                <Link href="/prospects/tags" className={cn(buttonVariants({ variant: "outline" }))}>
                  <Sparkles aria-hidden="true" />
                  Gérer les tags
                </Link>
                <a href={exportHref} download className={cn(buttonVariants({ variant: "outline" }))}>
                  <FileSpreadsheet aria-hidden="true" />
                  Export CSV
                </a>
                <Link href="/prospects/import" className={cn(buttonVariants({ variant: "outline" }))}>
                  <Upload aria-hidden="true" />
                  Importer CSV
                </Link>
              </>
            )}
            <Link href="/prospects/nouveau" className={cn(buttonVariants({ variant: "default" }))}>
              <Plus aria-hidden="true" />
              Nouvelle entreprise
            </Link>
          </>
        }
      />

      <LeadsHero
        eyebrow={eyebrow}
        total={stats.total}
        totalSuffix={totalSuffix}
        overview={overview}
        goalAppels={player.goalAppels}
        goalRdv={player.goalRdv}
        hrefChaudes={prospectsHref(raw, (sp) => {
          sp.set("vue", "chaudes");
          sp.delete("statut");
        })}
        hrefJamais={prospectsHref(raw, (sp) => {
          sp.set("vue", "jamais");
          sp.delete("statut");
        })}
        nowMs={nowMs}
      />

      <LeadsFunnel
        byStatut={stats.byStatut}
        activeStatut={activeStatut}
        raw={raw}
        nbSignes={stats.nbSignes}
        nbActifs={stats.nbActifs}
      />

      <section
        aria-label="Filtres et vues"
        className="mb-6 flex flex-col gap-4 rounded-[20px] border border-border bg-card p-4 shadow-arena sm:p-5"
      >
        <LeadsViews active={vue} counts={viewCounts} raw={raw} />
        <ProspectFilters
          params={params}
          users={teamUsers}
          currentUserId={user.id}
          tags={tags}
          products={products}
          fraicheur={fraicheur}
        />
      </section>

      <section
        aria-labelledby="liste-titre"
        className="overflow-hidden rounded-[20px] border border-border bg-card shadow-arena"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-4 pt-4 pb-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-info-50 text-info-700"
            >
              <Building2 className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <h2
                id="liste-titre"
                className="font-display text-lg leading-tight font-extrabold tracking-[-0.02em] sm:text-xl"
              >
                {isAdmin ? "Les leads" : "Tes leads"} · {listTitle}
              </h2>
              <p className="text-[13px] font-medium text-muted-foreground">{listSummary}</p>
            </div>
          </div>
          <ul
            aria-label="Légende de la dernière action"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-muted-foreground"
          >
            {FRESH_LEGEND.map((f) => (
              <li key={f.key} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={cn("size-2 rounded-full", f.dotClass)} />
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        <ProspectsTable
          rows={items}
          nowMs={nowMs}
          teamUsers={teamUsers}
          showBulkActions={isAdmin}
          resetHref="/prospects"
          sortBy={params.sortBy}
          sortDir={params.sortDir}
        />

        <div className="border-t border-border px-3 py-3.5 sm:px-4">
          <ProspectsPagination
            current={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
          />
        </div>
      </section>

      <p className="mt-4 text-center text-xs font-medium text-muted-foreground">
        Cette liste inclut tous les statuts (prospects et clients signés). Clique une étape de
        l&apos;entonnoir ou utilise le filtre <strong>Statut</strong> pour cibler une étape précise.
      </p>
    </div>
  );
}
