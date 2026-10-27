/**
 * Module « Objectifs du mois » du Dashboard (MYC Arena).
 *
 * - 2 jauges demi-cercle : contrats signés et CA signé (vs Objective MENSUEL).
 * - Jauges horizontales : RDV effectués / appels / contacts (mails + RS),
 *   uniquement celles qui ont un objectif chiffré.
 * - Pipeline pondéré (commerciale) et CA signé des 6 derniers mois avec le
 *   meilleur mois des 12 derniers.
 *
 * Sans Objective MENSUEL actif : les réalisés restent affichés, avec un
 * message (admin : lien vers /objectifs ; commerciale : demander à Arthur).
 * Server-safe.
 */
import { ArrowRight, Trophy } from "lucide-react";
import Link from "next/link";

import { formatInt, plural } from "@/components/arena/format";
import { Meter } from "@/components/arena/meter";
import { SectionCard } from "@/components/arena/section-card";
import { TONE_HEX, type Tone } from "@/components/arena/tones";
import { formatCHFCompact, formatNumber } from "@/lib/format";
import type { MonthCalendar, MonthlyObjectiveProgress } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

export function MonthlyGoals({
  progress,
  isAdmin,
  calendar,
  evolution,
  pipeline,
  className,
}: {
  progress: MonthlyObjectiveProgress;
  isAdmin: boolean;
  calendar: MonthCalendar;
  /** CA signé par mois, 12 derniers mois (le dernier = mois en cours). */
  evolution: Array<{ label: string; montant: number }>;
  /** Pipeline pondéré (deals chauds) : commerciale uniquement. */
  pipeline?: { montant: number; deals: number } | null;
  className?: string;
}) {
  const bars = [
    {
      label: "RDV effectués",
      value: progress.nbRdvRealise,
      max: progress.nbRdvObjectif,
      tone: "blue" as Tone,
    },
    {
      label: "Appels",
      value: progress.nbAppelsRealise,
      max: progress.nbAppelsObjectif,
      tone: "coral" as Tone,
    },
    {
      label: "Contacts (mails + RS)",
      value: progress.nbContactsRealise,
      max: progress.nbContactsObjectif,
      tone: "teal" as Tone,
    },
  ].filter((b): b is typeof b & { max: number } => b.max !== null && b.max > 0);

  const contratsTarget =
    progress.hasObjective && progress.nbSignaturesObjectif && progress.nbSignaturesObjectif > 0
      ? progress.nbSignaturesObjectif
      : null;
  const caTarget =
    progress.hasObjective && progress.caObjectif && progress.caObjectif > 0
      ? progress.caObjectif
      : null;

  const contratsLeft = contratsTarget ? Math.max(0, contratsTarget - progress.nbSignaturesRealise) : 0;
  const caLeft = caTarget ? Math.max(0, caTarget - progress.caRealise) : 0;

  return (
    <SectionCard
      title="Objectifs du mois"
      icon={Trophy}
      tone="green"
      className={className}
      description={`${calendar.label} · ${calendar.pctEcoule} % du mois écoulé · ${plural(calendar.joursOuvresRestants, "jour ouvré restant", "jours ouvrés restants")}, aujourd'hui compris`}
      action={
        isAdmin ? (
          <Link
            href="/objectifs"
            className="inline-flex min-h-6 items-center gap-1 text-[13px] font-bold text-info-700 hover:underline"
          >
            Gérer les objectifs
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : undefined
      }
      contentClassName="flex flex-col gap-5"
    >
      {!progress.hasObjective && (
        <div className="rounded-[14px] border border-dashed border-border-strong bg-ground px-4 py-3 text-[13px]">
          <p className="font-bold text-foreground">
            Pas d&apos;objectif mensuel fixé pour ce mois.
          </p>
          <p className="mt-0.5 font-medium text-muted-foreground">
            {isAdmin
              ? "Crée-en un depuis Objectifs (templates rapides Démarrage / Croisière / Performance disponibles)."
              : "Demande à Arthur de t'en fixer un. En attendant, voici ton réalisé du mois."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SemiGauge
          title="Contrats signés"
          tone="green"
          value={progress.nbSignaturesRealise}
          target={contratsTarget}
          valueText={formatInt(progress.nbSignaturesRealise)}
          targetText={contratsTarget ? `/ ${formatInt(contratsTarget)}` : "ce mois"}
          ariaLabel={
            contratsTarget
              ? `Contrats signés : ${progress.nbSignaturesRealise} sur ${contratsTarget}`
              : `Contrats signés ce mois : ${progress.nbSignaturesRealise}`
          }
          message={
            !contratsTarget
              ? "Pas d'objectif chiffré ce mois"
              : contratsLeft === 0
                ? "Objectif atteint, bravo !"
                : `Encore ${plural(contratsLeft, "contrat")} pour boucler ${calendar.mois}`
          }
        />
        <SemiGauge
          title="CA signé"
          tone="gold"
          value={progress.caRealise}
          target={caTarget}
          valueText={formatNumber(Math.round(progress.caRealise))}
          targetText={caTarget ? `/ ${formatNumber(Math.round(caTarget))} CHF` : "CHF ce mois"}
          ariaLabel={
            caTarget
              ? `CA signé : ${formatCHFCompact(progress.caRealise)} sur ${formatCHFCompact(caTarget)}`
              : `CA signé ce mois : ${formatCHFCompact(progress.caRealise)}`
          }
          message={
            !caTarget
              ? "Pas d'objectif chiffré ce mois"
              : caLeft === 0
                ? "Objectif atteint, bravo !"
                : `Reste ${formatCHFCompact(caLeft)} à signer`
          }
        />
      </div>

      <div className="flex flex-wrap gap-6">
        {(bars.length > 0 || pipeline) && (
          <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-4">
            {bars.map((b) => (
              <Meter
                key={b.label}
                label={b.label}
                value={b.value}
                max={b.max}
                tone={b.tone}
                size="lg"
              />
            ))}
            {pipeline && (
              <Link
                href="/pipeline"
                className="group mt-auto flex items-center justify-between gap-3 rounded-[14px] border border-border p-3.5 transition-colors hover:border-border-strong hover:bg-ground"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Pipeline pondéré
                  </span>
                  <span className="font-display text-xl font-extrabold text-lvl-700 tabular-nums">
                    {formatCHFCompact(pipeline.montant)}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {plural(pipeline.deals, "deal chaud", "deals chauds")} (proposition, négociation)
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                />
              </Link>
            )}
          </div>
        )}
        <CaBars data={evolution} objectif={caTarget} className="flex-[1_1_260px]" />
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Jauge demi-cercle
// ---------------------------------------------------------------------------

function SemiGauge({
  title,
  tone,
  value,
  target,
  valueText,
  targetText,
  message,
  ariaLabel,
}: {
  title: string;
  tone: Tone;
  value: number;
  target: number | null;
  valueText: string;
  targetText: string;
  message: string;
  ariaLabel: string;
}) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const reached = target !== null && value >= target;
  const t: Tone = reached ? "green" : tone;
  const hex = TONE_HEX[t];
  const ARC = "M 22 112 A 88 88 0 0 1 198 112";
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 rounded-[16px] bg-ground p-4 sm:p-5">
      <div className="relative w-full max-w-[220px]">
        <svg
          viewBox="0 0 220 124"
          role="img"
          aria-label={target ? `${ariaLabel}, ${pct} %` : ariaLabel}
          className="block h-auto w-full"
        >
          <path d={ARC} fill="none" stroke="#E3E7F2" strokeWidth={18} strokeLinecap="round" />
          {target !== null && pct > 0 && (
            <path
              d={ARC}
              fill="none"
              stroke={hex.solid}
              strokeWidth={18}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${pct} 100`}
            />
          )}
        </svg>
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0.5 flex flex-col items-center leading-none"
        >
          <span className="score-number text-[30px] text-foreground sm:text-[36px]">
            {valueText}
          </span>
          <span className="mt-1 text-[13px] font-bold text-muted-foreground">{targetText}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <h3 className="text-[15px] font-extrabold text-foreground">{title}</h3>
        {target !== null && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums"
            style={{ background: hex.soft, color: hex.text }}
          >
            {pct} %
          </span>
        )}
      </div>
      <p className="text-center text-[13px] font-semibold text-muted-foreground">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CA signé : 6 derniers mois (record sur 12 mois)
// ---------------------------------------------------------------------------

const BAR_MAX = 110;

function capitalize(s: string): string {
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : s;
}

function CaBars({
  data,
  objectif,
  className,
}: {
  data: Array<{ label: string; montant: number }>;
  objectif: number | null;
  className?: string;
}) {
  if (data.length === 0) return null;
  const offset = Math.max(0, data.length - 6);
  const last6 = data.slice(offset);
  let bestIdx = 0;
  data.forEach((d, i) => {
    if (d.montant > data[bestIdx].montant) bestIdx = i;
  });
  const best = data[bestIdx];
  const currentIdx = data.length - 1;
  const current = data[currentIdx];
  const max = Math.max(1, objectif ?? 0, ...last6.map((d) => d.montant));
  const objH = objectif ? Math.round((objectif / max) * BAR_MAX) : null;

  const aria = `CA signé des 6 derniers mois : ${last6
    .map((d, i) => {
      const idx = offset + i;
      const suffix =
        idx === bestIdx && best.montant > 0 ? " (meilleur mois)" : idx === currentIdx ? " (en cours)" : "";
      return `${d.label} ${formatCHFCompact(d.montant)}${suffix}`;
    })
    .join(", ")}`;

  let caption: string;
  if (best.montant <= 0) {
    caption = "Pas encore de CA signé sur les 12 derniers mois : le premier contrat ouvre le compteur.";
  } else if (bestIdx === currentIdx) {
    caption = `Ce mois-ci est ton meilleur mois sur 12 mois : ${formatCHFCompact(current.montant)}. Record en cours !`;
  } else {
    caption = `Meilleur mois sur 12 mois : ${best.label}, ${formatCHFCompact(best.montant)}. Encore ${formatCHFCompact(best.montant - current.montant)} ce mois pour l'égaler.`;
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-2.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-extrabold text-foreground">CA signé · 6 derniers mois</h3>
        {objectif && (
          <span className="text-xs font-semibold text-muted-foreground">
            objectif {formatCHFCompact(objectif)}
          </span>
        )}
      </div>
      <div
        role="img"
        aria-label={aria}
        className="relative flex h-[132px] items-end gap-2 border-b border-border-strong pt-1 sm:gap-2.5"
      >
        {objH !== null && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 border-t-2 border-dashed border-border-strong"
            style={{ bottom: objH }}
          />
        )}
        {last6.map((d, i) => {
          const idx = offset + i;
          const isBest = idx === bestIdx && best.montant > 0;
          const isCurrent = idx === currentIdx;
          const h = d.montant > 0 ? Math.max(4, Math.round((d.montant / max) * BAR_MAX)) : 2;
          return (
            <div
              key={`${d.label}-${idx}`}
              aria-hidden="true"
              className="flex h-[128px] min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <span
                className={cn(
                  "text-[11px] font-extrabold tabular-nums",
                  isBest ? "text-gold-700" : isCurrent ? "text-coral-600" : "text-muted-foreground",
                )}
              >
                {formatNumber(Math.round(d.montant))}
              </span>
              <div
                className={cn(
                  "w-full max-w-9 rounded-t-[8px] rounded-b-[3px]",
                  isBest ? "bg-gold-500" : isCurrent ? "bg-coral-500" : "bg-border-strong",
                )}
                style={{ height: h }}
              />
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="flex gap-2 sm:gap-2.5">
        {last6.map((d, i) => (
          <span
            key={`${d.label}-l-${i}`}
            className={cn(
              "min-w-0 flex-1 text-center text-xs font-bold",
              offset + i === currentIdx ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {capitalize(d.label)}
          </span>
        ))}
      </div>
      <p className="text-xs font-semibold text-muted-foreground">{caption}</p>
    </div>
  );
}
