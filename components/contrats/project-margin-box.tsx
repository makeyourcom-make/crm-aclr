/**
 * Encart de rentabilité d'un contrat, affiché sur /contrats/[id] côté admin.
 *
 * Reprend le calcul de getProjectMarginForContract et l'affiche en cascade :
 *   Revenu - Coûts directs - Commission - Frais alloués - Impôts = Marge nette
 *
 * Code couleur sur le badge final + bordure droite.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCHF, formatPercent } from "@/lib/format";

import type { ProjectMargin } from "@/lib/queries/project-profitability";

interface ProjectMarginBoxProps {
  margin: ProjectMargin;
  tauxImpots: number;
}

export function ProjectMarginBox({
  margin,
  tauxImpots,
}: ProjectMarginBoxProps) {
  const m = margin;
  const tone =
    m.rentabilite >= 0.35
      ? "emerald"
      : m.rentabilite >= 0.15
        ? "primary"
        : m.rentabilite >= 0
          ? "amber"
          : "red";

  const borderColor = {
    emerald: "border-l-emerald-500",
    primary: "border-l-primary",
    amber: "border-l-amber-500",
    red: "border-l-red-500",
  }[tone];

  const textColor = {
    emerald: "text-emerald-700",
    primary: "text-primary",
    amber: "text-amber-700",
    red: "text-red-700",
  }[tone];

  const badgeBg = {
    emerald: "bg-emerald-100 text-emerald-800",
    primary: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
  }[tone];

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>Rentabilité du projet</span>
          <span
            className={`inline-flex h-7 items-center rounded-full px-3 text-sm font-bold tabular-nums ${badgeBg}`}
          >
            {formatPercent(m.rentabilite)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Cascade visuelle */}
        <div className="space-y-1.5 text-sm">
          <Row label="Revenu 12 mois" value={formatCHF(m.revenu12mois)} bold />
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
          <div className="border-t border-border pt-1.5">
            <Row
              label="Marge brute"
              value={formatCHF(m.margeBrute)}
              bold
              danger={m.margeBrute < 0}
            />
          </div>
          {m.provisionImpots > 0 && (
            <Row
              label={`Provision impôts (${formatPercent(tauxImpots)})`}
              value={`- ${formatCHF(m.provisionImpots)}`}
              danger
            />
          )}
          <div className="border-t-2 border-foreground pt-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold uppercase tracking-wider">
                Marge nette
              </span>
              <span
                className={`text-2xl font-bold tabular-nums ${textColor}`}
              >
                {formatCHF(m.margeNette)}
              </span>
            </div>
          </div>
        </div>

        {/* Verdict */}
        <div
          className={`rounded-md p-2.5 text-xs ${
            tone === "emerald"
              ? "bg-emerald-50 text-emerald-800"
              : tone === "primary"
                ? "bg-blue-50 text-blue-700"
                : tone === "amber"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-red-50 text-red-700"
          }`}
        >
          {tone === "emerald" &&
            "🏆 Projet très rentable. Identifie ce qui marche pour le reproduire."}
          {tone === "primary" &&
            "✅ Projet sain. Rentabilité dans la fourchette normale."}
          {tone === "amber" &&
            "⚠️ Rentabilité faible. Voir si tu peux renégocier le prix au renouvellement ou réduire les coûts directs."}
          {tone === "red" &&
            "🔴 Projet déficitaire. Il faut soit augmenter le prix, soit réduire les coûts, soit accepter que ce client soit une perte d'image."}
        </div>
      </CardContent>
    </Card>
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
      <span
        className={`text-sm ${bold ? "font-semibold" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${bold ? "font-semibold" : ""} ${
          danger ? "text-red-700" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
