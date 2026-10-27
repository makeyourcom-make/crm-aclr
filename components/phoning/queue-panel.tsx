"use client";

/**
 * Colonne droite du cockpit : « À appeler ensuite » (file ordonnée), les
 * prospects traités pendant la session, les stats de session et le meilleur
 * combo du jour. Tout vient des données réelles (file + appels du jour).
 */
import { BarChart3, Check, Flame, ListOrdered, Star } from "lucide-react";

import { formatInt, pctOf, plural } from "@/components/arena/format";
import { SectionCard } from "@/components/arena/section-card";
import { TONE_CLASSES } from "@/components/arena/tones";
import { RESULT_META, xpForCall } from "@/components/call/call-results";
import { zTime } from "@/components/call/zurich";
import { COMBO_GAP_MINUTES, COMBO_STEPS, XP_RULES } from "@/lib/gamification/rules";
import { getActivityResultatLabel } from "@/lib/labels";
import type { PhoningQueueItem } from "@/lib/queries/phoning";
import { cn } from "@/lib/utils";

import { heatOf, reasonPill } from "./phoning-labels";
import { multLabel, type CallPoint, type ComboState, type SessionStats } from "./phoning-stats";

// ---------------------------------------------------------------------------
// File
// ---------------------------------------------------------------------------

