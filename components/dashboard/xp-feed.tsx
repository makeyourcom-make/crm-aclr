/**
 * Fil d'activité +XP : dernières actions qui rapportent des XP (appels,
 * conversations, RDV, emails, propositions, signatures), 7 derniers jours.
 * Données : getXpFeed (barème XP_RULES, mêmes critères que le moteur).
 * Server-safe.
 */
import {
  CalendarCheck,
  CalendarPlus,
  FileSignature,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/arena/empty-state";
import { XpPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import type { XpFeedItem, XpFeedKind } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";

import { relativeDay, zTime } from "./dates";

const KIND_META: Record<XpFeedKind, { icon: LucideIcon; tone: Tone }> = {
  appel: { icon: Phone, tone: "coral" },
  conversation: { icon: MessageCircle, tone: "blue" },
  rdvPris: { icon: CalendarPlus, tone: "gold" },
  rdvEffectue: { icon: CalendarCheck, tone: "green" },
  email: { icon: Mail, tone: "teal" },
  proposition: { icon: Send, tone: "violet" },
  signature: { icon: FileSignature, tone: "green" },
};

export function XpFeed({
  items,
  xpToday,
  today,
  className,
}: {
  items: XpFeedItem[];
  xpToday: number;
  /** Clé « AAAA-MM-JJ » du jour (Europe/Zurich). */
  today: string;
  className?: string;
}) {
  return (
    <SectionCard
      title="Fil d'activité"
      icon={Zap}
      tone="gold"
      className={className}
      description="Tes dernières actions et leurs XP"
      action={<XpPill xp={Math.max(0, xpToday)} label="aujourd'hui" />}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={Zap}
          tone="gold"
          title="Ton fil est encore vide"
          description="Chaque appel, mail ou RDV apparaîtra ici avec ses XP."
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
                <XpPill xp={f.xp} />
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
