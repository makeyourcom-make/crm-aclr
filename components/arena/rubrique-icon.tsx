/**
 * Tuile d'icône colorée par rubrique (charte §2) : fond clair + icône foncée,
 * 36 × 36, rayon 12 px.
 *
 * Appels / Phoning = coral · Entreprises = bleu · Pipeline = violet ·
 * Emails = teal · Agenda = or · Stats / Objectifs = vert ·
 * Contrats / Factures / Commissions = navy · Projets = violet.
 *
 * Server-safe.
 */
import {
  BarChart3,
  Building2,
  Calendar,
  FolderKanban,
  Mail,
  Phone,
  SquareKanban,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { TONE_CLASSES, type Tone } from "./tones";

export type Rubrique =
  | "appels"
  | "leads"
  | "pipeline"
  | "emails"
  | "agenda"
  | "stats"
  | "finance"
  | "projets";

export const RUBRIQUES: Record<
  Rubrique,
  { tone: Tone; icon: LucideIcon; label: string }
> = {
  appels: { tone: "coral", icon: Phone, label: "Phoning" },
  leads: { tone: "blue", icon: Building2, label: "Entreprises" },
  pipeline: { tone: "violet", icon: SquareKanban, label: "Pipeline" },
  emails: { tone: "teal", icon: Mail, label: "Emails" },
  agenda: { tone: "gold", icon: Calendar, label: "Agenda" },
  stats: { tone: "green", icon: BarChart3, label: "Statistiques" },
  finance: { tone: "navy", icon: Wallet, label: "Contrats et finance" },
  projets: { tone: "violet", icon: FolderKanban, label: "Projets" },
};

export type RubriqueIconSize = "sm" | "md" | "lg" | number;

const PX: Record<Exclude<RubriqueIconSize, number>, number> = {
  sm: 28,
  md: 36,
  lg: 44,
};

export interface RubriqueIconProps {
  rubrique: Rubrique;
  size?: RubriqueIconSize;
  /** Remplace l'icône par défaut de la rubrique (même teinte). */
  icon?: LucideIcon;
  className?: string;
}

export function RubriqueIcon({
  rubrique,
  size = "md",
  icon,
  className,
}: RubriqueIconProps) {
  const meta = RUBRIQUES[rubrique] ?? RUBRIQUES.stats;
  const Icon = icon ?? meta.icon;
  const t = TONE_CLASSES[meta.tone];
  const px = typeof size === "number" ? size : PX[size];
  const iconPx = Math.round(px * 0.5);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        t.bg,
        t.text,
        className,
      )}
      style={{ width: px, height: px, borderRadius: Math.round(px / 3) }}
    >
      <Icon style={{ width: iconPx, height: iconPx }} strokeWidth={2} />
    </span>
  );
}
