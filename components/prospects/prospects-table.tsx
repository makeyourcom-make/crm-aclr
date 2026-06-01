"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { BulkReassignBar } from "@/components/prospects/bulk-reassign-bar";
import { ClickToCall } from "@/components/call/click-to-call";
import { DataTable } from "@/components/ui/data-table";
import { ProspectStatutBadge } from "@/components/prospects/prospect-statut-badge";
import { getProspectSecteurLabel } from "@/lib/labels";
import { formatRelative } from "@/lib/format";

import type { Prospect } from "@prisma/client";

interface ProspectsTableProps {
  rows: Prospect[];
  /** Si fourni : active la sélection multiple + barre d'action admin. */
  teamUsers?: Array<{ id: string; name: string }>;
  /** Si true, affiche les checkboxes de sélection. */
  showBulkActions?: boolean;
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

  const columns: ColumnDef<Prospect>[] = [
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
      header: "Raison sociale",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <Link
            href={`/prospects/${row.original.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {row.original.raisonSociale}
          </Link>
          {(row.original.contactPrenom || row.original.contactNom) && (
            <span className="text-xs text-muted-foreground">
              {[row.original.contactPrenom, row.original.contactNom]
                .filter(Boolean)
                .join(" ")}
              {row.original.contactFonction
                ? ` · ${row.original.contactFonction}`
                : ""}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: ({ row }) => (
        <div className="flex flex-col text-xs">
          {row.original.email && (
            <a
              href={`mailto:${row.original.email}`}
              className="text-foreground hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.email}
            </a>
          )}
          {row.original.telephone && (
            <ClickToCall
              prospectId={row.original.id}
              prospectRaisonSociale={row.original.raisonSociale}
              numero={row.original.telephone}
              inline
              className="text-muted-foreground"
            />
          )}
        </div>
      ),
    },
    {
      id: "lieu",
      header: "Lieu",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {[row.original.ville, row.original.canton]
            .filter(Boolean)
            .join(", ") || "—"}
        </span>
      ),
    },
    {
      id: "secteur",
      header: "Secteur",
      cell: ({ row }) =>
        row.original.secteur ? (
          <span className="text-xs">
            {getProspectSecteurLabel(row.original.secteur)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "statut",
      header: "Statut",
      cell: ({ row }) => <ProspectStatutBadge statut={row.original.statut} />,
    },
    {
      id: "updatedAt",
      header: "Modifié",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatRelative(row.original.updatedAt)}
        </span>
      ),
      size: 120,
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
