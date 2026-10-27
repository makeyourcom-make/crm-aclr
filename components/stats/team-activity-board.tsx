"use client";

/**
 * Activité de l'équipe (admin) : tableau par collaborateur sur aujourd'hui,
 * la semaine ou le mois, classé par XP (calculés comme la topbar), avec les
 * objectifs du jour quand ils existent, la ligne « Total équipe » et le défi
 * d'équipe du mois (CA signé ensemble vs objectif mensuel société).
 */
import { Flame, Zap } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { formatInt, formatXp, pctOf } from "@/components/arena/format";
import { PlayerAvatar } from "@/components/arena/player-avatar";
import { XP_RULES } from "@/lib/gamification/rules";
import { formatCHFCompact } from "@/lib/format";
import type { TeamBoard, TeamPeriodKey, TeamRow } from "@/lib/queries/pilotage";
import { cn } from "@/lib/utils";

import { RankBadge, SegmentGroup, segmentClass } from "./ui";

const PERIODS: TeamPeriodKey[] = ["jour", "semaine", "mois"];
const CONTRIB_COLORS = ["#F47174", "#0E1936", "#7C5CFC", "#3B6FF6", "#0EA5A4", "#F5A524"];

export function TeamActivityBoard({
  board,
  range,
  currentUserId,
}: {
  board: TeamBoard;
  /** Période de la page, conservée dans le lien « Voir ses stats ». */
  range: string;
  currentUserId: string;
}) {
  const [periode, setPeriode] = useState<TeamPeriodKey>("jour");
  const sel = board.periods[periode];
  const estJour = periode === "jour";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-muted-foreground">{sel.title}</span>
        <SegmentGroup label="Période du tableau équipe" muted>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={periode === p}
              onClick={() => setPeriode(p)}
              className={segmentClass(periode === p, "min-w-[84px]")}
            >
              {board.periods[p].label}
            </button>
          ))}
        </SegmentGroup>
      </div>

      <div className="flex items-start gap-2.5 rounded-[14px] bg-gold-50 px-3.5 py-3">
        <Flame aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-gold-700" />
        <span className="text-sm font-semibold text-gold-700">{sel.message}</span>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-border">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <caption className="sr-only">Activité de l&apos;équipe par collaborateur : {sel.title}</caption>
          <thead>
            <tr className="bg-ground">
              <Th className="text-left">Collaborateur</Th>
              <Th>Appels</Th>
              <Th>Conversations</Th>
              <Th>RDV pris</Th>
              <Th>RDV effectués</Th>
              <Th>Emails</Th>
              <Th>Propositions</Th>
              <Th>Signatures</Th>
              <Th className="pr-3.5">XP</Th>
            </tr>
          </thead>
          <tbody>
            {sel.rows.map((r) => (
              <Row key={r.userId} r={r} estJour={estJour} range={range} isMe={r.userId === currentUserId} />
            ))}
            <tr className="border-t-2 border-border-strong bg-ground">
              <th scope="row" className="px-3.5 py-3.5 text-left text-sm font-extrabold">
                Total équipe
              </th>
              <Num strong>{sel.total.appels}</Num>
              <Num strong>{sel.total.conversations}</Num>
              <Num strong>{sel.total.rdvPris}</Num>
              <Num strong>{sel.total.rdvEffectues}</Num>
              <Num strong>{sel.total.emails}</Num>
              <Num strong>{sel.total.propositions}</Num>
              <Num strong className="text-win-700">
                {sel.total.signatures}
              </Num>
              <td className="px-3.5 py-3.5 text-right text-sm font-extrabold whitespace-nowrap text-gold-700 tabular-nums">
                {formatXp(sel.total.xp)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Defi board={board} />
    </div>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-2.5 py-3 text-right text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase first:pl-3.5",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Num({
  children,
  strong = false,
  className,
}: {
  children: number;
  strong?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-2.5 py-3.5 text-right text-base tabular-nums",
        strong ? "font-extrabold" : "font-bold",
        className,
      )}
    >
      {formatInt(children)}
    </td>
  );
}

