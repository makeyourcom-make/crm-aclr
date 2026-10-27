/**
 * Classement de la semaine (XP de la semaine ISO, joueurs actifs) + « toi vs
 * ton record » hebdomadaire. Données : getWeeklyLeaderboard + getPlayerStats.
 * Server-safe.
 */
import { Star } from "lucide-react";

import { formatDayKey, formatInt, formatXp, plural } from "@/components/arena/format";
import { PlayerAvatar } from "@/components/arena/player-avatar";
import { SectionCard } from "@/components/arena/section-card";
import { XpBar } from "@/components/arena/xp-bar";
import { XP_RULES, type LeaderboardEntry, type PlayerStats } from "@/lib/gamification/rules";
import { firstNameOf } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

const MAX_ROWS = 6;

export function WeeklyLeaderboard({
  entries,
  stats,
  className,
}: {
  entries: LeaderboardEntry[];
  stats: PlayerStats | null;
  className?: string;
}) {
  const me = entries.find((e) => e.isMe) ?? null;
  const leader = entries[0] ?? null;
  const leaderXp = Math.max(0, leader?.xp ?? 0);
  const second = entries.find((e) => !e.isMe) ?? null;
  // Toujours afficher la ligne du joueur, même hors du top.
  const shown = entries.slice(0, MAX_ROWS);
  if (me && !shown.some((e) => e.isMe)) shown.push(me);

  const xpWeek = Math.max(0, stats?.xpWeek ?? me?.xp ?? 0);
  const recordWeek = Math.max(0, stats?.xpRecordWeek ?? 0);
  const recordPct = recordWeek > 0 ? Math.min(100, Math.round((xpWeek / recordWeek) * 100)) : 0;
  const recordReste = Math.max(0, recordWeek - xpWeek);

  let recordMsg: string;
  if (recordWeek <= 0) {
    recordMsg = "Pas encore de record hebdo : chaque XP de la semaine compte.";
  } else if (xpWeek >= recordWeek) {
    recordMsg = "Cette semaine est ton record : chaque XP de plus le repousse.";
  } else {
    const rdv = Math.ceil(recordReste / XP_RULES.rdvPris);
    recordMsg = `Encore ${formatInt(recordReste)} XP pour égaler ton record : ${plural(rdv, "RDV pris suffit", "RDV pris suffisent")}.${recordPct >= 80 ? " Record en vue." : ""}`;
  }

  return (
    <SectionCard
      title="Classement de la semaine"
      icon={Star}
      tone="gold"
      className={className}
      description="XP cumulés depuis lundi · joueurs actifs"
      contentClassName="flex flex-col gap-4"
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun joueur actif pour l&apos;instant.</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {shown.map((e) => {
            const pct = leaderXp > 0 ? Math.round((Math.max(0, e.xp) / leaderXp) * 100) : 0;
            let delta: string;
            let deltaTone: string;
            if (e.isMe) {
              if (e.xp <= 0 && leaderXp <= 0) {
                delta = "Lance la semaine : le premier appel compte";
                deltaTone = "text-muted-foreground";
              } else if (e.rank === 1) {
                delta = second && second.xp === e.xp ? "À égalité en tête" : "Tu mènes la danse";
                deltaTone = "text-win-700";
              } else {
                delta = `À ${formatInt(leaderXp - e.xp)} XP du 1er`;
                deltaTone = "text-gold-700";
              }
            } else if (me) {
              const diff = e.xp - me.xp;
              delta =
                diff > 0
                  ? `${formatInt(diff)} XP devant toi`
                  : diff < 0
                    ? `${formatInt(-diff)} XP derrière toi`
                    : "À égalité avec toi";
              deltaTone = diff > 0 ? "text-alert-700" : diff < 0 ? "text-win-700" : "text-muted-foreground";
            } else {
              delta = "";
              deltaTone = "";
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
                      e.rank === 1 ? "bg-gold-500" : e.rank === 2 ? "bg-border-strong" : "bg-navy-50",
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
                  <span className="shrink-0 font-display text-lg font-extrabold text-foreground tabular-nums sm:text-2xl">
                    {formatXp(e.xp)}
                  </span>
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

      {stats && (
        <div className="flex flex-col gap-2.5 rounded-[16px] bg-gold-50 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-extrabold text-gold-700">Toi vs ton record</span>
            <span className="text-[13px] font-extrabold text-gold-700 tabular-nums">
              {formatInt(xpWeek)} / {formatXp(recordWeek)}
            </span>
          </div>
          <XpBar
            pct={recordPct}
            className="h-3 bg-card"
            label={`${recordPct} % de ton record hebdomadaire`}
          />
          <p className="text-[13px] font-semibold text-foreground">{recordMsg}</p>
        </div>
      )}

      {stats && me && (
        <div className="grid grid-cols-2 gap-2.5">
          {me.rank === 1 && second ? (
            <MiniTile
              label="Avance sur le 2e"
              value={`+${formatXp(me.xp - second.xp)}`}
              tone="text-win-700"
            />
          ) : me.rank > 1 && leader ? (
            <MiniTile
              label={`Écart avec ${firstNameOf(leader.name)}`}
              value={`-${formatXp(leader.xp - me.xp)}`}
              tone="text-alert-700"
            />
          ) : (
            <MiniTile label="Ta semaine" value={formatXp(xpWeek)} tone="text-foreground" />
          )}
          <MiniTile
            label="Ton meilleur jour"
            value={formatXp(stats.records.bestDayXp)}
            sub={stats.records.bestDayDate ? formatDayKey(stats.records.bestDayDate) : undefined}
            tone="text-gold-700"
          />
        </div>
      )}
    </SectionCard>
  );
}

function MiniTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-[14px] border border-border p-3">
      <p className="truncate text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-display text-lg font-extrabold tabular-nums sm:text-xl", tone)}>
        {value}
      </p>
      {sub && <p className="text-xs font-semibold text-muted-foreground">{sub}</p>}
    </div>
  );
}
