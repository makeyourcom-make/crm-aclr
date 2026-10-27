/**
 * Parcours de niveaux : Rookie → Légende (paliers LEVELS du moteur), position
 * du joueur sur la piste, barème XP et emplacement optionnel « Avec ta
 * simulation » (composant client fourni par la page).
 *
 * Les paliers sont répartis à intervalles égaux sur la piste (lisibilité) ;
 * la position du joueur est interpolée DANS son niveau (LevelInfo.pct).
 * Server-safe.
 */
import { Check, Crown } from "lucide-react";
import type { ReactNode } from "react";

import { formatInt, formatXp } from "@/components/arena/format";
import { SectionCard } from "@/components/arena/section-card";
import { LEVELS, XP_RULES, type LevelInfo } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

const BAREME: { label: string; xp: string }[] = [
  { label: "Appel passé", xp: `+${XP_RULES.appel}` },
  { label: "Conversation", xp: `+${XP_RULES.conversation}` },
  { label: "Email envoyé", xp: `+${XP_RULES.email}` },
  { label: "RDV pris", xp: `+${XP_RULES.rdvPris}` },
  { label: "RDV effectué", xp: `+${XP_RULES.rdvEffectue}` },
  { label: "Proposition envoyée", xp: `+${XP_RULES.proposition}` },
  {
    label: "Contrat signé",
    xp: `+${XP_RULES.signature} (+${XP_RULES.signatureParTranche10ChfMensuel} XP par 10 CHF de valeur mensuelle)`,
  },
  { label: "Mission du jour terminée", xp: `+${XP_RULES.missionDuJour}` },
];

export interface LevelPathProps {
  level: LevelInfo;
  initials: string;
  /** Encadré « Avec ta simulation » (client), optionnel. */
  simulationSlot?: ReactNode;
  className?: string;
}

export function LevelPath({ level, initials, simulationSlot, className }: LevelPathProps) {
  const steps = LEVELS.length - 1;
  const idx = level.level - 1;
  const posPct =
    level.level >= LEVELS.length ? 100 : ((idx + level.pct / 100) / steps) * 100;
  const passed = LEVELS.filter((l) => l.level < level.level).map((l) => l.name);
  const aria =
    `Parcours : ${passed.length > 0 ? `${passed.join(" et ")} ${passed.length > 1 ? "atteints" : "atteint"}, ` : ""}` +
    `tu es ${level.name} avec ${formatXp(level.xp)}` +
    (level.nextName ? `, à ${level.pct} % du niveau ${level.nextName}` : ", niveau maximum");

  return (
    <SectionCard
      title="Parcours de niveaux"
      icon={Crown}
      tone="violet"
      description="De Rookie à Légende : chaque appel te fait avancer"
      className={className}
      contentClassName="flex flex-col gap-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 items-center rounded-full bg-lvl-50 px-2.5 text-xs font-bold text-lvl-700">
          Niveau {level.level} · {level.name}
        </span>
        <span className="text-sm font-bold text-foreground tabular-nums">
          {level.nextXp != null ? (
            <>
              {formatInt(level.xp)} / {formatXp(level.nextXp)} ·{" "}
              <span className="text-lvl-700">
                {formatXp(level.xpToNext ?? 0)} avant {level.nextName}
              </span>
            </>
          ) : (
            <>{formatXp(level.xp)} · niveau maximum</>
          )}
        </span>
      </div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="min-w-[520px] px-11">
          <div role="img" aria-label={aria} className="relative h-[120px]">
            <div className="absolute inset-x-0 top-10 h-2 rounded-full bg-lvl-50" />
            <div
              className="absolute top-10 left-0 h-2 rounded-full bg-gradient-coral motion-safe:animate-meter-fill"
              style={{ width: `${posPct}%` }}
            />

            {LEVELS.map((l, i) => {
              const left = `${(i / steps) * 100}%`;
              const isPast = l.level < level.level;
              const isCurrent = l.level === level.level;
              const isNext = l.level === level.level + 1;
              return (
                <div key={l.level}>
                  <div
                    className={cn(
                      "absolute flex -translate-x-1/2 items-center justify-center rounded-full font-extrabold",
                      isCurrent
                        ? "top-5 size-12 border-4 border-lvl-200 bg-lvl-700 font-display text-lg text-white"
                        : "top-6 size-10 text-[15px]",
                      isPast && "bg-lvl-500 text-white",
                      isNext && "border-2 border-dashed border-lvl-500 bg-card text-lvl-700",
                      !isPast && !isCurrent && !isNext && "border-2 border-border-strong bg-card text-muted-foreground",
                    )}
                    style={{ left }}
                  >
                    {isPast ? <Check className="size-[18px]" strokeWidth={2.6} /> : l.level}
                  </div>
                  <div
                    className="absolute top-[74px] w-[84px] -translate-x-1/2 text-center"
                    style={{ left }}
                  >
                    <div
                      className={cn(
                        "text-[13px] font-extrabold",
                        isCurrent ? "text-lvl-700" : "text-foreground",
                      )}
                    >
                      {l.name}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">
                      {formatXp(l.minXp)}
                    </div>
                  </div>
                </div>
              );
            })}

            <div
              className="absolute top-0 -translate-x-1/2 rounded-full bg-navy-700 px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-white"
              style={{ left: `${posPct}%` }}
            >
              Toi · {formatXp(level.xp)}
            </div>
            <div
              className="absolute top-[30px] flex size-7 -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-white bg-coral-400 text-[10px] font-extrabold text-navy-700 shadow-[0_2px_6px_rgba(14,25,54,0.25)]"
              style={{ left: `${posPct}%` }}
            >
              {initials.slice(0, 2)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_420px] flex-col gap-2">
          <div className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            Comment gagner des XP
          </div>
          <ul className="flex flex-wrap gap-2">
            {BAREME.map((x) => (
              <li
                key={x.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-ground px-2.5 py-1.5 text-xs font-semibold text-foreground"
              >
                {x.label} <strong className="text-gold-700">{x.xp}</strong>
              </li>
            ))}
          </ul>
        </div>
        {simulationSlot && <div className="min-w-0 flex-[1_1_260px]">{simulationSlot}</div>}
      </div>
    </SectionCard>
  );
}
