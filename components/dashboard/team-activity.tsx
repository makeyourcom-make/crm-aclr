/**
 * Pilotage équipe (admin) : activité par collaborateur sur jour / semaine /
 * mois (appels, RDV pris, RDV effectués, emails, signatures), objectifs
 * quotidiens en vue « Aujourd'hui ». Période dans l'URL (?activite=).
 * Server-safe.
 */
import { Check, Users } from "lucide-react";
import Link from "next/link";

import { formatInt } from "@/components/arena/format";
import { PlayerAvatar } from "@/components/arena/player-avatar";
import { SectionCard } from "@/components/arena/section-card";
import { initialsOf } from "@/lib/gamification/rules";
import type { TeamActivityRow } from "@/lib/queries/stats";
import { cn } from "@/lib/utils";

const PERIODES = [
  ["jour", "Aujourd'hui"],
  ["semaine", "Cette semaine"],
  ["mois", "Ce mois"],
] as const;

const TH = "px-3 py-2.5 text-right text-[11px] font-bold tracking-[0.08em] uppercase";
const TD = "px-3 py-3 text-right tabular-nums";

export function TeamActivity({
  rows,
  periode,
}: {
  rows: TeamActivityRow[];
  periode: { type: "jour" | "semaine" | "mois"; label: string };
}) {
  const isJour = periode.type === "jour";
  const total = (k: keyof Pick<TeamActivityRow, "appels" | "rdvPris" | "rdvEffectues" | "emails" | "signatures">) =>
    rows.reduce((s, r) => s + r[k], 0);

  return (
    <SectionCard
      title={`Activité de l'équipe · ${periode.label}`}
      icon={Users}
      tone="green"
      description="Appels, RDV, emails et signatures par collaborateur"
      action={
        <nav aria-label="Période de l'activité de l'équipe" className="flex flex-wrap gap-1 rounded-[12px] bg-navy-50 p-1">
          {PERIODES.map(([val, label]) => {
            const on = periode.type === val;
            return (
              <Link
                key={val}
                href={`/?activite=${val}`}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-[10px] px-3 text-[13px] font-extrabold whitespace-nowrap transition-colors",
                  on
                    ? "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(14,25,54,0.14)]"
                    : "text-foreground hover:bg-card",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      }
    >
      <div className="-mx-5 overflow-x-auto sm:-mx-6">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead className="border-y border-border bg-ground text-muted-foreground">
            <tr>
              <th scope="col" className={cn(TH, "pl-5 text-left sm:pl-6")}>
                Collaborateur
              </th>
              <th scope="col" className={TH}>Appels</th>
              <th scope="col" className={TH}>RDV pris</th>
              <th scope="col" className={TH}>RDV effectués</th>
              <th scope="col" className={TH}>Emails</th>
              <th scope="col" className={cn(TH, "pr-5 sm:pr-6")}>Signatures</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                  Aucun collaborateur actif.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const appelsAtteint = isJour && r.objAppelsJour > 0 && r.appels >= r.objAppelsJour;
                const rdvAtteint = isJour && r.objRdvJour > 0 && r.rdvPris >= r.objRdvJour;
                return (
                  <tr
                    key={r.userId}
                    className="border-b border-border last:border-0 hover:bg-ground/60"
                  >
                    <td className="py-2.5 pr-3 pl-5 sm:pl-6">
                      <Link
                        href={`/stats?user=${r.userId}`}
                        className="inline-flex items-center gap-2.5 font-bold text-foreground hover:underline"
                      >
                        <PlayerAvatar initials={initialsOf(r.name)} tone="coral" size="xs" />
                        {r.name}
                      </Link>
                    </td>
                    <td className={cn(TD, appelsAtteint && "font-bold text-win-700")}>
                      {formatInt(r.appels)}
                      {isJour && r.objAppelsJour > 0 && (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          / {formatInt(r.objAppelsJour)}
                        </span>
                      )}
                    </td>
                    <td className={cn(TD, "font-bold", rdvAtteint && "text-win-700")}>
                      <span className="inline-flex items-center justify-end gap-1">
                        {rdvAtteint && (
                          <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                        )}
                        {formatInt(r.rdvPris)}
                        {isJour && r.objRdvJour > 0 && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            / {formatInt(r.objRdvJour)}
                          </span>
                        )}
                        {rdvAtteint && <span className="sr-only"> (objectif atteint)</span>}
                      </span>
                    </td>
                    <td className={TD}>{formatInt(r.rdvEffectues)}</td>
                    <td className={TD}>{formatInt(r.emails)}</td>
                    <td className={cn(TD, "pr-5 sm:pr-6")}>{formatInt(r.signatures)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 1 && (
            <tfoot className="border-t border-border bg-ground font-bold">
              <tr>
                <td className="py-2.5 pr-3 pl-5 sm:pl-6">Total équipe</td>
                <td className={TD}>{formatInt(total("appels"))}</td>
                <td className={TD}>{formatInt(total("rdvPris"))}</td>
                <td className={TD}>{formatInt(total("rdvEffectues"))}</td>
                <td className={TD}>{formatInt(total("emails"))}</td>
                <td className={cn(TD, "pr-5 sm:pr-6")}>{formatInt(total("signatures"))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </SectionCard>
  );
}
