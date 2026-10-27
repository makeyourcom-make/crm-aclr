/**
 * Rappel compact (colonne de droite) : RDV dont l'heure est passée, encore à
 * valider, avec un lien vers la carte « RDV à valider » (maquette : carte
 * « Fin de journée »). Rien n'est rendu s'il n'y a rien à valider.
 *
 * Server-safe. Données réelles : mêmes RDV que la carte « RDV à valider ».
 */
import { AlarmClock, ArrowRight } from "lucide-react";

import { formatInt } from "@/components/arena/format";
import { XP_RULES } from "@/lib/gamification/rules";
import type { RdvAValiderItem } from "@/lib/queries/today";

const MAX_NAMES = 2;

export function RdvReminder({ items }: { items: RdvAValiderItem[] }) {
  if (items.length === 0) return null;

  const n = items.length;
  const noms = items
    .slice(0, MAX_NAMES)
    .map((r) => `${r.raisonSociale} (${r.isToday ? r.heure : `${r.quand} ${r.heure}`})`);
  const autres = n - noms.length;

  return (
    <section
      aria-labelledby="rdv-rappel-titre"
      className="flex min-w-0 items-start gap-3.5 rounded-[20px] border border-border-strong bg-navy-50 p-5"
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-navy-700 text-white"
      >
        <AlarmClock className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 id="rdv-rappel-titre" className="text-[15px] leading-snug font-extrabold text-foreground">
          {n > 1 ? `${formatInt(n)} RDV attendent ta validation` : "1 RDV attend ta validation"}
        </h2>
        <p className="text-[13px] leading-relaxed break-words text-muted-foreground">
          {noms.join(", ")}
          {autres > 0 ? ` et ${formatInt(autres)} de plus` : ""}. Chaque RDV effectué rapporte +
          {XP_RULES.rdvEffectue} XP.
        </p>
        <a
          href="#rdv-a-valider"
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-[12px] border border-border-strong bg-card px-3 text-[13px] font-bold text-foreground transition-colors hover:bg-navy-100"
        >
          Aller aux RDV à valider
          <ArrowRight aria-hidden="true" className="size-4" />
        </a>
      </div>
    </section>
  );
}
