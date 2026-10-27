/**
 * Héros de la rubrique Emails (MYC Arena) : « où j'en suis et quoi faire
 * maintenant » en 2 secondes.
 *
 * - Anneau « Objectif mails du jour » (mails envoyés aujourd'hui / objectif).
 * - CTA « Nouveau mail » (dégradé coral) + accès aux filtres anti-spam.
 * - 4 tuiles : réponses obtenues, délai de réponse, leads à capter, XP mails.
 *
 * Toutes les valeurs viennent de `getMailArenaStats` (vraies données).
 * Server component (le bouton de rédaction est un composant client).
 */
import Link from "next/link";
import { ShieldCheck, Zap } from "lucide-react";

import { HeroPanel } from "@/components/arena/hero-panel";
import { ProgressRing } from "@/components/arena/progress-ring";
import { formatInt } from "@/components/arena/format";
import { ComposeEmailButton } from "@/components/emails/compose-email-button";
import { CAPS_CLASS, formatWait } from "@/components/emails/mail-ui";
import { XP_RULES } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

import type { MailArenaStats } from "@/app/(app)/emails/arena-stats";

export function EmailsHero({
  stats,
  leadsToCapture,
}: {
  stats: MailArenaStats;
  /** Fils reçus non rattachés à une entreprise (boîte chargée). */
  leadsToCapture: number;
}) {
  const { sentToday, target } = stats;
  const rest = Math.max(0, target - sentToday);
  const title =
    rest === 0
      ? "Objectif plié, machine de guerre !"
      : `Encore ${rest} mail${rest > 1 ? "s" : ""} et c'est plié`;
  const recordLine =
    stats.sentRecordDay === 0
      ? "Ton premier mail lance le compteur."
      : sentToday > 0 && sentToday >= stats.sentRecordDay
        ? `${formatInt(sentToday)} mail${sentToday > 1 ? "s" : ""} aujourd'hui : c'est ton record, continue !`
        : `Ton record : ${formatInt(stats.sentRecordDay)} mail${stats.sentRecordDay > 1 ? "s" : ""} en un jour.`;
  const replyRate =
    stats.threads7d > 0 ? Math.round((stats.replied7d / stats.threads7d) * 100) : null;
  const fast = stats.avgResponseMinutes !== null && stats.avgResponseMinutes < 60;

  return (
    <HeroPanel aria-labelledby="mail-hero-title" className="flex flex-wrap items-center gap-6">
      <div className="flex min-w-0 flex-[1_1_380px] flex-wrap items-center gap-5">
        <ProgressRing
          value={sentToday}
          max={target}
          size={136}
          stroke={13}
          tone="coral"
          trackColor="#2F4470"
          label={`Objectif mails du jour : ${sentToday} sur ${target}`}
        >
          <span className="score-number text-[44px] text-white">{formatInt(sentToday)}</span>
          <span className="mt-1.5 text-xs font-semibold text-navy-200">
            sur {target} mails
          </span>
        </ProgressRing>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
          <p className={cn(CAPS_CLASS, "text-navy-300")}>Objectif mails du jour</p>
          <h2
            id="mail-hero-title"
            className="font-display text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em] text-white sm:text-[28px]"
          >
            {title}
          </h2>
          <p className="text-sm leading-relaxed text-navy-200">
            Chaque mail rattaché à un client = +{XP_RULES.email} XP. {recordLine} Attaque les
            fils chauds juste en dessous.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2.5">
            <ComposeEmailButton variant="hero" />
            <Link
              href="/emails/filtres"
              className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-navy-500 bg-navy-600 px-4 text-sm font-bold text-white transition-colors hover:bg-navy-500"
            >
              <ShieldCheck className="size-[18px]" aria-hidden="true" />
              Filtres anti-spam
            </Link>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 flex-[1_1_420px] gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        <HeroTile
          label="Réponses obtenues · 7 j"
          value={formatInt(stats.replied7d)}
          sub={
            replyRate !== null
              ? `${replyRate} % des ${formatInt(stats.threads7d)} fils lancés`
              : "Lance des fils : chaque réponse est une victoire"
          }
          subClass="text-lvl-200"
        />
        <HeroTile
          label="Ta réponse moyenne · 7 j"
          value={stats.avgResponseMinutes !== null ? formatWait(stats.avgResponseMinutes * 60_000) : "-"}
          sub={
            stats.avgResponseMinutes === null
              ? "Aucune réponse envoyée cette semaine"
              : fast
                ? "Réflexe éclair · sous 1 h"
                : `Sur ${formatInt(stats.answered7d)} mail${stats.answered7d > 1 ? "s" : ""} répondu${stats.answered7d > 1 ? "s" : ""} · vise moins d'1 h`
          }
          subClass={fast ? "text-gold-500" : "text-navy-200"}
          icon={fast}
        />
        <HeroTile
          label="Leads à capter"
          value={formatInt(leadsToCapture)}
          sub={
            leadsToCapture > 0
              ? "Mails reçus pas encore rattachés au CRM"
              : "Tous tes mails reçus sont rattachés"
          }
          subClass="text-info-50"
        />
        <HeroTile
          label="XP mails aujourd'hui"
          value={`+${formatInt(stats.xpMailsToday)}`}
          sub={`${formatInt(stats.xpMailsToday / XP_RULES.email)} mail${stats.xpMailsToday / XP_RULES.email > 1 ? "s" : ""} lié${stats.xpMailsToday / XP_RULES.email > 1 ? "s" : ""} à un client`}
          subClass="text-gold-500"
        />
      </div>
    </HeroPanel>
  );
}

function HeroTile({
  label,
  value,
  sub,
  subClass,
  icon = false,
}: {
  label: string;
  value: string;
  sub: string;
  subClass: string;
  icon?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-[16px] border border-navy-500 bg-navy-600 px-4 py-3.5">
      <p className={cn(CAPS_CLASS, "text-navy-300")}>{label}</p>
      <p className="score-number text-[30px] break-words text-white sm:text-[32px]">{value}</p>
      <p className={cn("flex items-center gap-1.5 text-xs font-semibold", subClass)}>
        {icon && <Zap className="size-3.5 shrink-0 fill-current" aria-hidden="true" />}
        {sub}
      </p>
    </div>
  );
}
