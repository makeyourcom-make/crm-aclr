"use client";

/**
 * Célébrations MYC Arena.
 *
 *   celebrate()                       rafale de confettis plein écran
 *   celebrate({ title: "Contrat signé !", subtitle: "Camping le Rys · Google Ads",
 *               xp: 215, eyebrow: "Bravo Lucille" })   + carte de victoire
 *   xpToast(50, "RDV pris !")         toast navy « RDV pris ! · +50 XP »
 *
 * Fonctionnement : `celebrate()` alimente un petit store module (hors React)
 * et `<CelebrationHost />` (monté UNE fois dans le layout) le lit via
 * useSyncExternalStore et rend les confettis dans un portail React vers
 * document.body. Aucune manipulation DOM manuelle. Les positions aléatoires
 * sont tirées au moment de l'appel (pas pendant le rendu).
 *
 * Mouvement réduit : aucun confetti, la carte s'affiche sans animation.
 * Confettis = UNIQUEMENT pour un contrat signé (charte : rare et mérité).
 */
import { PartyPopper, X, Zap } from "lucide-react";
import { Fragment, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { formatSignedXp } from "./format";
import { CONFETTI_COLORS } from "./tones";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ConfettiPiece {
  id: number;
  /** Position de départ, en vw / vh. */
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  rot: number;
  w: number;
  h: number;
  round: boolean;
  color: string;
  delay: number;
  duration: number;
  flutter: number;
}

interface CelebrationCard {
  title: string;
  subtitle?: string;
  xp?: number;
  eyebrow?: string;
}

interface Burst {
  id: number;
  pieces: ConfettiPiece[];
  card: CelebrationCard | null;
}

const EMPTY: Burst[] = [];
let bursts: Burst[] = EMPTY;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => bursts;
const getServerSnapshot = () => EMPTY;

function dismissBurst(id: number) {
  const next = bursts.filter((b) => b.id !== id);
  bursts = next.length === 0 ? EMPTY : next;
  emit();
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makePieces(count: number): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    // Deux canons (gauche / droite) + un bouquet central.
    const lane = i % 3;
    const x0 = lane === 0 ? rand(4, 12) : lane === 1 ? rand(88, 96) : rand(44, 56);
    const dx =
      lane === 0 ? rand(8, 46) : lane === 1 ? -rand(8, 46) : rand(-30, 30);
    const round = i % 4 === 0;
    pieces.push({
      id: i,
      x0,
      y0: lane === 2 ? rand(58, 66) : rand(70, 80),
      dx,
      dy: -rand(28, 62),
      rot: rand(-900, 900),
      w: round ? rand(8, 10) : rand(6, 10),
      h: round ? 0 : rand(11, 17),
      round,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: rand(0, 0.18),
      duration: rand(1.7, 2.5),
      flutter: rand(0.3, 0.6),
    });
  }
  return pieces;
}

export interface CelebrateOptions {
  /** Titre de la carte de victoire (sans titre : confettis seuls). */
  title?: string;
  subtitle?: string;
  /** XP gagnés affichés dans la carte. */
  xp?: number;
  /** Petit sur-titre (« Bravo Lucille »). */
  eyebrow?: string;
  /** Nombre de confettis (défaut 96). */
  pieces?: number;
}

/** Déclenche une rafale de confettis (+ carte optionnelle). Côté client uniquement. */
export function celebrate(options: CelebrateOptions = {}): void {
  if (typeof window === "undefined") return;
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const count = reduce ? 0 : Math.max(0, Math.min(options.pieces ?? 96, 240));
  const card: CelebrationCard | null = options.title
    ? {
        title: options.title,
        subtitle: options.subtitle,
        xp: options.xp,
        eyebrow: options.eyebrow,
      }
    : null;
  if (count === 0 && !card) return;

  const id = ++seq;
  bursts = [...bursts, { id, pieces: makePieces(count), card }];
  emit();
  window.setTimeout(() => dismissBurst(id), card ? 4500 : 2800);
}

// ---------------------------------------------------------------------------
// Hôte (portail)
// ---------------------------------------------------------------------------

/**
 * À monter une seule fois (layout). Rend en permanence une région live
 * invisible (présente dès le rendu serveur, sinon les lecteurs d'écran
 * n'annoncent pas un contenu inséré en même temps que sa région) ; les
 * confettis et la carte n'apparaissent que pendant une célébration.
 */
