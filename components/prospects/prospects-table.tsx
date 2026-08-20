"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { BulkReassignBar } from "@/components/prospects/bulk-reassign-bar";
import { ClickToCall } from "@/components/call/click-to-call";
import { DataTable } from "@/components/ui/data-table";
import { ProspectStatutBadge } from "@/components/prospects/prospect-statut-badge";
import { getProspectSecteurLabel } from "@/lib/labels";
import { formatDate } from "@/lib/format";

import type { Prospect } from "@prisma/client";

// Couleur Tailwind du badge (synchronisé avec tags-manager.tsx)
const TAG_COLOR_CLASSES: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-800",
  emerald: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-800",
  purple: "bg-purple-100 text-purple-800",
  cyan: "bg-cyan-100 text-cyan-800",
  orange: "bg-orange-100 text-orange-800",
};

/**
 * Row de prospect enrichie avec ses tags pour l'affichage en table.
 * Le getProspects() retourne maintenant les tags via include.
 */
export type ProspectRow = Prospect & {
  tags?: Array<{
    tag: { id: string; nom: string; couleur: string };
  }>;
};

interface ProspectsTableProps {
  rows: ProspectRow[];
  /** Si fourni : active la sélection multiple + barre d'action admin. */
  teamUsers?: Array<{ id: string; name: string }>;
  /** Si true, affiche les checkboxes de sélection. */
  showBulkActions?: boolean;
}

/** En-tête de colonne triable : clic → met à jour ?sortBy & ?sortDir. */
function SortableHeader({ field, label }: { field: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const curBy = searchParams.get("sortBy") ?? "createdAt";
  const curDir = searchParams.get("sortDir") ?? "desc";
  const active = curBy === field;
  const nextDir = active && curDir === "asc" ? "desc" : "asc";
  const onClick = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("sortBy", field);
    sp.set("sortDir", nextDir);
    sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:text-foreground"
      title={`Trier par ${label}`}
    >
      {label}
      <span className="text-[10px] text-muted-foreground">
        {active ? (curDir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

export function ProspectsTable({
  rows,
  teamUsers = [],
  showBulkActions = false,
}: ProspectsTableProps) {
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

  const columns: ColumnDef<ProspectRow>[] = [
    ...(showBulkActions
      ? [
          {
            id: "select",
            header: () => (
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                onChange={(e) => toggleAll(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 cursor-pointer"
                aria-label="Tout sélectionner"
              />
            ),
            size: 36,
            cell: ({ row }) => (
              <input
                type="checkbox"
                checked={selectedIds.includes(row.original.id)}
                onChange={(e) => toggleOne(row.original.id, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 cursor-pointer"
                aria-label={`Sélectionner ${row.original.raisonSociale}`}
              />
            ),
          } as ColumnDef<Prospect>,
        ]
      : []),
    {
      id: "raisonSociale",
      header: () => <SortableHeader field="raisonSociale" label="Raison sociale" />,
      // Largeur bornée : sans `size`, TanStack renvoie 150 (défaut) et la
      // DataTable laisse alors la colonne absorber toute la place restante.
      size: 220,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href={`/prospects/${row.original.id}`}
            title={row.original.raisonSociale}
            className="truncate font-medium text-foreground hover:underline"
          >
            {row.original.raisonSociale}
          </Link>
          {(row.original.contactPrenom || row.original.contactNom) && (
            <span className="truncate text-xs text-muted-foreground">
              {[row.original.contactPrenom, row.original.contactNom]
                .filter(Boolean)
                .join(" ")}
              {row.original.contactFonction
                ? ` · ${row.original.contactFonction}`
                : ""}
            </span>
          )}
          {row.original.tags && row.original.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {row.original.tags.map((t) => (
                <span
                  key={t.tag.id}
                  className={`inline-flex items-center rounded-full px-2 py-0 text-[10px] font-medium ${
                    TAG_COLOR_CLASSES[t.tag.couleur] ?? TAG_COLOR_CLASSES.slate
                  }`}
                >
                  {t.tag.nom}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      // Borne + troncature : un email long (ex. …@hotmail.com) élargissait la
      // colonne sans limite et poussait les dernières colonnes hors écran.
      size: 200,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col text-xs">
          {row.original.email ? (
            <a
              href={`mailto:${row.original.email}`}
              className="truncate text-foreground hover:underline"
              title={row.original.email}
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.email}
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      id: "telephone",
      header: "Téléphone",
      size: 140,
      cell: ({ row }) => (
        <div className="flex flex-col text-xs">
          {row.original.telephone && (
            <ClickToCall
              prospectId={row.original.id}
              prospectRaisonSociale={row.original.raisonSociale}
              numero={row.original.telephone}
              inline
              className="whitespace-nowrap"
            />
          )}
          {row.original.telephoneMobile && (
            <ClickToCall
              prospectId={row.original.id}
              prospectRaisonSociale={row.original.raisonSociale}
              numero={row.original.telephoneMobile}
              inline
              className="whitespace-nowrap"
            />
          )}
          {!row.original.telephone && !row.original.telephoneMobile && (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      id: "lieu",
      header: () => <SortableHeader field="ville" label="Lieu" />,
      size: 130,
      cell: ({ row }) => (
        <span
          className="block truncate text-xs text-muted-foreground"
          title={
            [row.original.ville, row.original.canton]
              .filter(Boolean)
              .join(", ") || undefined
          }
        >
          {[row.original.ville, row.original.canton]
            .filter(Boolean)
            .join(", ") || "—"}
        </span>
      ),
    },
    {
      id: "secteur",
      header: () => <SortableHeader field="secteur" label="Secteur" />,
      size: 110,
      cell: ({ row }) =>
        row.original.secteur ? (
          <span className="block truncate text-xs">
            {getProspectSecteurLabel(row.original.secteur)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "statut",
      header: () => <SortableHeader field="statut" label="Statut" />,
      size: 100,
      cell: ({ row }) => <ProspectStatutBadge statut={row.original.statut} />,
    },
    {
      id: "derniereActionLe",
      header: () => (
        <SortableHeader field="derniereActionLe" label="Dernière action" />
      ),
      cell: ({ row }) =>
        row.original.derniereActionLe ? (
          <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
            {formatDate(row.original.derniereActionLe)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        ),
      size: 120,
    },
    {
      id: "createdAt",
      header: () => <SortableHeader field="createdAt" label="Date d'ajout" />,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
          {formatDate(row.original.createdAt)}
        </span>
      ),
      size: 110,
    },
    {
      // Date de début du contrat en cours (colonne dénormalisée contratDebutLe,
      // maintenue par trigger). Renseignée pour les clients signés ; « — » sinon.
      id: "contratDebutLe",
      header: () => (
        <SortableHeader field="contratDebutLe" label="Début contrat" />
      ),
      cell: ({ row }) =>
        row.original.contratDebutLe ? (
          <span className="whitespace-nowrap text-xs text-foreground tabular-nums">
            {formatDate(row.original.contratDebutLe)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        ),
      size: 110,
    },
  ];

  return (
    <>
      {showBulkActions && (
        <BulkReassignBar
          selectedIds={selectedIds}
          teamUsers={teamUsers}
          onCancel={() => setSelectedIds([])}
          onSuccess={() => setSelectedIds([])}
          isAdmin={showBulkActions}
        />
      )}
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="Aucune entreprise ne correspond aux filtres. Importe un CSV ou crée-en une manuellement."
        getRowHref={(p) => `/prospects/${p.id}`}
      />
    </>
  );
}
