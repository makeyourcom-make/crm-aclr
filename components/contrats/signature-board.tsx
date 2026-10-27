/**
 * Classement du mois (admin) : valeur an 1 signée par commerciale, nombre de
 * signatures vs objectif mensuel, mensuel ajouté. Et la carte « Ton mois »
 * pour la commerciale (ses signatures vs ses objectifs).
 *
 * Server-safe. Données réelles : contrats réellement signés (hors attente).
 */
import { Target, Trophy } from "lucide-react";

import { formatInt } from "@/components/arena/format";
import { Meter } from "@/components/arena/meter";
import { PlayerAvatar, toneForRole } from "@/components/arena/player-avatar";
import { SectionCard } from "@/components/arena/section-card";
import { cn } from "@/lib/utils";

import type { FinancePulse, SignatureBoardEntry } from "@/lib/queries/contracts";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SignatureBoard({
  entries,
  monthLabel,
  meId,
}: {
  entries: SignatureBoardEntry[];
  monthLabel: string;
  meId: string;
}) {
  return (
    <SectionCard
      title={`Classement de ${monthLabel}`}
      icon={Trophy}
      tone="gold"
      description="Valeur an 1 signée ce mois"
      className="flex-[1_1_300px]"
    >
      {entries.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-border-strong px-4 py-6 text-center text-sm font-semibold text-muted-foreground">
          Pas encore de signature ce mois. Le premier contrat ouvre le classement.
        </p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {entries.map((e) => {
            const first = e.rank === 1;
            return (
              <li
                key={e.userId}
                className={cn(
                  "flex flex-col gap-2 rounded-[14px] p-3",
                  first ? "bg-gold-50" : "bg-ground",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "w-6 font-display text-xl font-extrabold tabular-nums",
                      first ? "text-gold-700" : "text-muted-foreground",
                    )}
                  >
                    <span className="sr-only">Rang </span>
                    {e.rank}
                  </span>
                  <PlayerAvatar
                    initials={initialsOf(e.name)}
                    tone={toneForRole(e.role)}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">
                      {e.name}
                      {e.userId === meId && (
                        <span className="ml-1 text-xs font-semibold text-muted-foreground">
                          (toi)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatInt(e.signed)}
                      {e.target != null ? ` / ${formatInt(e.target)}` : ""} signature
                      {e.signed > 1 ? "s" : ""} · +{formatInt(e.mensuel)} CHF / mois
                    </p>
                  </div>
                  <span className="font-display text-lg font-extrabold whitespace-nowrap tabular-nums">
                    {formatInt(e.valeurAn1)}
                  </span>
                </div>
                {e.target != null && e.target > 0 && (
                  <Meter
                    value={e.signed}
                    max={e.target}
                    tone={e.role === "ADMIN" ? "navy" : "coral"}
                    size="sm"
                    segmented={e.target <= 12}
                    label={`Signatures de ${e.name}`}
                    className="[&>div:first-child]:sr-only"
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Montants en CHF, valeur an 1 (one-shot + 12 mensualités).
      </p>
    </SectionCard>
  );
}

/** Carte « Ton mois » (commerciale) : signatures et CA signé vs objectifs. */
export function MyMonthCard({ pulse }: { pulse: FinancePulse }) {
  const target = pulse.signedTarget;
  const caTarget = pulse.caTarget;
  const resteSig = target != null ? Math.max(0, target - pulse.signedCount) : null;
  return (
    <SectionCard
      title={`Ton mois de ${pulse.monthLabel}`}
      icon={Target}
      tone="green"
      description="Signatures réelles, hors contrats en attente"
      className="flex-[1_1_300px]"
    >
      <div className="flex flex-col gap-4">
        {target != null && target > 0 ? (
          <Meter
            value={pulse.signedCount}
            max={target}
            tone="coral"
            size="lg"
            segmented={target <= 12}
            label="Contrats signés"
            hint={
              resteSig === 0
                ? "Objectif atteint, record en vue"
                : `Encore ${formatInt(resteSig ?? 0)} pour l'objectif`
            }
          />
        ) : (
          <p className="text-sm">
            <strong className="font-display text-3xl font-extrabold">
              {formatInt(pulse.signedCount)}
            </strong>{" "}
            contrat{pulse.signedCount > 1 ? "s" : ""} signé
            {pulse.signedCount > 1 ? "s" : ""} ce mois
          </p>
        )}
        {caTarget != null && caTarget > 0 ? (
          <Meter
            value={pulse.signedValue}
            max={caTarget}
            tone="green"
            size="md"
            label="CA signé (an 1)"
            valueLabel={`${formatInt(pulse.signedValue)} / ${formatInt(caTarget)} CHF`}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            CA signé :{" "}
            <strong className="text-foreground">{formatInt(pulse.signedValue)} CHF</strong>{" "}
            (an 1)
          </p>
        )}
        <p className="text-xs font-semibold text-win-700">
          +{formatInt(pulse.signedMensuel)} CHF / mois de récurrent ajoutés ce mois
        </p>
      </div>
    </SectionCard>
  );
}
