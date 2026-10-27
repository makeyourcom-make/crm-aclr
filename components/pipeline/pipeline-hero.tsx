"use client";

/**
 * Héros du pipeline : « où j'en suis et quoi faire maintenant ».
 *  - reste à signer pour l'objectif du mois (si un objectif existe), jauge du
 *    CA signé, message coach ;
 *  - anneau des contrats signés (vs objectif de signatures) ;
 *  - « Deal du jour » : le plus gros deal suivi de Négociation, sinon de
 *    Proposition, avec son action directe.
 */
import { ArrowRight, Clock, Flame, Star, Trophy, Zap } from "lucide-react";
import Link from "next/link";

import { HeroPanel, Meter, ProgressRing } from "@/components/arena";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatCHFCompact } from "@/lib/format";
import type { PipelineDeal, PipelineScoreboard } from "@/lib/queries/deals";
import { cn } from "@/lib/utils";

import {
  STAGE_META,
  daysSinceAction,
  formatDayMonth,
  formatHourMinute,
  isDormant,
  isHot,
  nextActionLabel,
  offerLabel,
  dealSignGain,
  pluralize,
} from "./pipeline-meta";

export interface HeroViewText {
  /** « Tes résultats », « Résultats de Lucille »... */
  eyebrow: string;
  /** « ton objectif », « l'objectif de Lucille », « l'objectif de l'équipe ». */
  objPhrase: string;
}

interface PipelineHeroProps {
  view: HeroViewText;
  scoreboard: PipelineScoreboard;
  /** Valeur de la colonne Signé (deals signés pas encore validés). */
  pendingSignedValue: number;
  dealDuJour: PipelineDeal | null;
  nowMs: number;
  monthLabel: string;
  resetLabel: string;
  daysToReset: number;
  isAdmin: boolean;
  onOpenDeal: (deal: PipelineDeal) => void;
  onAdvanceDeal: (deal: PipelineDeal) => void;
}

export function PipelineHero({
  view,
  scoreboard,
  pendingSignedValue,
  dealDuJour,
  nowMs,
  monthLabel,
  resetLabel,
  daysToReset,
  isAdmin,
  onOpenDeal,
  onAdvanceDeal,
}: PipelineHeroProps) {
  const caObj = scoreboard.objective?.caObjectif ?? null;
  const nbObj = scoreboard.objective?.nbSignaturesObjectif ?? null;
  const signe = scoreboard.caSigne;
  const reste = caObj != null ? Math.max(0, caObj - signe) : null;
  const pct = caObj ? Math.min(100, Math.round((signe / caObj) * 100)) : 0;

  let title: string;
  let big: string;
  if (caObj == null) {
    title = `CA signé en ${monthLabel} (contrats validés)`;
    big = formatCHFCompact(signe);
  } else if (reste && reste > 0) {
    title = "À signer ce mois pour atteindre l'objectif";
    big = formatCHFCompact(reste);
  } else {
    title = "Objectif atteint : bonus signé au-dessus de l'objectif";
    big = `+${formatCHFCompact(signe - caObj)}`;
  }

  let coach: string;
  if (caObj == null) {
    coach = isAdmin
      ? "Aucun objectif de CA fixé pour ce mois sur cette vue : fixe-le pour suivre le reste à signer."
      : "Pas encore d'objectif de CA ce mois : chaque signature rapporte quand même.";
  } else if (!reste) {
    coach = "Objectif atteint : tout ce que tu signes maintenant passe au-dessus de l'objectif.";
  } else if (dealDuJour && dealDuJour.montant >= reste) {
    coach = `${dealDuJour.prospect.raisonSociale} suffit à boucler ${view.objPhrase}. Une signature et c'est plié.`;
  } else {
    coach = `Il manque ${formatCHFCompact(reste)} : vise les deals chauds et réveille ceux qui dorment.`;
  }

  return (
    <HeroPanel aria-labelledby="pipeline-hero-titre" className="flex flex-wrap items-stretch gap-7">
      {/* Objectif du mois */}
      <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold tracking-[0.08em] text-lvl-200 uppercase">
            {view.eyebrow} · {monthLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-500 px-2.5 py-1 text-xs font-bold text-white">
            <Clock aria-hidden="true" className="size-3.5 text-coral-400" />
            J-{daysToReset} · remise à zéro de Signé et Perdu le {resetLabel}
          </span>
        </div>
        <h2 id="pipeline-hero-titre" className="text-base font-semibold text-navy-200">
          {title}
        </h2>
        <p className="score-number text-[40px] break-words text-coral-400 sm:text-[56px]">
          {big}
        </p>
        {caObj != null && (
          <Meter
            value={signe}
            max={caObj}
            onDark
            size="lg"
            label={`${formatCHFCompact(signe)} signés`}
            valueLabel={
              <>
                objectif {formatCHFCompact(caObj)} ·{" "}
                <strong className="font-extrabold text-white">{pct} %</strong>
              </>
            }
            className="max-w-[520px]"
          />
        )}
        {pendingSignedValue > 0 && (
          <p className="text-[13px] font-semibold text-navy-200">
            + {formatCHFCompact(pendingSignedValue)} en colonne Signé, en attente de validation
          </p>
        )}
        <p className="flex items-start gap-2 text-sm font-semibold text-white">
          <Zap aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 fill-gold-500 text-gold-500" />
          <span>{coach}</span>
        </p>
        {caObj == null && isAdmin && (
          <Link
            href="/objectifs"
            className="self-start text-sm font-bold text-white underline underline-offset-4 hover:text-coral-100"
          >
            Fixer les objectifs du mois
          </Link>
        )}
      </div>

      {/* Contrats signés */}
      <div className="flex flex-[0_1_180px] flex-col items-center justify-center gap-2.5 max-sm:flex-[1_1_100%]">
        {nbObj != null ? (
          <ProgressRing
            value={scoreboard.nbSignes}
            max={nbObj}
            size={140}
            stroke={12}
            tone="gold"
            trackColor="#2F4470"
            label={`Contrats signés : ${scoreboard.nbSignes} sur ${nbObj}`}
          >
            <span className="score-number text-[40px] text-white">
              {scoreboard.nbSignes}
              <span className="text-xl text-navy-300"> / {nbObj}</span>
            </span>
            <span className="mt-1 text-xs font-semibold text-navy-200">contrats</span>
          </ProgressRing>
        ) : (
          <div className="flex size-[140px] flex-col items-center justify-center rounded-full border-[12px] border-navy-500 text-center">
            <Trophy aria-hidden="true" className="mb-1 size-5 text-gold-500" />
            <span className="score-number text-[36px] text-white">{scoreboard.nbSignes}</span>
            <span className="mt-0.5 text-xs font-semibold text-navy-200">
              {pluralize(scoreboard.nbSignes, "contrat signé", "contrats signés")}
            </span>
          </div>
        )}
        {scoreboard.mrrSigne > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-500 px-2.5 py-1 text-xs font-bold text-white tabular-nums">
            MRR signé · {formatCHFCompact(scoreboard.mrrSigne)} / mois
          </span>
        )}
      </div>

      {/* Deal du jour */}
      {dealDuJour ? (
        <DealDuJour
          deal={dealDuJour}
          nowMs={nowMs}
          onOpenDeal={onOpenDeal}
          onAdvanceDeal={onAdvanceDeal}
        />
      ) : (
        <div className="flex min-w-0 flex-[1_1_300px] flex-col justify-center gap-3 rounded-[16px] border border-navy-500 bg-navy-600 p-5">
          <p className="font-display text-xl font-extrabold text-white">
            Plus rien en négociation
          </p>
          <p className="text-sm text-navy-200">
            Ton pipe a faim : enchaîne une session de phoning pour le remplir.
          </p>
          <Link href="/phoning" className={cn(buttonVariants({ variant: "hero", size: "lg" }), "w-full")}>
            Lancer le phoning
          </Link>
        </div>
      )}
    </HeroPanel>
  );
}

