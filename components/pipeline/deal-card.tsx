"use client";

/**
 * Carte deal du pipeline.
 *
 *  - <DealCardView />      présentation pure (utilisée aussi dans le DragOverlay)
 *  - <DraggableDealCard /> la même carte, déplaçable (useDraggable de dnd-kit)
 *
 * Contenu : progression d'étape, entreprise + titre, ville + offre, avatar du
 * responsable, montant + probabilité, âge et jours sans action (alerte rouge
 * au-delà de 7 jours), prochaine action réelle, statut de signature, pastille
 * « Deal chaud » ; actions : appeler, changer d'étape, supprimer, Avancer.
 *
 * Un clic sur la carte ouvre le deal (contrat lié s'il existe, sinon le
 * panneau de détail), comme avant. Le nom de l'entreprise est un vrai bouton
 * pour l'accès clavier.
 */
import { useDraggable } from "@dnd-kit/core";
import type { DealStage } from "@prisma/client";
import {
  ArrowRight,
  Clock,
  FileText,
  Flame,
  Lightbulb,
  Star,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import type { HTMLAttributes, MouseEvent, Ref, SyntheticEvent } from "react";

import { PlayerAvatar, StatusPill, toneForRole } from "@/components/arena";
import { DeleteDealButton } from "@/components/common/entity-delete-buttons";
import { Button } from "@/components/ui/button";
import { initialsOf } from "@/lib/gamification/rules";
import { formatCHFCompact } from "@/lib/format";
import type { PipelineDeal } from "@/lib/queries/deals";
import { cn } from "@/lib/utils";

import { CallDealButton, StageMenu } from "./deal-card-actions";
import {
  BOARD_STAGES,
  STAGE_META,
  daysBetween,
  daysSinceAction,
  dealMensuel,
  dealOneShot,
  formatDayMonth,
  formatDayMonthYear,
  formatHourMinute,
  isActiveStage,
  isCloseOverdue,
  isDormant,
  isHot,
  nextActionLabel,
  offerLabel,
  parseRaisonPerte,
  signatureState,
  type SignatureState,
} from "./pipeline-meta";

export interface DealCardHandlers {
  onOpen: (deal: PipelineDeal) => void;
  onMove: (deal: PipelineDeal, stage: DealStage) => void;
}

export interface DealCardViewProps extends DealCardHandlers {
  deal: PipelineDeal;
  nowMs: number;
  variant?: "board" | "lost";
  /** Copie flottante pendant le glisser-déposer (non interactive). */
  overlay?: boolean;
  dragging?: boolean;
  rootRef?: Ref<HTMLElement>;
  /** Écouteurs dnd-kit (onMouseDown / onTouchStart...). */
  dragListeners?: HTMLAttributes<HTMLElement>;
}

/** Empêche un clic / appui dans la zone d'actions d'ouvrir ou de saisir la carte. */
const stop = (e: SyntheticEvent) => e.stopPropagation();
const STOP_PROPS = {
  onClick: stop,
  onMouseDown: stop,
  onPointerDown: stop,
  onTouchStart: stop,
};

function probaClasses(p: number): string {
  if (p >= 70) return "bg-win-50 text-win-700";
  if (p >= 40) return "bg-gold-50 text-gold-700";
  return "bg-navy-50 text-muted-foreground";
}

function amountLine(d: PipelineDeal): { main: string; showAn1: boolean } {
  const one = dealOneShot(d);
  const mens = dealMensuel(d);
  if (one > 0 && mens > 0) {
    return {
      main: `${formatCHFCompact(one)} + ${formatCHFCompact(mens)} / mois`,
      showAn1: true,
    };
  }
  if (mens > 0) return { main: `${formatCHFCompact(mens)} / mois`, showAn1: true };
  return { main: formatCHFCompact(d.montant), showAn1: false };
}

export function DealCardView({
  deal,
  nowMs,
  variant = "board",
  overlay = false,
  dragging = false,
  rootRef,
  dragListeners,
  onOpen,
  onMove,
}: DealCardViewProps) {
  const ent = deal.prospect.raisonSociale;
  const meta = STAGE_META[deal.stage];
  const active = isActiveStage(deal.stage);
  const signe = deal.stage === "SIGNE";
  const lost = variant === "lost" || deal.stage === "PERDU";
  const dormant = isDormant(deal, nowMs);
  const hot = isHot(deal, nowMs);
  const sa = daysSinceAction(deal, nowMs);
  const offer = offerLabel(deal);
  const amount = amountLine(deal);
  const sigState = signatureState(deal);
  const next = meta.next;

  const handleRootClick = (e: MouseEvent<HTMLElement>) => {
    if (overlay || dragging) return;
    // Clic venu d'un portail (menu, boîte de dialogue) ou d'un contrôle de la
    // carte : géré par ce contrôle.
    const target = e.target as Node;
    if (!e.currentTarget.contains(target)) return;
    if (
      target instanceof Element &&
      target.closest("button, a, input, textarea, select, [role='menuitem']")
    ) {
      return;
    }
    onOpen(deal);
  };

  const ariaLabel = `${ent}, ${meta.label}, ${formatCHFCompact(deal.montant)}, probabilité ${deal.probabilite} %`;

  // -------------------------------------------------------------------------
  // Variante « Leçons du mois » (étape Perdu)
  // -------------------------------------------------------------------------
  if (lost) {
    const { raison, lecon } = parseRaisonPerte(deal.raisonPerte);
    const ligne = [deal.prospect.ville, offer, formatCHFCompact(deal.montant)]
      .filter(Boolean)
      .join(" · ");
    return (
      <article
        ref={rootRef}
        aria-label={ariaLabel}
        aria-hidden={overlay || undefined}
        onClick={handleRootClick}
        {...dragListeners}
        className={cn(
          "flex min-w-0 cursor-grab touch-manipulation flex-col gap-2 rounded-[14px] border border-l-4 border-border border-l-alert-500 bg-card p-3.5 active:cursor-grabbing",
          dragging && "opacity-40",
          overlay && "pointer-events-none rotate-1 shadow-arena-lg",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm leading-tight font-extrabold">
              <button
                type="button"
                onClick={() => onOpen(deal)}
                className="text-left hover:underline"
              >
                {ent}
              </button>
            </h3>
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{ligne}</p>
          </div>
          <StatusPill tone="red" dot={false} className="max-w-[45%] truncate">
            {raison ?? "Raison non renseignée"}
          </StatusPill>
        </div>
        {lecon && (
          <p className="flex items-start gap-2 text-[13px] font-semibold text-foreground">
            <Lightbulb aria-hidden="true" className="mt-0.5 size-[15px] shrink-0 text-gold-700" />
            <span className="min-w-0 break-words">{lecon}</span>
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {deal.closeReelLe ? `Perdu le ${formatDayMonth(deal.closeReelLe)}` : "Perdu"}
            {" · "}
            {deal.assigneA.name}
          </span>
          {!overlay && (
            <span className="flex items-center gap-1.5" {...STOP_PROPS}>
              <StageMenu deal={deal} onMove={onMove} onOpen={onOpen} />
              <DeleteDealButton dealId={deal.id} variant="icon" />
            </span>
          )}
        </div>
      </article>
    );
  }

  // -------------------------------------------------------------------------
  // Carte du Kanban
  // -------------------------------------------------------------------------
  const idx = BOARD_STAGES.indexOf(deal.stage);
  const age = signe && deal.closeReelLe
    ? daysBetween(deal.createdAt, new Date(deal.closeReelLe).getTime())
    : daysBetween(deal.createdAt, nowMs);
  const closeOverdue = isCloseOverdue(deal, nowMs);

  // Prochaine action
  let nextText: string;
  let nextSub: string | null = null;
  let nextTone: "neutral" | "alert" = "neutral";
  if (signe) {
    // Deal signé : la pastille de signature + le lien contrat suffisent.
    nextText = "";
  } else if (deal.nextAction) {
    const a = deal.nextAction;
    const when = `${formatDayMonth(a.date)} · ${formatHourMinute(a.date)}`;
    nextText = a.overdue
      ? `En retard : ${nextActionLabel(a.type)} du ${when}`
      : `${nextActionLabel(a.type)} · ${when}`;
    nextSub = a.sujet || null;
    if (a.overdue) nextTone = "alert";
  } else if (deal.closeAttenduLe) {
    nextText = closeOverdue
      ? `Close attendu dépassé : ${formatDayMonthYear(deal.closeAttenduLe)}`
      : `Close attendu le ${formatDayMonthYear(deal.closeAttenduLe)}`;
    if (closeOverdue) nextTone = "alert";
  } else {
    nextText = dormant
      ? "Rien de planifié : relance-le aujourd'hui"
      : "Aucune action planifiée";
  }
  if (dormant && nextTone === "neutral") nextTone = "alert";

  return (
    <article
      ref={rootRef}
      aria-label={ariaLabel}
      aria-hidden={overlay || undefined}
      onClick={handleRootClick}
      {...dragListeners}
      className={cn(
        "flex min-w-0 cursor-grab touch-manipulation flex-col gap-2.5 rounded-[14px] bg-card p-3.5 text-card-foreground shadow-arena transition-shadow hover:shadow-arena-lg active:cursor-grabbing",
        signe
          ? "border-2 border-gold-500"
          : dormant
            ? "border border-[#F3B7B9]"
            : "border border-border",
        dragging && "opacity-40",
        overlay && "pointer-events-none rotate-1 shadow-arena-lg",
      )}
    >
      {/* Progression d'étape */}
      <div aria-hidden="true" className="flex gap-1">
        {BOARD_STAGES.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full",
              i <= idx ? meta.bar : "bg-border",
            )}
          />
        ))}
      </div>

      {/* Entreprise + responsable */}
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {(hot || signe) && (
            <div className="flex flex-wrap gap-1.5">
              {hot && (
                <StatusPill tone="coral" icon={Flame} className="[&_svg]:fill-coral-100">
                  Deal chaud
                </StatusPill>
              )}
              {signe && (
                <StatusPill tone="gold" icon={Star} className="[&_svg]:fill-gold-500">
                  Signé
                  {deal.closeReelLe ? ` · ${formatDayMonth(deal.closeReelLe)}` : ""}
                </StatusPill>
              )}
            </div>
          )}
          <h3 className="text-[15px] leading-tight font-extrabold break-words">
            <button
              type="button"
              onClick={() => onOpen(deal)}
              className="text-left hover:underline"
            >
              {ent}
            </button>
          </h3>
          <p className="line-clamp-2 text-xs font-semibold text-muted-foreground">
            {deal.titre}
          </p>
          {(deal.prospect.ville || offer) && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              {deal.prospect.ville}
              {offer && (
                <span className="max-w-full truncate rounded-full bg-lvl-50 px-2 py-0.5 text-[11px] font-bold text-lvl-700">
                  {offer}
                </span>
              )}
            </p>
          )}
        </div>
        <span title={deal.assigneA.name} className="shrink-0">
          <PlayerAvatar
            initials={initialsOf(deal.assigneA.name)}
            tone={toneForRole(deal.assigneA.role)}
            size="xs"
            label={`Responsable : ${deal.assigneA.name}`}
          />
        </span>
      </div>

      {/* Montant + probabilité */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold break-words tabular-nums">{amount.main}</p>
          {amount.showAn1 && (
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
              Valeur an 1 · {formatCHFCompact(deal.montant)}
            </p>
          )}
        </div>
        <span
          title="Probabilité de signature"
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums",
            probaClasses(deal.probabilite),
          )}
        >
          <span className="sr-only">Probabilité </span>
          {deal.probabilite} %
        </span>
      </div>

      {/* Âge + jours sans action */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock aria-hidden="true" className="size-3.5" />
          {signe ? `Signé en ${age} j` : `${age} j dans le pipe`}
        </span>
        {active &&
          (dormant ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-alert-50 px-2 py-0.5 text-[11px] font-extrabold text-alert-700 motion-safe:animate-pulse-ring">
              <TriangleAlert aria-hidden="true" className="size-3" strokeWidth={2.4} />
              {sa} j sans action
            </span>
          ) : (
            <span>· {sa === 0 ? "action aujourd'hui" : `${sa} j sans action`}</span>
          ))}
        {active && deal.closeAttenduLe && deal.nextAction && (
          <span className={cn(closeOverdue && "font-bold text-alert-700")}>
            · {closeOverdue ? "close dépassé" : "close"} {formatDayMonth(deal.closeAttenduLe)}
          </span>
        )}
      </div>

      {/* Prochaine action */}
      {!signe && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-[10px] px-2.5 py-2 text-[13px] font-semibold text-foreground",
            nextTone === "alert" ? "bg-coral-50" : "bg-ground",
          )}
        >
          <ArrowRight
            aria-hidden="true"
            strokeWidth={2.2}
            className={cn(
              "mt-0.5 size-[15px] shrink-0",
              nextTone === "alert" ? "text-alert-700" : "text-lvl-700",
            )}
          />
          <span className="min-w-0 break-words">
            <span className="sr-only">Prochaine action : </span>
            {nextText}
            {nextSub && (
              <span className="block truncate text-xs font-medium text-muted-foreground">
                {nextSub}
              </span>
            )}
          </span>
        </p>
      )}

      {/* Statut de signature (contrat lié), même logique qu'avant */}
      {sigState && <SignatureBadge state={sigState} />}

      {/* Actions */}
      {!overlay && (
        <div className="flex flex-wrap items-center gap-1.5" {...STOP_PROPS}>
          {active && <CallDealButton deal={deal} />}
          <StageMenu deal={deal} onMove={onMove} onOpen={onOpen} />
          <DeleteDealButton dealId={deal.id} variant="icon" />
          {active && next && (
            <Button
              type="button"
              size="default"
              onClick={() => onMove(deal, next)}
              aria-label={`Avancer ${ent} en ${STAGE_META[next].label}`}
              title={`Passer en ${STAGE_META[next].label}`}
              className="min-w-[8.5rem] flex-[1_1_8.5rem] rounded-[10px] px-2.5"
            >
              Avancer
            </Button>
          )}
          {signe && (
            <Link
              href={
                deal.contract
                  ? `/contrats/${deal.contract.id}`
                  : `/contrats/nouveau?dealId=${deal.id}`
              }
              className="inline-flex h-9 min-w-[8.5rem] flex-[1_1_8.5rem] items-center justify-center gap-1.5 rounded-[10px] border border-border-strong bg-card px-2.5 text-[13px] font-bold text-foreground transition-colors hover:bg-navy-50"
            >
              <FileText aria-hidden="true" className="size-[15px] shrink-0" />
              <span className="truncate">
                {deal.contract ? "Voir le contrat" : "Créer le contrat"}
              </span>
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

const SIGNATURE_BADGE: Record<
  Exclude<SignatureState, null>,
  { text: string; className: string }
> = {
  "client-signed": {
    text: "Signé client · attend validation Arthur",
    className: "bg-win-50 text-win-700",
  },
  "contract-ready": {
    text: "Contrat prêt - en attente signature client",
    className: "bg-info-50 text-info-700",
  },
  "marked-signed": {
    text: "Marqué signé - créer le contrat",
    className: "bg-gold-50 text-gold-700",
  },
};

function SignatureBadge({ state }: { state: Exclude<SignatureState, null> }) {
  const b = SIGNATURE_BADGE[state];
  return (
    <span
      className={cn(
        "self-start rounded-full px-2.5 py-1 text-[11px] leading-tight font-extrabold",
        b.className,
      )}
    >
      {b.text}
    </span>
  );
}

export interface DraggableDealCardProps extends DealCardHandlers {
  deal: PipelineDeal;
  nowMs: number;
  variant?: "board" | "lost";
}

export function DraggableDealCard(props: DraggableDealCardProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: props.deal.id,
    data: { stage: props.deal.stage },
  });
  return (
    <DealCardView
      {...props}
      rootRef={setNodeRef}
      dragListeners={listeners as HTMLAttributes<HTMLElement> | undefined}
      dragging={isDragging}
    />
  );
}
