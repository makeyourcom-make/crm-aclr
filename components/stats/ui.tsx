/**
 * Petites briques de la rubrique Statistiques (MYC Arena), server-safe :
 *  - <Money>       : gros montant + « CHF » discret (format CRM « 13'525 ») ;
 *  - <RankBadge>   : médaille de rang (or, argent, bronze coral, neutre) ;
 *  - <Eyebrow>     : libellé en majuscules 11 px ;
 *  - segmentClass  : bouton / lien d'un contrôle segmenté ;
 *  - <SegmentGroup>: conteneur accessible d'un contrôle segmenté ;
 *  - cleanText     : remplace les grands tirets venant des données.
 */
import type { ReactNode } from "react";

import { formatInt } from "@/components/arena/format";
import { cn } from "@/lib/utils";

const zurichDateFmt = new Intl.DateTimeFormat("fr-CH", {
  timeZone: "Europe/Zurich",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Date au format suisse « 27.10.2026 », jour vu de Suisse. */
export function formatZurichDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? "-" : zurichDateFmt.format(date);
}

/** Teintes d'une marge (barre + texte) : négative rouge, < 25 % or, sinon vert. */
export function marginTone(pct: number | null): { bar: string; text: string } {
  if (pct === null) return { bar: "bg-navy-100", text: "text-muted-foreground" };
  if (pct < 0) return { bar: "bg-alert-500", text: "text-alert-700" };
  if (pct < 0.25) return { bar: "bg-gold-500", text: "text-gold-700" };
  return { bar: "bg-win-500", text: "text-win-700" };
}

/** Tirets demi-cadratin (U+2013) et cadratin (U+2014), construits par code. */
const LONG_DASH_RE = new RegExp(`\\s*[${String.fromCharCode(0x2013, 0x2014)}]\\s*`, "g");

/** Les données (fournisseurs, modèles de charges…) peuvent contenir des grands tirets : on les remplace. */
export function cleanText(s: string | null | undefined): string {
  return (s ?? "").replace(LONG_DASH_RE, " - ").trim();
}

export function Money({
  value,
  className,
  unitClassName,
  signed = false,
}: {
  value: number;
  className?: string;
  unitClassName?: string;
  /** Préfixe « + » pour les valeurs positives. */
  signed?: boolean;
}) {
  const n = Number.isFinite(value) ? Math.round(value) : 0;
  const text = `${n < 0 ? "-" : signed && n > 0 ? "+" : ""}${formatInt(Math.abs(n))}`;
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)}>
      {text}
      <span
        className={cn(
          "ml-1 align-baseline font-sans text-[0.45em] font-bold tracking-normal text-muted-foreground",
          unitClassName,
        )}
      >
        CHF
      </span>
    </span>
  );
}

export function RankBadge({ rank, size = 28 }: { rank: number; size?: number }) {
  const style =
    rank === 1
      ? "border-gold-500 bg-gold-50 text-gold-700"
      : rank === 2
        ? "border-navy-300 bg-navy-50 text-navy-500"
        : rank === 3
          ? "border-coral-400 bg-coral-50 text-coral-600"
          : "border-border bg-ground text-muted-foreground";
  return (
    <span
      role="img"
      aria-label={`Rang ${rank}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2 text-xs font-extrabold tabular-nums",
        style,
      )}
      style={{ width: size, height: size }}
    >
      {rank}
    </span>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Classe d'un segment (bouton ou lien) : actif = navy plein. */
export function segmentClass(active: boolean, className?: string): string {
  return cn(
    "inline-flex h-9 min-w-0 items-center justify-center rounded-[10px] px-3 text-[13px] font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-info-500/50",
    active ? "bg-navy-700 text-white shadow-sm" : "text-foreground hover:bg-navy-50",
    className,
  );
}

export function SegmentGroup({
  label,
  visibleLabel,
  children,
  className,
  muted = false,
}: {
  /** Nom accessible du groupe. */
  label: string;
  /** Libellé affiché devant les segments (« Période : »). */
  visibleLabel?: string;
  children: ReactNode;
  className?: string;
  /** Fond gris (dans une carte) plutôt que blanc (sur le fond de page). */
  muted?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex max-w-full flex-wrap items-center gap-1 rounded-[14px] p-1",
        muted ? "bg-ground" : "border border-border bg-card",
        className,
      )}
    >
      {visibleLabel && (
        <span aria-hidden="true" className="px-2 text-xs font-bold text-muted-foreground">
          {visibleLabel}
        </span>
      )}
      {children}
    </div>
  );
}

/** Mini tuile de chiffre (fond gris clair) utilisée dans les cartes. */
export function MiniStat({
  label,
  value,
  sub,
  tone = "neutral",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "green" | "red" | "gold";
  className?: string;
}) {
  const bg =
    tone === "green"
      ? "bg-win-50"
      : tone === "red"
        ? "bg-alert-50"
        : tone === "gold"
          ? "bg-gold-50"
          : "bg-ground";
  const text =
    tone === "green"
      ? "text-win-700"
      : tone === "red"
        ? "text-alert-700"
        : tone === "gold"
          ? "text-gold-700"
          : "text-muted-foreground";
  const valueText =
    tone === "green"
      ? "text-win-700"
      : tone === "red"
        ? "text-alert-700"
        : tone === "gold"
          ? "text-gold-700"
          : "text-foreground";
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-[14px] p-3.5", bg, className)}>
      <span className={cn("text-xs font-semibold", text)}>{label}</span>
      <span className={cn("font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em]", valueText)}>
        {value}
      </span>
      {sub && <span className={cn("text-xs", text)}>{sub}</span>}
    </div>
  );
}