function DealDuJour({
  deal,
  nowMs,
  onOpenDeal,
  onAdvanceDeal,
}: {
  deal: PipelineDeal;
  nowMs: number;
  onOpenDeal: (deal: PipelineDeal) => void;
  onAdvanceDeal: (deal: PipelineDeal) => void;
}) {
  const meta = STAGE_META[deal.stage];
  const negociation = deal.stage === "NEGOCIATION";
  const gain = dealSignGain(deal);
  const offer = offerLabel(deal);
  const ligne = [
    `${meta.label} · proba ${deal.probabilite} %`,
    deal.prospect.ville,
    offer,
  ]
    .filter(Boolean)
    .join(" · ");
  const dormant = isDormant(deal, nowMs);
  const next = deal.nextAction
    ? `${deal.nextAction.overdue ? "En retard : " : ""}${nextActionLabel(deal.nextAction.type)} · ${formatDayMonth(deal.nextAction.date)} · ${formatHourMinute(deal.nextAction.date)}`
    : dormant
      ? `${daysSinceAction(deal, nowMs)} j sans action : relance-le aujourd'hui`
      : negociation
        ? "Prépare la signature : QR code, email ou PDF"
        : "Cale la négociation pendant que le deal est chaud";
  const ctaText = negociation ? "Faire signer" : `Passer en ${STAGE_META.NEGOCIATION.label}`;

  return (
    <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5 rounded-[16px] border border-navy-500 bg-navy-600 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.08em] text-gold-500 uppercase">
          <Star aria-hidden="true" className="size-3.5 fill-gold-500" />
          Deal du jour
        </span>
        {isHot(deal, nowMs) && (
          <span className="inline-flex items-center gap-1 rounded-full bg-coral-50 px-2.5 py-1 text-xs font-bold text-coral-600">
            <Flame aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
            Deal chaud
          </span>
        )}
      </div>
      <p className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] break-words text-white">
        {deal.prospect.raisonSociale}
      </p>
      <p className="text-[13px] font-medium text-navy-200">{ligne}</p>
      <div className="flex flex-wrap items-baseline gap-2.5">
        <span className="score-number text-[28px] text-white">
          {formatCHFCompact(deal.montant)}
        </span>
        <span className="text-xs font-semibold text-navy-200">valeur an 1</span>
      </div>
      <p className="flex items-start gap-2 text-[13px] font-semibold text-white">
        <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-coral-400" />
        <span>{next}</span>
      </p>
      <Button
        type="button"
        variant="hero"
        size="lg"
        className="mt-auto w-full"
        onClick={() => (negociation ? onOpenDeal(deal) : onAdvanceDeal(deal))}
        aria-label={
          negociation
            ? `Faire signer ${deal.prospect.raisonSociale}${gain ? ` (${gain} à la signature)` : ""}`
            : `Passer ${deal.prospect.raisonSociale} en ${STAGE_META.NEGOCIATION.label}`
        }
      >
        {ctaText}
        {negociation && gain && (
          <span className="rounded-full bg-navy-700 px-2 py-0.5 text-xs font-extrabold text-gold-500 [text-shadow:none] tabular-nums">
            {gain}
          </span>
        )}
      </Button>
    </div>
  );
}
