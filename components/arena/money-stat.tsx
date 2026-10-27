/**
 * Tuile de montant en CHF (CA signé, commissions, MRR, valeur d'un deal...).
 * Variante de StatTile : le montant est formaté au format CRM et, si un
 * objectif est fourni, le sous-texte dit ce qu'il manque (jamais inventé :
 * sans objectif, pas de texte d'objectif).
 *
 *   <MoneyStat label="CA signé ce mois" amount={6831.2} target={10000}
 *              icon={Banknote} tone="green" href="/contrats" />
 *     → « CHF 6'831 » · « Il manque CHF 3'169 pour l'objectif (CHF 10'000) »
 *   <MoneyStat label="Plus gros contrat" amount={269.9} perMonth cents />
 *     → « CHF 269.90 / mois »
 *
 * Server-safe.
 */
import type { ReactNode } from "react";

import { formatCHF, formatCHFCompact } from "@/lib/format";

import { StatTile, type StatTileProps } from "./stat-tile";

export interface MoneyStatProps extends Omit<StatTileProps, "value" | "sub"> {
  /** Montant en CHF (null / absent : « CHF 0 »). */
  amount: number | null | undefined;
  /** Montant mensuel : ajoute « / mois ». */
  perMonth?: boolean;
  /** Affiche les centimes (défaut : arrondi au franc). */
  cents?: boolean;
  /** Objectif en CHF : sous-texte « Il manque ... » ou « Objectif atteint ». */
  target?: number | null;
  /** Sous-texte libre (prioritaire sur le texte d'objectif). */
  sub?: ReactNode;
}

/** « CHF 6'831 » (ou « CHF 269.90 » avec `cents`). */
export function formatMoneyAmount(amount: number | null | undefined, cents = false): string {
  const n = amount != null && Number.isFinite(amount) ? amount : 0;
  return cents ? formatCHF(n) : formatCHFCompact(n);
}

/** Texte d'objectif : « Il manque CHF 3'169 pour l'objectif (CHF 10'000) ». */
export function moneyTargetText(amount: number | null | undefined, target: number | null | undefined): string | null {
  if (target == null || !Number.isFinite(target) || target <= 0) return null;
  const n = amount != null && Number.isFinite(amount) ? amount : 0;
  if (n >= target) return `Objectif atteint (${formatCHFCompact(target)})`;
  return `Il manque ${formatCHFCompact(target - n)} pour l'objectif (${formatCHFCompact(target)})`;
}

export function MoneyStat({ amount, perMonth, cents, target, sub, ...tile }: MoneyStatProps) {
  const subText = sub ?? moneyTargetText(amount, target) ?? undefined;
  return (
    <StatTile
      {...tile}
      value={
        <span>
          {formatMoneyAmount(amount, cents)}
          {perMonth && (
            <span className="ml-1 text-[0.45em] font-bold text-muted-foreground">/ mois</span>
          )}
        </span>
      }
      sub={subText}
    />
  );
}
