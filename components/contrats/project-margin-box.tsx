/**
 * Encart de rentabilité d'un contrat, affiché sur /contrats/[id] côté admin.
 *
 * Cascade :
 *   Revenu - Coûts directs - Commission - Frais alloués = Marge brute
 *
 * On s'arrête à la marge brute (pas de provision impôts).
 */
import { Gauge } from "lucide-react";

import { SectionCard } from "@/components/arena/section-card";
import type { Tone } from "@/components/arena/tones";
import { formatCHF, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ProjectMargin } from "@/lib/queries/project-profitability";

interface ProjectMarginBoxProps {
  margin: ProjectMargin;
}

const VERDICT: Record<
  "great" | "ok" | "low" | "loss",
  { tone: Tone; title: string; text: string; pill: string; box: string; value: string }
> = {
  great: {
    tone: "green",
    title: "Projet très rentable",
    text: "Identifie ce qui marche pour le reproduire.",
    pill: "bg-win-50 text-win-700",
    box: "bg-win-50 text-win-700",
    value: "text-win-700",
  },
  ok: {
    tone: "teal",
    title: "Projet sain",
    text: "Rentabilité dans la fourchette normale.",
    pill: "bg-mail-50 text-mail-700",
    box: "bg-mail-50 text-mail-700",
    value: "text-mail-700",
  },
  low: {
    tone: "gold",
    title: "Rentabilité faible",
    text: "Voir si tu peux renégocier le prix au renouvellement ou réduire les coûts directs.",
    pill: "bg-gold-50 text-gold-700",
    box: "bg-gold-50 text-gold-700",
    value: "text-gold-700",
  },
  loss: {
    tone: "red",
    title: "Projet déficitaire",
    text: "Il faut soit augmenter le prix, soit réduire les coûts, soit accepter que ce client soit une perte d'image.",
    pill: "bg-alert-50 text-alert-700",
    box: "bg-alert-50 text-alert-700",
    value: "text-alert-700",
  },
};

export function ProjectMarginBox({ margin }: ProjectMarginBoxProps) {
  const m = margin;
  const key =
    m.rentabilite >= 0.35
      ? "great"
      : m.rentabilite >= 0.15
        ? "ok"
        : m.rentabilite >= 0
          ? "low"
          : "loss";
  const v = VERDICT[key];

  return (
    <SectionCard
      title="Rentabilité du projet"
      icon={Gauge}
      tone={v.tone}
      description="Revenu moins coûts directs, commission et frais alloués"
      action={
        <span
          className={cn(
            "inline-flex h-9 items-center rounded-[12px] px-3 font-display text-xl font-extrabold tabular-nums",
            v.pill,
          )}
        >
          {formatPercent(m.rentabilite)}
        </span>
      }
    >
      <div className="flex flex-col gap-1.5 text-sm">
        <Row label={`Revenu sur ${m.dureeMois} mois`} value={formatCHF(m.revenu)} bold />
        <Row
          label="Coûts directs (produits)"
          value={`- ${formatCHF(m.coutsDirects)}`}
          danger
        />
        <Row
          label={`Commission (${m.commercialeName})`}
          value={`- ${formatCHF(m.commission)}`}
          danger
        />
        <Row
          label="Quote-part frais généraux"
          value={`- ${formatCHF(m.quotePartFrais)}`}
          danger
        />
        {m.chargesReelles > 0 && (
          <Row
            label="Charges réelles rattachées"
            value={`- ${formatCHF(m.chargesReelles)}`}
            danger
          />
        )}
        <div className="mt-1 border-t-2 border-foreground pt-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase">
              Marge brute
            </span>
            <span className={cn("score-number text-2xl", v.value)}>
              {formatCHF(m.margeBrute)}
            </span>
          </div>
        </div>
      </div>

      <div className={cn("mt-4 rounded-[14px] px-3.5 py-3 text-[13px]", v.box)}>
        <strong className="font-extrabold">{v.title}.</strong>{" "}
        <span className="text-foreground">{v.text}</span>
      </div>
    </SectionCard>
  );
}

function Row({
  label,
  value,
  bold,
  danger,
}: {
  label: string;
  value: string;
  bold?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={bold ? "font-bold" : "text-muted-foreground"}>{label}</span>
      <span
        className={cn(
          "tabular-nums whitespace-nowrap",
          bold && "font-bold",
          danger && "text-alert-700",
        )}
      >
        {value}
      </span>
    </div>
  );
}
