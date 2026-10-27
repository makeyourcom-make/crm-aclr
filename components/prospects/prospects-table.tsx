"use client";

/**
 * Liste des entreprises : tableau sur grand écran, cartes sur
 * téléphone. Pastille de statut colorée, chaleur du lead (flamme + jauge),
 * dernière action avec point de fraîcheur, prochaine action (planifiée ou
 * conseillée), coordonnées cliquables et bouton « Appeler » (suivi d'appel
 * du CRM). Sélection multiple + barre d'actions pour l'admin.
 */
import { Building2, ChevronsUpDown, ArrowDown, ArrowUp, Flame, Mail } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/arena";
import { BulkReassignBar } from "@/components/prospects/bulk-reassign-bar";
import { ProspectStatutBadge } from "@/components/prospects/prospect-statut-badge";
import { normalizePhone } from "@/lib/format";
import { getProspectSecteurLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

import type { ProspectListItem } from "@/lib/queries/prospects";

import { CallButton } from "./call-button";
import {
  computeLeadHeat,
  freshnessOf,
  nextBestAction,
  type LeadHeat,
  type NextAction,
  type Freshness,
} from "./lead-heat";
import { TAG_COLOR_CLASSES } from "./tag-colors";
import { fmtDate, fmtDayMonth } from "./zurich-format";

/** Ligne de la liste : prospect + tags + deal ouvert + prochaine action planifiée. */
export type ProspectRow = ProspectListItem;

interface ProspectsTableProps {
  rows: ProspectRow[];
  /** Horloge du rendu serveur (chaleur / fraîcheur identiques à l'hydratation). */
  nowMs: number;
  /** Si fourni : active la sélection multiple + barre d'action admin. */
  teamUsers?: Array<{ id: string; name: string }>;
  /** Si true, affiche les checkboxes de sélection. */
  showBulkActions?: boolean;
  /** Lien « Réinitialiser » de l'état vide. */
  resetHref?: string;
  /**
   * Tri EFFECTIF de la liste (une vue rapide peut imposer un tri par défaut
   * absent de l'URL) : sert à marquer l'en-tête actif et le sens suivant.
   */
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

const TONE_TEXT: Record<string, string> = {
  coral: "text-coral-600",
  navy: "text-foreground",
  green: "text-win-700",
  gold: "text-gold-700",
  blue: "text-info-700",
  violet: "text-lvl-700",
  teal: "text-mail-700",
  red: "text-alert-700",
};

interface Derived {
  heat: LeadHeat;
  fresh: Freshness;
  next: NextAction;
  contact: string;
  phone: string | null;
  /** Fixe à afficher (null s'il est absent ou identique au mobile). */
  fixe: string | null;
}

function derive(p: ProspectRow, nowMs: number): Derived {
  const hasOpenDeal = p.deals.length > 0;
  const heat = computeLeadHeat(
    {
      statut: p.statut,
      derniereActionLe: p.derniereActionLe,
      dateRdvLe: p.dateRdvLe,
      hasOpenDeal,
    },
    nowMs,
  );
  const next = nextBestAction(
    {
      statut: p.statut,
      derniereActionLe: p.derniereActionLe,
      dernierAppelLe: p.dernierAppelLe,
      dateRdvLe: p.dateRdvLe,
      contratDebutLe: p.contratDebutLe,
      hasOpenDeal,
      hasPhone: !!(p.telephone || p.telephoneMobile),
      hasEmail: !!p.email,
      nextPlanned: p.activities[0] ?? null,
    },
    nowMs,
  );
  // Fixe et mobile identiques (fréquent dans les imports) : un seul numéro.
  const sameNumber =
    !!p.telephone &&
    !!p.telephoneMobile &&
    (normalizePhone(p.telephone) ?? p.telephone) ===
      (normalizePhone(p.telephoneMobile) ?? p.telephoneMobile);
  return {
    heat,
    fresh: freshnessOf(p.derniereActionLe, nowMs),
    next,
    contact: [p.contactPrenom, p.contactNom].filter(Boolean).join(" "),
    phone: p.telephoneMobile || p.telephone || null,
    fixe: sameNumber ? null : p.telephone,
  };
}

/** En-tête de colonne triable : clic → met à jour ?sortBy & ?sortDir. */
function SortableHeader({
  field,
  label,
  sortBy,
  sortDir,
}: {
  field: string;
  label: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const curBy = sortBy ?? searchParams.get("sortBy") ?? "createdAt";
  const curDir = sortDir ?? searchParams.get("sortDir") ?? "desc";
  const active = curBy === field;
  const nextDir = active && curDir === "asc" ? "desc" : "asc";
  const onClick = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("sortBy", field);
    sp.set("sortDir", nextDir);
    sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  };
  const Icon = !active ? ChevronsUpDown : curDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
      )}
      title={`Trier par ${label.toLowerCase()}`}
    >
      {label}
      <Icon aria-hidden="true" className="size-3" strokeWidth={2.5} />
      {active && (
        <span className="sr-only">
          {curDir === "asc" ? " (tri croissant)" : " (tri décroissant)"}
        </span>
      )}
    </button>
  );
}

