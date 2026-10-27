/**
 * Carte de mission du jour : anneau de progression + libellé + « +100 XP »
 * + phrase coach (« Encore 13 appels et la mission est pliée »).
 * Passe au vert, avec coche, quand la mission est terminée.
 *
 *   <MissionCard mission={mission} action={<Link href="/phoning">Lancer</Link>} />
 *
 * Server-safe.
 */
import { CalendarPlus, Check, Phone, Send, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { Mission } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import { formatInt, plural } from "./format";
import { StatusPill, XpPill } from "./pills";
import { ProgressRing } from "./progress-ring";
import { TONE_CLASSES, type Tone } from "./tones";

type MissionKey = Mission["key"];

export const MISSION_META: Record<MissionKey, { tone: Tone; icon: LucideIcon }> = {
  appels: { tone: "coral", icon: Phone },
  rdvPris: { tone: "gold", icon: CalendarPlus },
  propositions: { tone: "violet", icon: Send },
};

/** Phrase coach selon l'avancement (ton énergique, tutoiement). */
export function missionCoach(m: Mission): string {
  if (m.done) return "Mission pliée, bravo ! Les XP sont dans la poche.";
  const left = Math.max(0, Math.ceil(m.target - m.current));
  switch (m.key) {
    case "appels":
      return left <= 3
        ? `Plus que ${plural(left, "appel")}, tu y es presque`
        : `Encore ${plural(left, "appel")} et la mission est pliée`;
    case "rdvPris":
      return left === 1
        ? "Plus qu'un RDV : tu tiens le bon bout"
        : `Encore ${formatInt(left)} RDV à décrocher`;
    case "propositions":
      return m.current <= 0 && left === 1
        ? "+60 XP la proposition, +100 XP la mission"
        : `Encore ${plural(left, "proposition")} à envoyer`;
    default:
      return `Encore ${formatInt(left)} pour plier la mission`;
  }
}

export interface MissionCardProps {
  mission: Mission;
  /** Lien / bouton sous la phrase coach (optionnel). */
  action?: ReactNode;
  className?: string;
}

export function MissionCard({ mission, action, className }: MissionCardProps) {
  const meta = MISSION_META[mission.key] ?? MISSION_META.appels;
  const done = mission.done;
  const tone: Tone = done ? "green" : meta.tone;
  const pct = Number.isFinite(mission.pct)
    ? Math.min(Math.max(Math.round(mission.pct), 0), 100)
    : 0;

  return (
    <article
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-[16px] border p-4 transition-colors",
        done ? "border-win-500/35 bg-win-50/60" : "border-border bg-card",
        className,
      )}
    >
      <ProgressRing
        value={mission.current}
        max={mission.target}
        size={88}
        stroke={9}
        tone={tone}
        label={`${mission.label} : ${formatInt(mission.current)} sur ${formatInt(mission.target)}${done ? ", terminée" : ""}`}
      >
        {done ? (
          <Check className="size-8 text-win-700" strokeWidth={3} />
        ) : (
          <>
            <span className="score-number text-2xl text-foreground">
              {formatInt(mission.current)}
            </span>
            <span className="mt-0.5 text-xs font-bold text-muted-foreground">
              / {formatInt(mission.target)}
            </span>
          </>
        )}
      </ProgressRing>

      <div className="flex min-w-0 flex-[1_1_150px] flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <h3 className="text-[15px] leading-tight font-extrabold text-foreground">
            {mission.label}
          </h3>
          {done ? (
            <StatusPill tone="green" icon={Check}>
              {`+${formatInt(mission.xpReward)} XP gagnés`}
            </StatusPill>
          ) : (
            <XpPill xp={mission.xpReward} />
          )}
        </div>
        <span className={cn("text-[13px] font-extrabold tabular-nums", TONE_CLASSES[tone].text)}>
          {done ? "Terminée" : `${pct} %`}
        </span>
        <p className="text-[13px] leading-snug font-medium text-muted-foreground">
          {missionCoach(mission)}
        </p>
        {action && <div className="mt-0.5 text-[13px] font-bold">{action}</div>}
      </div>
    </article>
  );
}
