"use client";

import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { ContractStatutBadge } from "@/components/contrats/contract-statut-badge";
import { DataTable } from "@/components/ui/data-table";
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
      header: "N° contrat",
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
      header: "Client",
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
      header: "Valeur an 1",
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">
          {formatCHF(Number(row.original.valeurAn1))}
        </span>
      ),
    },
    {
      id: "mensuel",
      header: "Mensuel",
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
      header: "Signé le",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs">
          {formatDate(row.original.dateSignature)}
        </span>
      ),
    },
    {
      id: "statut",
      header: "Statut",
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
