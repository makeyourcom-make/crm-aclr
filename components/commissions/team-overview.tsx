"use client";

import { useState } from "react";
import Link from "next/link";

import { Icon } from "@/components/icon";
import { formatCHF } from "@/lib/format";

interface Detail {
  commissionId: string;
  contractId: string;
  contractNumero: string;
  clientName: string;
  acquis: number;
  aVenir: number;
  annule: number;
}

interface TeamOverviewProps {
  rows: Array<{
    userId: string;
    userName: string;
    acquis: number;
    aVenir: number;
    annule: number;
    details: Detail[];
  }>;
}

export function TeamOverview({ rows }: TeamOverviewProps) {
  const [open, setOpen] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        Aucune commerciale n&apos;a de commission en cours.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <Th>Commerciale</Th>
            <Th className="text-right">Acquise</Th>
            <Th className="text-right">À venir</Th>
            <Th className="text-right">Annulée</Th>
            <Th className="text-right">Total potentiel</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isOpen = open === r.userId;
            const details = r.details.filter(
              (d) => d.acquis !== 0 || d.aVenir !== 0 || d.annule !== 0,
            );
            return (
              <FragmentRow
                key={r.userId}
                r={r}
                details={details}
                isOpen={isOpen}
                onToggle={() => setOpen(isOpen ? null : r.userId)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({
  r,
  details,
  isOpen,
  onToggle,
}: {
  r: TeamOverviewProps["rows"][number];
  details: Detail[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
        onClick={onToggle}
      >
        <td className="px-3 py-2.5 font-medium">
          <span className="inline-flex items-center gap-1.5">
            <Icon
              name="ChevronRight"
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
            {r.userName}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
          {formatCHF(r.acquis)}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">
          {formatCHF(r.aVenir)}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
          {formatCHF(r.annule)}
        </td>
        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
          {formatCHF(r.acquis + r.aVenir)}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={5} className="px-3 py-2">
            {details.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Aucune commission détaillée.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="px-2 py-1 text-left font-medium">
                      Contrat · Client
                    </th>
                    <th className="px-2 py-1 text-right font-medium">Acquise</th>
                    <th className="px-2 py-1 text-right font-medium">À venir</th>
                    <th className="px-2 py-1 text-right font-medium">Annulée</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d) => (
                    <tr key={d.commissionId} className="border-t border-border/60">
                      <td className="px-2 py-1.5">
                        <Link
                          href={`/contrats/${d.contractId}`}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="font-mono">{d.contractNumero}</span>
                          <span className="text-foreground"> · {d.clientName}</span>
                        </Link>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">
                        {formatCHF(d.acquis)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatCHF(d.aVenir)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {formatCHF(d.annule)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
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
