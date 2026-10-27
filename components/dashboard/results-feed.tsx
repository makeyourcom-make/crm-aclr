/**
 * Derniers résultats : RDV pris, RDV effectués, propositions et contrats
 * signés (avec leurs montants en CHF), 30 derniers jours.
 * Données : getResultsFeed (mêmes critères que lib/gamification).
 * Server-safe.
 */
import {
  CalendarCheck,
  CalendarPlus,
  FileSignature,
  Send,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/arena/empty-state";
import { SectionCard } from "@/components/arena/section-card";
import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import { formatCHF } from "@/lib/format";
import type { ResultFeedItem, ResultFeedKind } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

import { relativeDay, zTime } from "./dates";

const KIND_META: Record<ResultFeedKind, { icon: LucideIcon; tone: Tone }> = {
  rdvPris: { icon: CalendarPlus, tone: "gold" },
  rdvEffectue: { icon: CalendarCheck, tone: "blue" },
  proposition: { icon: Send, tone: "violet" },
  signature: { icon: FileSignature, tone: "green" },
};

/** « CHF 269.90 / mois + CHF 1'500.00 » (rien si aucun montant). */
function montantTexte(m: ResultFeedItem["montant"]): string | null {
  if (!m) return null;
  const parts: string[] = [];
  if (m.mensuel > 0) parts.push(`${formatCHF(m.mensuel)} / mois`);
  if (m.oneShot > 0) parts.push(formatCHF(m.oneShot));
  return parts.length > 0 ? parts.join(" + ") : null;
}

export function ResultsFeed({
  items,
  today,
  className,
}: {
  items: ResultFeedItem[];
  /** Clé « AAAA-MM-JJ » du jour (Europe/Zurich). */
  today: string;
  className?: string;
}) {
  return (
    <SectionCard
      title="Derniers résultats"
      icon={TrendingUp}
      tone="green"
      className={className}
      description="RDV pris, RDV effectués, propositions et signatures · 30 derniers jours"
    >
      {items.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          tone="gold"
          title="Aucun résultat sur 30 jours"
          description="Le prochain RDV pris au téléphone apparaîtra ici, puis la proposition et la signature."
          action={
            <Link
              href="/phoning"
              className="inline-flex h-11 items-center rounded-[12px] bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-navy-600"
            >
              Lancer le phoning
            </Link>
          }
          className="py-8"
        />
      ) : (
        <ul className="flex flex-col">
          {items.map((f) => {
            const meta = KIND_META[f.kind];
            const t = TONE_CLASSES[meta.tone];
            const Icon = meta.icon;
            const rel = relativeDay(f.at, today);
            const quand = rel === "Aujourd'hui" ? zTime(f.at) : `${rel} ${zTime(f.at)}`;
            const montant = montantTexte(f.montant);
            const signe = f.kind === "signature";
            return (
              <li
                key={f.id}
                className="flex items-start gap-3 border-b border-navy-50 py-2.5 first:pt-0 last:border-0 last:pb-0"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-[10px]",
                    t.bg,
                    t.text,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {f.href ? (
                    <Link
                      href={f.href}
                      className="text-[13px] leading-snug font-bold text-foreground hover:underline"
                    >
                      {f.title}
                    </Link>
                  ) : (
                    <span className="text-[13px] leading-snug font-bold text-foreground">
                      {f.title}
                    </span>
                  )}
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {quand}
                    {f.detail ? ` · ${f.detail}` : ""}
                  </span>
                </div>
                {montant && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold whitespace-nowrap tabular-nums",
                      signe ? "bg-win-50 text-win-700" : "bg-navy-50 text-foreground",
                    )}
                  >
                    {signe ? "+" : ""}
                    {montant}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