export function CelebrationHost() {
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const lastCard = [...active].reverse().find((b) => b.card);
  const announce = lastCard?.card ? announceText(lastCard.card) : "";

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </div>
      {active.length > 0 && <CelebrationPortal active={active} lastCard={lastCard} />}
    </>
  );
}

function announceText(card: CelebrationCard): string {
  return [card.eyebrow, card.title, card.subtitle, card.xp ? formatSignedXp(card.xp) : undefined]
    .filter(Boolean)
    .join(" · ");
}

function CelebrationPortal({
  active,
  lastCard,
}: {
  active: Burst[];
  lastCard: Burst | undefined;
}) {
  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      >
        {active.map((b) => (
          <Fragment key={b.id}>
            {b.pieces.map((p) => (
              <span
                key={p.id}
                className="absolute block motion-safe:animate-confetti-burst motion-reduce:hidden"
                style={
                  {
                    left: `${p.x0}vw`,
                    top: `${p.y0}vh`,
                    "--dx": `${p.dx}vw`,
                    "--dy": `${p.dy}vh`,
                    "--rot": `${p.rot}deg`,
                    animationDuration: `${p.duration}s`,
                    animationDelay: `${p.delay}s`,
                  } as CSSProperties
                }
              >
                <span
                  className="block motion-safe:animate-confetti-flutter"
                  style={{
                    width: p.w,
                    height: p.round ? p.w : p.h,
                    borderRadius: p.round ? 999 : 2,
                    background: p.color,
                    animationDuration: `${p.flutter}s`,
                  }}
                />
              </span>
            ))}
          </Fragment>
        ))}
      </div>

      {lastCard?.card && (
        <div className="pointer-events-none fixed inset-0 z-[101] flex items-center justify-center p-4">
          <VictoryCard
            key={lastCard.id}
            card={lastCard.card}
            onClose={() => dismissBurst(lastCard.id)}
          />
        </div>
      )}
    </>,
    document.body,
  );
}

function VictoryCard({
  card,
  onClose,
}: {
  card: CelebrationCard;
  onClose: () => void;
}) {
  // Annonce faite par la région live permanente de CelebrationHost.
  return (
    <div
      className="pointer-events-auto relative flex w-full max-w-[360px] flex-col items-center gap-2.5 rounded-[20px] border border-border bg-card px-6 pt-7 pb-6 text-center text-card-foreground shadow-arena-lg motion-safe:animate-pop"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer la célébration"
        className="absolute top-2.5 right-2.5 flex size-9 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-navy-50 hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-[16px] bg-win-50 text-win-700"
      >
        <PartyPopper className="size-7" strokeWidth={2} />
      </span>
      {card.eyebrow && (
        <p className="text-[11px] font-bold tracking-[0.08em] text-win-700 uppercase">
          {card.eyebrow}
        </p>
      )}
      <p className="font-display text-[32px] leading-none font-extrabold tracking-[-0.02em]">
        {card.title}
      </p>
      {card.subtitle && (
        <p className="text-sm text-muted-foreground">{card.subtitle}</p>
      )}
      {card.xp !== undefined && card.xp > 0 && (
        <span className="mt-1 rounded-full bg-gold-500 px-4 py-1.5 font-display text-2xl font-extrabold text-navy-700 tabular-nums">
          {formatSignedXp(card.xp)}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast XP
// ---------------------------------------------------------------------------

/**
 * Toast navy discret (2.5 s, non bloquant) : « RDV pris ! » + pastille or
 * « +50 XP ». `sub` optionnel : détail (entreprise, date…).
 */
export function xpToast(xp: number, label: string, sub?: string): void {
  toast.custom(
    (id) => (
      <XpToastCard xp={xp} label={label} sub={sub} onClose={() => toast.dismiss(id)} />
    ),
    { duration: 2500 },
  );
}

function XpToastCard({
  xp,
  label,
  sub,
  onClose,
}: {
  xp: number;
  label: string;
  sub?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-3 rounded-[14px] bg-navy-700 py-3 pr-2 pl-3 text-white shadow-arena-lg sm:w-[356px]">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-navy-600 text-gold-500"
      >
        <Zap className="size-[18px] fill-gold-500" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-extrabold">{label}</span>
        {sub && <span className="truncate text-xs text-navy-300">{sub}</span>}
      </span>
      <span className="shrink-0 rounded-full bg-gold-500 px-2.5 py-1 text-[13px] font-extrabold whitespace-nowrap text-navy-700 tabular-nums">
        {formatSignedXp(xp)}
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-[10px] text-navy-300 transition-colors hover:bg-navy-600 hover:text-white",
        )}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
