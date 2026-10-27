"use client";

/**
 * Vue admin « Par commerciale » : une carte par commerciale (acquis, à venir,
 * annulé, total potentiel, part du total de l'équipe), détail dépliable par
 * contrat et lien pour filtrer les versements sur elle.
 */
import { ChevronRight, Filter } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PlayerAvatar } from "@/components/arena/player-avatar";
import { formatCHF } from "@/lib/format";
import { initialsOf } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

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
  /** Commerciale actuellement filtrée (mise en évidence). */
  activeUserId?: string | null;
}

export function TeamOverview({ rows, activeUserId }: TeamOverviewProps) {
  const [open, setOpen] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-[14px] border border-dashed border-border-strong bg-ground px-4 py-8 text-center text-sm text-muted-foreground">
        Aucune commerciale n&apos;a de commission en cours.
      </p>
    );
  }

  const teamTotal = Math.max(
    1,
    rows.reduce((s, r) => s + r.acquis + r.aVenir, 0),
  );

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const isOpen = open === r.userId;
        const details = r.details.filter(
          (d) => d.acquis !== 0 || d.aVenir !== 0 || d.annule !== 0,
        );
        const total = r.acquis + r.aVenir;
        const share = Math.round((total / teamTotal) * 100);
        const panelId = `team-detail-${r.userId}`;
        return (
          <li
            key={r.userId}
            className={cn(
              "rounded-[16px] border bg-card",
              activeUserId === r.userId ? "border-navy-700 ring-1 ring-navy-700" : "border-border",
            )}
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
              <div className="flex min-w-0 flex-[1_1_200px] items-center gap-3">
                <PlayerAvatar initials={initialsOf(r.userName)} tone="coral" size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-extrabold text-foreground">{r.userName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      role="img"
                      aria-label={`${share} % du total de l'équipe`}
                      className="h-1.5 w-24 overflow-hidden rounded-full bg-navy-50"
                    >
                      <div className="h-full rounded-full bg-navy-600" style={{ width: `${share}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      {share} % de l&apos;équipe
                    </span>
                  </div>
                </div>
              </div>
              <dl className="grid flex-[2_1_360px] grid-cols-2 gap-3 sm:grid-cols-4">
                <Amount label="Acquise" value={r.acquis} tone="text-win-700" />
                <Amount label="À venir" value={r.aVenir} />
                <Amount label="Annulée" value={r.annule} tone="text-muted-foreground" />
                <Amount label="Total potentiel" value={total} strong />
              </dl>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : r.userId)}
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-bold text-foreground hover:bg-navy-50"
              >
                <ChevronRight
                  aria-hidden="true"
                  className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-90")}
                />
                Détail par contrat ({details.length})
              </button>
              <Link
                href={`/commissions?user=${r.userId}#versements`}
                className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-bold text-info-700 hover:bg-info-50"
              >
                <Filter aria-hidden="true" className="size-4" />
                Voir ses versements
              </Link>
            </div>
            {isOpen && (
              <div id={panelId} className="border-t border-border bg-ground/60 px-4 py-3">
                {details.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    Aucune commission détaillée.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="px-2 py-1 text-left font-bold">Contrat · Client</th>
                          <th className="px-2 py-1 text-right font-bold">Acquise</th>
                          <th className="px-2 py-1 text-right font-bold">À venir</th>
                          <th className="px-2 py-1 text-right font-bold">Annulée</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.map((d) => (
                          <tr key={d.commissionId} className="border-t border-border/70">
                            <td className="px-2 py-1.5">
                              <Link href={`/contrats/${d.contractId}`} className="text-info-700 hover:underline">
                                <span className="font-mono font-semibold">{d.contractNumero}</span>
                                <span className="text-foreground"> · {d.clientName}</span>
                              </Link>
                            </td>
                            <td className="px-2 py-1.5 text-right text-win-700 tabular-nums">
                              {formatCHF(d.acquis)}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{formatCHF(d.aVenir)}</td>
                            <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">
                              {formatCHF(d.annule)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Amount({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: number;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">{label}</dt>
      <dd
        className={cn(
          "break-words tabular-nums",
          strong ? "text-base font-extrabold text-foreground" : "text-sm font-bold",
          !strong && (tone ?? "text-foreground"),
        )}
      >
        {formatCHF(value)}
      </dd>
    </div>
  );
}