function HeatCell({ heat }: { heat: LeadHeat }) {
  const aria =
    heat.kind === "client"
      ? "Client signé"
      : `Chaleur ${heat.label.toLowerCase()}, score ${heat.score} sur 100`;
  return (
    <span role="img" aria-label={aria} className="flex min-w-0 flex-col gap-1">
      <span className={cn("flex items-center gap-1 text-xs font-extrabold", heat.textClass)}>
        <Flame
          aria-hidden="true"
          className="size-3.5 shrink-0"
          style={{ color: heat.hex, fill: heat.level >= 4 || heat.kind === "client" ? heat.hex : "none" }}
        />
        {heat.label}
      </span>
      <span className="block h-1.5 w-full max-w-[84px] overflow-hidden rounded-full bg-navy-50">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(6, heat.score)}%`, background: heat.hex }}
        />
      </span>
    </span>
  );
}

function LastActionCell({
  p,
  fresh,
  nowMs,
}: {
  p: ProspectRow;
  fresh: Freshness;
  nowMs: number;
}) {
  // dernierAppelLe = date du dernier appel, rappels PLANIFIÉS compris : une
  // date future est un rappel prévu, pas un appel passé.
  const call = p.dernierAppelLe;
  const planned = call !== null && call.getTime() > nowMs;
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span
        className={cn(
          "truncate text-[13px] font-semibold",
          call ? (planned ? "text-info-700" : "text-foreground") : "text-coral-600",
        )}
      >
        {!call
          ? "Jamais appelée"
          : planned
            ? `Rappel prévu le ${fmtDayMonth(call)}`
            : `Appel le ${fmtDate(call)}`}
      </span>
      <span
        className={cn("flex items-center gap-1.5 text-xs font-bold", fresh.textClass)}
        title={p.derniereActionLe ? `Dernière action le ${fmtDate(p.derniereActionLe)}` : undefined}
      >
        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", fresh.dotClass)} />
        {fresh.label}
      </span>
    </span>
  );
}

/**
 * Dates de référence de la fiche (anciennes colonnes « Date RDV »,
 * « Début contrat » et « Date d'ajout » du tableau historique) : toujours
 * visibles, notamment quand la liste est triée sur l'une d'elles.
 */
function DatesLine({ p, nowMs }: { p: ProspectRow; nowMs: number }) {
  const parts: string[] = [];
  if (p.dateRdvLe) {
    parts.push(
      p.dateRdvLe.getTime() > nowMs
        ? `RDV le ${fmtDate(p.dateRdvLe)}`
        : `Dernier RDV le ${fmtDate(p.dateRdvLe)}`,
    );
  }
  if (p.contratDebutLe) parts.push(`Contrat dès le ${fmtDate(p.contratDebutLe)}`);
  parts.push(`Ajoutée le ${fmtDate(p.createdAt)}`);
  return (
    <span className="block truncate text-[11px] font-medium text-muted-foreground tabular-nums">
      {parts.join(" · ")}
    </span>
  );
}

function Tags({ p }: { p: ProspectRow }) {
  if (!p.tags || p.tags.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1 pt-1">
      {p.tags.map((t) => (
        <span
          key={t.tag.id}
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold",
            TAG_COLOR_CLASSES[t.tag.couleur] ?? TAG_COLOR_CLASSES.slate,
          )}
        >
          {t.tag.nom}
        </span>
      ))}
    </span>
  );
}

export function ProspectsTable({
  rows,
  nowMs,
  teamUsers = [],
  showBulkActions = false,
  resetHref = "/prospects",
  sortBy,
  sortDir,
}: ProspectsTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allRowsIds = rows.map((r) => r.id);
  const allChecked =
    rows.length > 0 && allRowsIds.every((id) => selectedIds.includes(id));
  const someChecked = selectedIds.length > 0 && !allChecked;

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? allRowsIds : []);
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };

  const items = rows.map((p) => ({ p, d: derive(p, nowMs) }));

  /** Clic sur une ligne (hors éléments interactifs) → ouvre la fiche. */
  const openRow = (e: React.MouseEvent<HTMLElement>, id: string) => {
    const target = e.target as HTMLElement;
    if (target.closest("a,button,input,label,select,textarea")) return;
    if (window.getSelection()?.toString()) return;
    router.push(`/prospects/${id}`);
  };

  if (rows.length === 0) {
    return (
      <div className="p-4 sm:p-5">
        <EmptyState
          icon={Building2}
          title="Aucune entreprise ne colle à ces filtres"
          description="Élargis la recherche ou repars de la vue « Les plus chaudes »."
          action={
            <Link
              href={resetHref}
              className="inline-flex h-11 items-center rounded-[12px] bg-navy-700 px-4 text-sm font-bold text-white hover:bg-navy-600"
            >
              Réinitialiser les filtres
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <>
      {showBulkActions && (
        <div className="px-4 sm:px-5">
          <BulkReassignBar
            selectedIds={selectedIds}
            teamUsers={teamUsers}
            onCancel={() => setSelectedIds([])}
            onSuccess={() => setSelectedIds([])}
            isAdmin={showBulkActions}
          />
        </div>
      )}

      {/* Vue CARTES : téléphone et tablette */}
      <ul className="flex flex-col divide-y divide-border border-t border-border lg:hidden">
        {showBulkActions && (
          <li className="flex items-center gap-2.5 bg-ground px-4 py-2.5">
            <input
              type="checkbox"
              checked={allChecked}
              ref={(el) => {
                if (el) el.indeterminate = someChecked;
              }}
              onChange={(e) => toggleAll(e.target.checked)}
              className="size-4 cursor-pointer accent-[#0E1936]"
              aria-label="Tout sélectionner"
              id="prospects-select-all-mobile"
            />
            <label
              htmlFor="prospects-select-all-mobile"
              className="text-xs font-bold text-muted-foreground"
            >
              Tout sélectionner
            </label>
          </li>
        )}
        {items.map(({ p, d }) => {
          const lieu = [p.ville, p.canton].filter(Boolean).join(", ");
          const dead = d.heat.kind === "out";
          return (
            <li
              key={p.id}
              className={cn(
                "flex flex-col gap-2.5 px-4 py-3.5",
                d.heat.hot && "shadow-[inset_4px_0_0_#F47174]",
              )}
            >
              <div className="flex items-start gap-3">
                {showBulkActions && (
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={(e) => toggleOne(p.id, e.target.checked)}
                    className="mt-1 size-4 shrink-0 cursor-pointer accent-[#0E1936]"
                    aria-label={`Sélectionner ${p.raisonSociale}`}
                  />
                )}
                <Link href={`/prospects/${p.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-extrabold text-foreground">
                    {p.raisonSociale}
                  </span>
                  {(lieu || d.contact) && (
                    <span className="block truncate text-xs font-semibold text-muted-foreground">
                      {[lieu, d.contact].filter(Boolean).join(" · ")}
                      {p.contactFonction ? ` (${p.contactFonction})` : ""}
                    </span>
                  )}
                  {p.secteur && (
                    <span className="block truncate text-[11px] font-medium text-muted-foreground">
                      {getProspectSecteurLabel(p.secteur)}
                    </span>
                  )}
                  <DatesLine p={p} nowMs={nowMs} />
                </Link>
                <ProspectStatutBadge statut={p.statut} />
              </div>

              <Tags p={p} />

              <div className="grid grid-cols-2 gap-3">
                <HeatCell heat={d.heat} />
                <LastActionCell p={p} fresh={d.fresh} nowMs={nowMs} />
              </div>

              <p
                className={cn(
                  "rounded-[10px] bg-ground px-3 py-2 text-[13px] leading-snug font-bold",
                  TONE_TEXT[d.next.tone] ?? "text-foreground",
                )}
              >
                <span className="sr-only">Prochaine action : </span>
                {d.next.short}
              </p>

              {(p.telephone || p.telephoneMobile || p.email) && (
                <div className="flex flex-wrap items-center gap-2">
                  {d.phone && (
                    <CallButton
                      prospectId={p.id}
                      prospectRaisonSociale={p.raisonSociale}
                      numero={d.phone}
                      variant="icon"
                      hot={d.heat.hot}
                      muted={dead}
                      className="size-11"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col text-xs">
                    {p.telephoneMobile && (
                      <CallButton
                        prospectId={p.id}
                        prospectRaisonSociale={p.raisonSociale}
                        numero={p.telephoneMobile}
                        variant="inline"
                        className="py-0.5"
                      />
                    )}
                    {d.fixe && (
                      <CallButton
                        prospectId={p.id}
                        prospectRaisonSociale={p.raisonSociale}
                        numero={d.fixe}
                        variant="inline"
                        className="py-0.5"
                      />
                    )}
                  </div>
                  {p.email && (
                    <a
                      href={`mailto:${p.email}`}
                      aria-label={`Écrire à ${p.email}`}
                      title={p.email}
                      className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-mail-50 text-mail-700 hover:brightness-95"
                    >
                      <Mail aria-hidden="true" className="size-[18px]" />
                    </a>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Vue TABLEAU : grand écran */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="border-y border-border bg-ground text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              {showBulkActions && (
                <th scope="col" className="w-10 py-2.5 pl-5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked;
                    }}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="size-4 cursor-pointer accent-[#0E1936]"
                    aria-label="Tout sélectionner"
                  />
                </th>
              )}
              <th scope="col" className={cn("py-2.5 pr-3", showBulkActions ? "pl-2" : "pl-5")}>
                <SortableHeader sortBy={sortBy} sortDir={sortDir} field="raisonSociale" label="Entreprise · contact" />
              </th>
              <th scope="col" className="w-[150px] px-3 py-2.5">
                <SortableHeader sortBy={sortBy} sortDir={sortDir} field="statut" label="Statut" />
              </th>
              <th scope="col" className="w-[104px] px-3 py-2.5">
                Chaleur
              </th>
              <th scope="col" className="w-[170px] px-3 py-2.5">
                Coordonnées
              </th>
              <th scope="col" className="w-[160px] px-3 py-2.5">
                <SortableHeader sortBy={sortBy} sortDir={sortDir} field="derniereActionLe" label="Dernière action" />
              </th>
              <th scope="col" className="w-[190px] px-3 py-2.5">
                Prochaine action
              </th>
              <th scope="col" className="w-14 py-2.5 pr-5 pl-2">
                <span className="sr-only">Appeler</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ p, d }) => {
              const lieu = [p.ville, p.canton].filter(Boolean).join(", ");
              const checked = selectedIds.includes(p.id);
              return (
                <tr
                  key={p.id}
                  onClick={(e) => openRow(e, p.id)}
                  className={cn(
                    "cursor-pointer border-b border-border align-middle transition-colors hover:bg-navy-50/60",
                    checked && "bg-info-50/60",
                    d.heat.hot && "shadow-[inset_4px_0_0_#F47174]",
                  )}
                >
                  {showBulkActions && (
                    <td className="py-3 pl-5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleOne(p.id, e.target.checked)}
                        className="size-4 cursor-pointer accent-[#0E1936]"
                        aria-label={`Sélectionner ${p.raisonSociale}`}
                      />
                    </td>
                  )}
                  <td className={cn("max-w-0 py-3 pr-3", showBulkActions ? "pl-2" : "pl-5")}>
                    <Link
                      href={`/prospects/${p.id}`}
                      title={p.raisonSociale}
                      className="block truncate text-sm font-extrabold text-foreground hover:underline"
                    >
                      {p.raisonSociale}
                    </Link>
                    {(lieu || d.contact) && (
                      <span className="mt-0.5 block truncate text-xs font-semibold text-muted-foreground">
                        {[lieu, d.contact].filter(Boolean).join(" · ")}
                        {p.contactFonction ? ` (${p.contactFonction})` : ""}
                      </span>
                    )}
                    {p.secteur && (
                      <span className="block truncate text-[11px] font-medium text-muted-foreground">
                        {getProspectSecteurLabel(p.secteur)}
                      </span>
                    )}
                    <DatesLine p={p} nowMs={nowMs} />
                    <Tags p={p} />
                  </td>
                  <td className="px-3 py-3">
                    <ProspectStatutBadge statut={p.statut} />
                  </td>
                  <td className="px-3 py-3">
                    <HeatCell heat={d.heat} />
                  </td>
                  <td className="max-w-0 px-3 py-3 text-xs">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      {d.fixe && (
                        <CallButton
                          prospectId={p.id}
                          prospectRaisonSociale={p.raisonSociale}
                          numero={d.fixe}
                          variant="inline"
                          className="whitespace-nowrap"
                        />
                      )}
                      {p.telephoneMobile && (
                        <CallButton
                          prospectId={p.id}
                          prospectRaisonSociale={p.raisonSociale}
                          numero={p.telephoneMobile}
                          variant="inline"
                          className="whitespace-nowrap"
                        />
                      )}
                      {p.email ? (
                        <a
                          href={`mailto:${p.email}`}
                          title={p.email}
                          className="truncate font-medium text-foreground hover:underline"
                        >
                          {p.email}
                        </a>
                      ) : null}
                      {!p.telephone && !p.telephoneMobile && !p.email && (
                        <span className="font-semibold text-gold-700">À compléter</span>
                      )}
                    </span>
                  </td>
                  <td className="max-w-0 px-3 py-3">
                    <LastActionCell p={p} fresh={d.fresh} nowMs={nowMs} />
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "line-clamp-2 text-[13px] leading-snug font-bold",
                        TONE_TEXT[d.next.tone] ?? "text-foreground",
                      )}
                    >
                      {d.next.short}
                    </span>
                  </td>
                  <td className="py-3 pr-5 pl-2">
                    {d.phone ? (
                      <CallButton
                        prospectId={p.id}
                        prospectRaisonSociale={p.raisonSociale}
                        numero={d.phone}
                        variant="icon"
                        hot={d.heat.hot}
                        muted={d.heat.kind === "out"}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
