"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Table as TableType,
} from "@tanstack/react-table";

import { cn } from "@/lib/utils";

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Message à afficher si la liste est vide. */
  emptyMessage?: string;
  /** Si fourni, encadre chaque ligne dans un <Link href={getRowHref(row)}>. */
  getRowHref?: (row: T) => string;
  className?: string;
}

/**
 * Wrapper léger autour de TanStack Table.
 *
 * Volontairement minimal : pas de pagination/tri client. Le serveur fait tout
 * via les query params (cf. lib/queries/prospects.ts). Le client se contente
 * de rendre les lignes.
 */
export function DataTable<T>({
  columns,
  data,
  emptyMessage = "Aucun résultat.",
  getRowHref,
  className,
}: DataTableProps<T>) {
  const table = useReactTable<T>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-card",
        className,
      )}
    >
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  style={{
                    width:
                      header.getSize() !== 150 ? header.getSize() : undefined,
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-12 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <DataTableRow
                key={row.id}
                row={row}
                table={table}
                href={getRowHref?.(row.original)}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface DataTableRowProps<T> {
  row: ReturnType<TableType<T>["getRowModel"]>["rows"][number];
  table: TableType<T>;
  href?: string;
}

function DataTableRow<T>({ row, href }: DataTableRowProps<T>) {
  const className = cn(
    "border-b border-border last:border-0 transition-colors",
    href && "cursor-pointer hover:bg-muted/30",
  );

  if (href) {
    return (
      <tr
        className={className}
        onClick={(e) => {
          // Ne navigue pas si on a cliqué sur un sous-élément interactif
          const target = e.target as HTMLElement;
          if (
            target.closest("button") ||
            target.closest("a") ||
            target.closest("input") ||
            target.closest("select")
          ) {
            return;
          }
          window.location.href = href;
        }}
      >
        {row.getVisibleCells().map((cell) => (
          <td key={cell.id} className="px-3 py-2.5">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    );
  }

  return (
    <tr className={className}>
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-3 py-2.5">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}
