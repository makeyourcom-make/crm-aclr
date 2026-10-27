"use client";

/**
 * Classement de l'équipe en CA signé, puis RDV pris (semaine ISO ou mois en
 * cours, utilisateurs actifs). Données : getWeeklyLeaderboard /
 * getMonthlyLeaderboard, calculées côté serveur : la bascule Semaine / Mois
 * est instantanée.
 */
import { Trophy } from "lucide-react";
import { useState } from "react";

import { plural } from "@/components/arena/format";
import { PlayerAvatar } from "@/components/arena/player-avatar";
import { SectionCard } from "@/components/arena/section-card";
import { formatCHFCompact } from "@/lib/format";
import { firstNameOf, type LeaderboardEntry } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

const MAX_ROWS = 6;

type Periode = "semaine" | "mois";

const PERIODES: Array<{ key: Periode; label: string; description: string }> = [
  { key: "semaine", label: "Semaine", description: "CA signé puis RDV pris depuis lundi" },
  { key: "mois", label: "Mois", description: "CA signé puis RDV pris depuis le 1er du mois" },
];

/** Écart lisible entre deux lignes : en CHF si le CA diffère, sinon en RDV. */
function ecart(a: LeaderboardEntry, b: LeaderboardEntry): { chf: number; rdv: number } {
  return { chf: a.caSigne - b.caSigne, rdv: a.rdvPris - b.rdvPris };
}

function ecartTexte(d: { chf: number; rdv: number }): string | null {
  if (d.chf !== 0) return formatCHFCompact(Math.abs(d.chf));
  if (d.rdv !== 0) return plural(Math.abs(d.rdv), "RDV", "RDV");
  return null;
}

export function ResultsLeaderboard({
  weekly,
  monthly,
  className,
}: {
  weekly: LeaderboardEntry[] | null;
  monthly: LeaderboardEntry[] | null;
  className?: string;
}) {
  const available = PERIODES.filter((p) => (p.key === "semaine" ? weekly : monthly));
  const [periode, setPeriode] = useState<Periode>(available[0]?.key ?? "semaine");
  const current = available.find((p) => p.key === periode) ?? available[0];
  if (!current) return null;
  const entries = (current.key === "semaine" ? weekly : monthly) ?? [];

  const me = entries.find((e) => e.isMe) ?? null;
  const leader = entries[0] ?? null;
  const leaderCa = Math.max(0, leader?.caSigne ?? 0);
  const leaderRdv = Math.max(0, leader?.rdvPris ?? 0);
  const personne = leaderCa <= 0 && leaderRdv <= 0;
  // Toujours afficher la ligne de l'utilisateur, même hors du top.
  const shown = entries.slice(0, MAX_ROWS);
  if (me && !shown.some((e) => e.isMe)) shown.push(me);

  return (
    <SectionCard
      title="Classement"
      icon={Trophy}
      tone="gold"
      className={className}
      description={current.description}
      action={
        available.length > 1 ? (
          <div
            role="group"
            aria-label="Période du classement"
            className="flex gap-1 rounded-[12px] bg-navy-50 p-1"
          >
            {available.map((x) => {
              const on = x.key === current.key;
              return (
                <button
                  key={x.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPeriode(x.key)}
                  className={cn(
                    "h-9 min-w-[72px] rounded-[10px] px-3 text-[13px] font-extrabold transition-colors sm:px-4",
                    on
                      ? "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(14,25,54,0.14)]"
                      : "text-foreground hover:bg-card",
                  )}
                >
                  {x.label}
                </button>
              );
            })}
          </div>
        ) : undefined
      }
      contentClassName="flex flex-col gap-4"
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun collaborateur actif pour l&apos;instant.</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {shown.map((e) => {
            // Barre : part du CA du 1er (ou des RDV pris si personne n'a signé).
            const pct =
              leaderCa > 0
                ? Math.round((Math.max(0, e.caSigne) / leaderCa) * 100)
                : leaderRdv > 0
                  ? Math.round((Math.max(0, e.rdvPris) / leaderRdv) * 100)
                  : 0;
            let delta = "";
            let deltaTone = "";
            if (e.isMe) {
              if (personne) {
                delta = "Rien de signé pour l'instant : le premier RDV ouvre le classement";
                deltaTone = "text-muted-foreground";
              } else if (e.rank === 1) {
                const second = entries.find((x) => !x.isMe) ?? null;
                const txt = second ? ecartTexte(ecart(e, second)) : null;
                delta = txt ? `En tête · ${txt} d'avance` : "En tête";
                deltaTone = "text-win-700";
              } else if (leader) {
                const txt = ecartTexte(ecart(leader, e));
                delta = txt ? `${txt} derrière ${firstNameOf(leader.name)}` : "À égalité avec le 1er";
                deltaTone = "text-gold-700";
              }
            } else if (me) {
              const d = ecart(e, me);
              const txt = ecartTexte(d);
              const devant = d.chf > 0 || (d.chf === 0 && d.rdv > 0);
              delta = txt ? `${txt} ${devant ? "devant" : "derrière"} toi` : "À égalité avec toi";
              deltaTone = !txt ? "text-muted-foreground" : devant ? "text-alert-700" : "text-win-700";
            }
            return (
              <li
                key={e.userId}
                className={cn(
                  "flex flex-col gap-2.5 rounded-[16px] border p-3",
                  e.isMe ? "border-coral-100 bg-coral-50" : "border-border bg-card",
                )}
              >
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-navy-700",
                      e.rank === 1 && !personne
                        ? "bg-gold-500"
                        : e.rank === 2
                          ? "bg-border-strong"
                          : "bg-navy-50",
                    )}
                  >
                    <span className="sr-only">Rang </span>
                    {e.rank}
                  </span>
                  <PlayerAvatar
                    initials={e.initials}
                    tone={e.isMe ? "coral" : "navy"}
                    size="md"
                    className="hidden min-[380px]:inline-flex"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-extrabold text-foreground">
                      {e.name}
                      {e.isMe ? " (toi)" : ""}
                    </span>
                    {delta && (
                      <span className={cn("text-xs font-semibold", deltaTone)}>{delta}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="font-display text-lg font-extrabold whitespace-nowrap text-foreground tabular-nums sm:text-xl">
                      {formatCHFCompact(e.caSigne)}
                    </span>
                    <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground tabular-nums">
                      {plural(e.contratsSignes, "contrat")} · {plural(e.rdvPris, "RDV", "RDV")}
                    </span>
                  </div>
                </div>
                <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-navy-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-700",
                      e.isMe ? "bg-gradient-coral" : "bg-navy-500",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}