export function QueuePanel({
  next,
  remaining,
  nowMs,
  disabled,
  onPick,
  done,
  skippedCount = 0,
  onRestoreSkipped,
}: {
  next: PhoningQueueItem[];
  remaining: number;
  nowMs: number;
  disabled: boolean;
  onPick: (id: string) => void;
  /** Appels de la session (plus récent en premier). */
  done: CallPoint[];
  /** Prospects passés (sans appel) pendant la session. */
  skippedCount?: number;
  onRestoreSkipped?: () => void;
}) {
  return (
    <SectionCard
      title="À appeler ensuite"
      icon={ListOrdered}
      tone="coral"
      description="Rappels en retard, puis du jour, leads chauds, puis nouveaux"
      action={
        <span className="rounded-full bg-navy-700 px-2.5 py-1 text-xs font-extrabold text-white tabular-nums">
          {plural(remaining, "restant")}
        </span>
      }
      contentClassName="flex flex-col gap-3"
    >
      {next.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {next.map((q, i) => {
            const reason = reasonPill(q, nowMs);
            const heat = heatOf(q);
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => onPick(q.id)}
                  disabled={disabled}
                  title="Prendre ce prospect maintenant"
                  className="flex w-full items-center gap-3 rounded-[14px] border border-border bg-card px-3 py-2.5 text-left text-foreground transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-arena disabled:pointer-events-none disabled:opacity-60"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy-50 text-xs font-extrabold"
                  >
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-bold">
                      <span className="sr-only">Prendre maintenant : </span>
                      {q.raisonSociale}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {q.ville && (
                        <span className="text-xs font-semibold text-muted-foreground">{q.ville}</span>
                      )}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-bold",
                          TONE_CLASSES[reason.tone].bg,
                          TONE_CLASSES[reason.tone].text,
                        )}
                      >
                        {reason.short}
                      </span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold capitalize",
                      TONE_CLASSES[heat.tone].bg,
                      TONE_CLASSES[heat.tone].text,
                    )}
                  >
                    <Flame aria-hidden="true" className="size-3" />
                    {heat.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-[12px] bg-ground px-3 py-3 text-[13px] text-muted-foreground">
          Plus personne derrière. Tu tiens le dernier prospect de la file, termine en beauté.
        </p>
      )}

      {skippedCount > 0 && onRestoreSkipped && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted-foreground">
          {plural(skippedCount, "prospect passé", "prospects passés")}
          <button
            type="button"
            onClick={onRestoreSkipped}
            className="font-bold text-info-700 underline-offset-2 hover:underline"
          >
            Les remettre dans la file
          </button>
        </p>
      )}

      {done.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            Traités dans cette session
          </span>
          <ul className="flex flex-col gap-2">
            {done.slice(0, 8).map((d) => {
              const tone = d.resultat ? RESULT_META[d.resultat].tone : "navy";
              return (
                <li key={d.id} className="flex items-center gap-2 text-[13px]">
                  <Check aria-hidden="true" className="size-4 shrink-0 text-win-700" />
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {d.raisonSociale ?? "Prospect"}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                      TONE_CLASSES[tone].bg,
                      TONE_CLASSES[tone].text,
                    )}
                  >
                    {d.ongoing
                      ? "En cours"
                      : d.resultat
                        ? getActivityResultatLabel(d.resultat)
                        : "Sans résultat"}
                  </span>
                  <span className="w-[52px] shrink-0 text-right text-xs font-extrabold text-gold-700 tabular-nums">
                    +{xpForCall(d.resultat)} XP
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Stats de session
// ---------------------------------------------------------------------------

export function SessionStatsCard({
  stats,
  today,
}: {
  stats: SessionStats;
  today: { appels: number; conversations: number; rdvPris: number; emails: number } | null;
}) {
  const funnel = [
    { label: "Appels", val: stats.calls, color: "bg-navy-700" },
    { label: "Décrochés", val: stats.conversations, color: "bg-info-500" },
    { label: "Intéressés", val: stats.interesses, color: "bg-lvl-500" },
    { label: "RDV pris", val: stats.rdv, color: "bg-win-500" },
  ];
  return (
    <SectionCard title="Stats de la session" icon={BarChart3} tone="green" contentClassName="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <MiniStat value={formatInt(stats.conversations)} label={`décrochés sur ${formatInt(stats.calls)}`} />
        <MiniStat value={`${formatInt(stats.taux)} %`} label="taux de conversation" />
        <MiniStat value={formatInt(stats.rdv)} label="RDV pris" green />
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Entonnoir de la session
        </span>
        {funnel.map((f) => {
          const pct = stats.calls > 0 ? Math.max(f.val > 0 ? 4 : 0, pctOf(f.val, stats.calls)) : 0;
          return (
            <div key={f.label} className="flex items-center gap-2.5">
              <span className="w-[78px] shrink-0 text-xs font-bold text-foreground">{f.label}</span>
              <span
                className="h-3 flex-1 overflow-hidden rounded-full bg-navy-50"
                role="img"
                aria-label={`${f.label} : ${formatInt(f.val)}`}
              >
                <span className={cn("block h-full rounded-full", f.color)} style={{ width: `${pct}%` }} />
              </span>
              <span className="w-7 shrink-0 text-right text-[13px] font-extrabold tabular-nums">
                {formatInt(f.val)}
              </span>
            </div>
          );
        })}
      </div>
      {today && (
        <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          Aujourd&apos;hui :{" "}
          <strong className="text-foreground">
            {plural(today.appels, "appel sortant", "appels sortants")} ·{" "}
            {plural(today.conversations, "conversation")} · {formatInt(today.rdvPris)} RDV pris ·{" "}
            {plural(today.emails, "email envoyé", "emails envoyés")}
          </strong>
          . Durée idéale d&apos;un appel : 2 à 5 min.
        </p>
      )}
    </SectionCard>
  );
}

function MiniStat({ value, label, green }: { value: string; label: string; green?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-[14px] px-2.5 py-3", green ? "bg-win-50" : "bg-ground")}>
      <span className={cn("score-number text-[26px]", green ? "text-win-700" : "text-foreground")}>
        {value}
      </span>
      <span className={cn("text-xs leading-tight font-semibold", green ? "font-bold text-win-700" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meilleur combo du jour
// ---------------------------------------------------------------------------

export function BestComboCard({ combo }: { combo: ComboState }) {
  const best = combo.best;
  const pct = best > 0 ? pctOf(combo.current, best) : 0;
  const message =
    best === 0
      ? `Enchaîne tes appels à moins de ${COMBO_GAP_MINUTES} min d'écart pour lancer ton premier combo.`
      : combo.current >= best && combo.current > 0
        ? "Record du jour en cours : chaque appel le repousse."
        : `Encore ${plural(best - combo.current + 1, "appel enchaîné", "appels enchaînés")} pour battre ton record du jour.`;
  return (
    <SectionCard
      title="Meilleur combo du jour"
      icon={Star}
      tone="gold"
      contentClassName="flex flex-col gap-3.5"
    >
      <div className="flex items-baseline gap-2">
        <span className="score-number text-[40px] text-foreground">{formatInt(best)}</span>
        <span className="text-[13px] font-semibold text-muted-foreground">
          {best > 1 ? "appels enchaînés" : "appel"}
          {combo.bestAt ? ` · fini à ${zTime(combo.bestAt)}` : ""}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Combo actuel par rapport au meilleur combo du jour"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`Combo actuel ${formatInt(combo.current)} sur un meilleur de ${formatInt(best)}`}
        className="h-2.5 overflow-hidden rounded-full bg-navy-50"
      >
        <div className="h-full rounded-full bg-gradient-coral" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[13px] font-bold text-foreground">{message}</p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
        <li>
          Appel passé <strong className="text-gold-700">+{XP_RULES.appel}</strong>
        </li>
        <li>
          Conversation <strong className="text-gold-700">+{XP_RULES.conversation}</strong>
        </li>
        <li>
          RDV pris <strong className="text-gold-700">+{XP_RULES.rdvPris}</strong>
        </li>
        <li>
          Mission du jour <strong className="text-gold-700">+{XP_RULES.missionDuJour}</strong>
        </li>
        <li className="col-span-2">
          {COMBO_STEPS.filter((st) => st.minCalls > 0)
            .map((st, i) => `${i === 0 ? "Combo " : ""}${multLabel(st.mult)} dès ${st.minCalls}${i === 0 ? " appels" : ""}`)
            .join(" · ")}
        </li>
      </ul>
    </SectionCard>
  );
}
