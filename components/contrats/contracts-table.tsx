"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { SortableHeader } from "@/components/common/sortable-header";
import { ContractStatutBadge } from "@/components/contrats/contract-statut-badge";
import { DataTable } from "@/components/ui/data-table";
import { getNextRenewalDate, relativeDays } from "@/lib/contract-renewal";
import { formatCHF, formatDate } from "@/lib/format";

import type { ContractListItem } from "@/lib/queries/contracts";

interface ContractsTableProps {
  rows: ContractListItem[];
  showCommerciale?: boolean;
}

export function ContractsTable({ rows, showCommerciale }: ContractsTableProps) {
  const columns: ColumnDef<ContractListItem>[] = [
    {
      id: "numero",
      header: () => (
        <SortableHeader
          label="N° contrat"
          field="numero"
          defaultSortBy="dateSignature"
        />
      ),
      cell: ({ row }) => (
        <Link
          href={`/contrats/${row.original.id}`}
          className="font-mono text-xs font-medium text-foreground hover:underline"
        >
          {row.original.numero}
        </Link>
      ),
    },
    {
      id: "prospect",
      header: () => (
        <SortableHeader
          label="Client"
          field="raisonSociale"
          defaultSortBy="dateSignature"
        />
      ),
      cell: ({ row }) => (
        <div>
          <Link
            href={`/prospects/${row.original.prospect.id}`}
            className="font-medium hover:underline"
          >
            {row.original.prospect.raisonSociale}
          </Link>
          {row.original.prospect.ville && (
            <p className="text-xs text-muted-foreground">
              {row.original.prospect.ville}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "valeurAn1",
      header: () => (
        <SortableHeader
          label="Valeur an 1"
          field="valeurAn1"
          defaultSortBy="dateSignature"
          defaultDir="desc"
        />
      ),
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">
          {formatCHF(Number(row.original.valeurAn1))}
        </span>
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
        <span className="text-xs text-muted-foreground tabular-nums">
          {Number(row.original.montantMensuel) > 0
            ? `${formatCHF(Number(row.original.montantMensuel))}/mois`
            : "—"}
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
        <span className="whitespace-nowrap text-xs">
          {formatDate(row.original.dateSignature)}
        </span>
      ),
    },
    {
      id: "renewal",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Prochain renouvel.
        </span>
      ),
      cell: ({ row }) => {
        const renewal = getNextRenewalDate({
          dateDebut: row.original.dateDebut,
          dureeMois: row.original.dureeMois,
          statut: row.original.statut,
        });
        if (!renewal) return <span className="text-xs text-muted-foreground">—</span>;
        const rel = relativeDays(renewal);
        const tone =
          rel.days < 30
            ? "text-amber-700 font-medium"
            : rel.days < 90
              ? "text-foreground"
              : "text-muted-foreground";
        return (
          <span className={`whitespace-nowrap text-xs ${tone}`}>
            {formatDate(renewal)}
            <span className="ml-1 opacity-70">({rel.label})</span>
          </span>
        );
      },
    },
    {
      id: "statut",
      header: () => (
        <SortableHeader
          label="Statut"
          field="statut"
          defaultSortBy="dateSignature"
        />
      ),
      cell: ({ row }) => <ContractStatutBadge statut={row.original.statut} />,
    },
    ...(showCommerciale
      ? [
          {
            id: "commerciale",
            header: "Commerciale",
            cell: ({ row }) => (
              <span className="text-xs text-muted-foreground">
                {row.original.assigneA.name}
              </span>
            ),
          } as ColumnDef<ContractListItem>,
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="Aucun contrat. Crée un contrat depuis un deal signé."
      getRowHref={(c) => `/contrats/${c.id}`}
    />
  );
}
