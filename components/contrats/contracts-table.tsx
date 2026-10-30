"use client";

/**
 * Liste des contrats : cartes sur téléphone, tableau triable sur
 * ordinateur (en-têtes cliquables → ?sortBy / ?sortDir, ligne cliquable vers
 * la fiche contrat).
 */
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { StatusPill } from "@/components/arena/pills";
import { PlayerAvatar, toneForRole } from "@/components/arena/player-avatar";
import type { Tone } from "@/components/arena/tones";
import { SortableHeader } from "@/components/common/sortable-header";
import { ContractStatutBadge } from "@/components/contrats/contract-statut-badge";
import { DataTable } from "@/components/ui/data-table";
import { getNextRenewalDate, relativeDays } from "@/lib/contract-renewal";
import { formatCHF, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ContractListItem } from "@/lib/queries/contracts";

interface ContractsTableProps {
  rows: ContractListItem[];
  showCommerciale?: boolean;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Valeur RÉELLE du contrat sur sa durée (one-shot + mensuel × durée).
 * Définition unique du CA dans tout le CRM (cf. objectifs, dashboard) : on
 * n'annualise PAS les contrats de moins de 12 mois.
 */
function valeurTotaleContrat(c: {
  montantOneShot: unknown;
  montantMensuel: unknown;
  dureeMois: number;
}): number {
  return Number(c.montantOneShot) + Number(c.montantMensuel) * c.dureeMois;
}

/** Palier de valeur an 1 (repère de jeu, données réelles). */
function palierOf(an1: number): { label: string; tone: Tone } {
  if (an1 >= 10000) return { label: "Diamant", tone: "violet" };
  if (an1 >= 5000) return { label: "Or", tone: "gold" };
  if (an1 >= 2000) return { label: "Argent", tone: "blue" };
  return { label: "Bronze", tone: "navy" };
}

function offresOf(c: ContractListItem): string {
  const names = c.products.map((p) => p.nom);
  if (names.length === 0) return "Aucune offre liée";
  if (names.length <= 2) return names.join(" · ");
  return `${names.slice(0, 2).join(" · ")} +${names.length - 2}`;
}

function RenewalCell({ c }: { c: ContractListItem }) {
  const renewal = getNextRenewalDate({
    dateDebut: c.dateDebut,
    dureeMois: c.dureeMois,
    statut: c.statut,
    reconductible: c.reconductible,
    reconductionAuto: c.reconductionAuto,
  });
  if (!renewal) {
    return <span className="text-[13px] text-muted-foreground">-</span>;
  }
  const rel = relativeDays(renewal);
  const tone =
    rel.days < 30
      ? "font-bold text-gold-700"
      : rel.days < 90
        ? "font-semibold text-foreground"
        : "text-muted-foreground";
  return (
    <span className={cn("flex flex-col text-[13px] whitespace-nowrap", tone)}>
      <span>{formatDate(renewal)}</span>
      <span className="text-xs">{rel.label}</span>
    </span>
  );
}

export function ContractsTable({ rows, showCommerciale }: ContractsTableProps) {
  const columns: ColumnDef<ContractListItem>[] = [
    {
      id: "contrat",
      header: () => (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <SortableHeader label="N°" field="numero" defaultSortBy="dateSignature" />
          <span aria-hidden="true" className="text-subtle">
            ·
          </span>
          <SortableHeader
            label="Client"
            field="raisonSociale"
            defaultSortBy="dateSignature"
          />
        </span>
      ),
      cell: ({ row }) => {
        const c = row.original;
        const palier = palierOf(Number(c.valeurAn1));
        return (
          <div className="flex min-w-[220px] items-center gap-2.5">
            <PlayerAvatar
              initials={initialsOf(c.assigneA.name)}
              tone={toneForRole(c.assigneA.role)}
              size={30}
              label={c.assigneA.name}
            />
            <div className="min-w-0">
              <Link
                href={`/contrats/${c.id}`}
                className="block text-xs font-bold text-muted-foreground tabular-nums hover:text-foreground hover:underline"
              >
                {c.numero}
              </Link>
              <Link
                href={`/prospects/${c.prospect.id}`}
                className="block truncate text-sm font-extrabold text-foreground hover:underline"
              >
                {c.prospect.raisonSociale}
              </Link>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {c.prospect.ville && <span>{c.prospect.ville}</span>}
                <StatusPill tone={palier.tone} dot={false} className="h-5 px-2 text-[11px]">
                  Palier {palier.label}
                </StatusPill>
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "offres",
      header: () => (
        <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Offres · durée
        </span>
      ),
      cell: ({ row }) => (
        <div className="flex min-w-[160px] max-w-[260px] flex-col">
          <span className="truncate text-[13px] font-semibold">{offresOf(row.original)}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.dureeMois} mois
          </span>
        </div>
      ),
    },
    {
      id: "valeurAn1",
      header: () => (
        <SortableHeader
          label="Valeur contrat"
          field="valeurAn1"
          defaultSortBy="dateSignature"
          defaultDir="desc"
        />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-display text-[15px] font-extrabold whitespace-nowrap tabular-nums">
            {formatCHF(valeurTotaleContrat(row.original))}
          </span>
          <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
            sur {row.original.dureeMois} mois
          </span>
        </div>
      ),
    },
    {
      id: "mensuel",
      header: () => (
        <SortableHeader
          label="Mensuel"
          field="montantMensuel"
          defaultSortBy="dateSignature"
          defaultDir="desc"
        />
      ),
      cell: ({ row }) => (
        <span className="text-[13px] font-semibold whitespace-nowrap tabular-nums">
          {Number(row.original.montantMensuel) > 0
            ? `${formatCHF(Number(row.original.montantMensuel))} / mois`
            : "-"}
        </span>
      ),
    },
    {
      id: "dateSignature",
      header: () => (
        <SortableHeader
          label="Signé le"
          field="dateSignature"
          defaultSortBy="dateSignature"
          defaultDir="desc"
        />
      ),
      cell: ({ row }) => (
        <span className="text-[13px] whitespace-nowrap">
          {formatDate(row.original.dateSignature)}
        </span>
      ),
    },
    {
      id: "renewal",
      header: () => (
        <span className="text-[11px] font-bold tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase">
          Renouvel.
        </span>
      ),
      cell: ({ row }) => <RenewalCell c={row.original} />,
    },
    {
      id: "statut",
      header: () => (
        <SortableHeader label="Statut" field="statut" defaultSortBy="dateSignature" />
      ),
      cell: ({ row }) => <ContractStatutBadge statut={row.original.statut} />,
    },
    ...(showCommerciale
      ? [
          {
            id: "commerciale",
            header: () => (
              <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                Commerciale
              </span>
            ),
            cell: ({ row }) => (
              <span className="text-[13px] whitespace-nowrap text-muted-foreground">
                {row.original.assigneA.name}
              </span>
            ),
          } as ColumnDef<ContractListItem>,
        ]
      : []),
  ];

  return (
    <>
      {/* Vue CARTES sur mobile */}
      <ul className="flex flex-col gap-2.5 md:hidden">
        {rows.length === 0 ? (
          <li className="rounded-[14px] border border-dashed border-border-strong px-4 py-10 text-center text-sm font-semibold text-muted-foreground">
            Aucun contrat ne correspond. Essaie un autre filtre.
          </li>
        ) : (
          rows.map((c) => {
            const renewal = getNextRenewalDate({
              dateDebut: c.dateDebut,
              dureeMois: c.dureeMois,
              statut: c.statut,
              reconductible: c.reconductible,
              reconductionAuto: c.reconductionAuto,
            });
            const palier = palierOf(Number(c.valeurAn1));
            return (
              <li
                key={c.id}
                className="rounded-[14px] border border-border bg-card p-3.5"
              >
                <div className="flex items-start gap-2.5">
                  <PlayerAvatar
                    initials={initialsOf(c.assigneA.name)}
                    tone={toneForRole(c.assigneA.role)}
                    size={30}
                    label={c.assigneA.name}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/contrats/${c.id}`}
                      className="block truncate text-[15px] font-extrabold text-foreground hover:underline"
                    >
                      {c.prospect.raisonSociale}
                    </Link>
                    <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                      {c.numero}
                      {c.prospect.ville ? ` · ${c.prospect.ville}` : ""}
                    </p>
                  </div>
                  <ContractStatutBadge statut={c.statut} />
                </div>
                <p className="mt-2 truncate text-[13px] font-semibold">{offresOf(c)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                  <span className="tabular-nums">
                    <span className="text-muted-foreground">Valeur </span>
                    <span className="font-extrabold">{formatCHF(valeurTotaleContrat(c))}</span>
                    <span className="text-muted-foreground"> · {c.dureeMois} m</span>
                  </span>
                  {Number(c.montantMensuel) > 0 && (
                    <span className="font-semibold tabular-nums">
                      {formatCHF(Number(c.montantMensuel))} / mois
                    </span>
                  )}
                  <StatusPill tone={palier.tone} dot={false} className="h-5 px-2 text-[11px]">
                    Palier {palier.label}
                  </StatusPill>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Signé le {formatDate(c.dateSignature)}
                  {renewal
                    ? ` · renouvel. ${formatDate(renewal)} (${relativeDays(renewal).label})`
                    : ""}
                  {showCommerciale ? ` · ${c.assigneA.name}` : ""}
                </p>
                <Link
                  href={`/prospects/${c.prospect.id}`}
                  className="mt-2 inline-flex h-9 items-center text-[13px] font-bold text-info-700 underline-offset-2 hover:underline"
                >
                  Fiche entreprise
                </Link>
              </li>
            );
          })
        )}
      </ul>

      {/* Vue TABLEAU sur ordinateur */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage="Aucun contrat ne correspond. Essaie un autre filtre."
          getRowHref={(c) => `/contrats/${c.id}`}
          className="rounded-[16px] [&_tbody_tr:hover]:bg-navy-50/70 [&_thead]:bg-ground/80"
        />
      </div>
    </>
  );
}