function Row({
  r,
  estJour,
  range,
  isMe,
}: {
  r: TeamRow;
  estJour: boolean;
  range: string;
  isMe: boolean;
}) {
  const objAppels = estJour ? r.objAppelsJour : null;
  const objRdv = estJour ? r.objRdvJour : null;
  const rdvOk = objRdv != null && r.counters.rdvPris >= objRdv;
  const href = `/stats?user=${encodeURIComponent(r.userId)}&range=${encodeURIComponent(range)}#performance`;
  return (
    <tr className={cn("border-t border-border", isMe && "bg-coral-50/40")}>
      <th scope="row" className="px-3.5 py-3.5 text-left font-semibold">
        <div className="flex items-center gap-3">
          <RankBadge rank={r.rank} />
          <PlayerAvatar initials={r.initials} tone={r.role === "ADMIN" ? "navy" : "coral"} size="sm" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-bold text-foreground">{r.name}</span>
            <span className="text-xs font-medium text-muted-foreground">
              {r.role === "ADMIN" ? "Admin" : "Commerciale"}
            </span>
            <Link href={href} className="text-xs font-bold text-info-700 hover:underline">
              Voir ses stats
            </Link>
          </div>
        </div>
      </th>
      <td className="px-2.5 py-3.5 text-right align-middle tabular-nums">
        <div className="flex flex-col items-end gap-1.5">
          <span>
            <span className="text-base font-extrabold">{formatInt(r.counters.appels)}</span>
            {objAppels != null && <span className="text-[13px] text-muted-foreground"> / {objAppels}</span>}
          </span>
          {objAppels != null && (
            <span
              role="img"
              aria-label={`Objectif appels atteint à ${pctOf(r.counters.appels, objAppels)} %`}
              className="block h-1.5 w-20 overflow-hidden rounded-full bg-coral-100"
            >
              <span
                className="block h-full rounded-full bg-gradient-coral"
                style={{ width: `${pctOf(r.counters.appels, objAppels)}%` }}
              />
            </span>
          )}
        </div>
      </td>
      <Num>{r.counters.conversations}</Num>
      <td className="px-2.5 py-3.5 text-right tabular-nums">
        <div className="flex flex-col items-end gap-1.5">
          <span>
            <span className="text-base font-extrabold">{formatInt(r.counters.rdvPris)}</span>
            {objRdv != null && <span className="text-[13px] text-muted-foreground"> / {objRdv}</span>}
          </span>
          {objRdv != null && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap",
                rdvOk ? "bg-win-50 text-win-700" : "bg-gold-50 text-gold-700",
              )}
            >
              {rdvOk ? "Objectif atteint" : `Encore ${objRdv - r.counters.rdvPris}`}
            </span>
          )}
        </div>
      </td>
      <Num>{r.counters.rdvEffectues}</Num>
      <Num>{r.counters.emails}</Num>
      <Num>{r.counters.propositions}</Num>
      <Num strong className="text-win-700">
        {r.counters.signatures}
      </Num>
      <td className="px-3.5 py-3.5 text-right">
        <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2.5 py-1 text-[13px] font-extrabold whitespace-nowrap text-gold-700 tabular-nums">
          <Zap aria-hidden="true" className="size-3.5 fill-current" />
          {formatXp(r.xp)}
        </span>
      </td>
    </tr>
  );
}

function Defi({ board }: { board: TeamBoard }) {
  const { defi } = board;
  const base = Math.max(defi.objectif ?? 0, defi.total, 1);
  const reste = defi.objectif != null ? Math.max(0, defi.objectif - defi.total) : null;
  const aria = [
    ...defi.contributions.map((c) => `${c.firstName} ${formatCHFCompact(c.ca)}`),
    reste != null && reste > 0 ? `reste ${formatCHFCompact(reste)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-[14px] border border-dashed border-border-strong p-4">
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
        <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Défi d&apos;équipe · {defi.monthName}
        </span>
        <span className="text-base font-extrabold">
          {defi.objectif != null
            ? `${formatCHFCompact(defi.total)} / ${formatCHFCompact(defi.objectif)} signés ensemble`
            : `${formatCHFCompact(defi.total)} signés ensemble`}
        </span>
        <span className="text-xs text-muted-foreground">
          Barème XP : appel +{XP_RULES.appel} · conversation +{XP_RULES.conversation} · email +{XP_RULES.email} ·
          RDV pris +{XP_RULES.rdvPris} · RDV effectué +{XP_RULES.rdvEffectue} · proposition +
          {XP_RULES.proposition} · signature +{XP_RULES.signature} (+1 XP par 10 CHF mensuels) · mission du jour +
          {XP_RULES.missionDuJour}
        </span>
        {defi.objectif == null && (
          <Link href="/objectifs" className="text-xs font-bold text-info-700 hover:underline">
            Aucun objectif CA mensuel défini · le fixer
          </Link>
        )}
      </div>
      <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-2">
        <div
          role="img"
          aria-label={`Contribution au défi : ${aria || "aucune signature ce mois"}`}
          className="flex h-4 overflow-hidden rounded-full bg-navy-50"
        >
          {defi.contributions.map((c, i) => (
            <div
              key={c.userId}
              style={{
                width: `${(c.ca / base) * 100}%`,
                backgroundColor: CONTRIB_COLORS[i % CONTRIB_COLORS.length],
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
          {defi.contributions.map((c, i) => (
            <span key={c.userId} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-[3px]"
                style={{ backgroundColor: CONTRIB_COLORS[i % CONTRIB_COLORS.length] }}
              />
              {c.firstName} {formatCHFCompact(c.ca)}
            </span>
          ))}
          {reste != null && reste > 0 && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-[3px] border border-border-strong bg-navy-50" />
              Reste {formatCHFCompact(reste)}
            </span>
          )}
          {defi.contributions.length === 0 && <span>Aucune signature ce mois pour l&apos;instant.</span>}
        </div>
      </div>
    </div>
  );
}
