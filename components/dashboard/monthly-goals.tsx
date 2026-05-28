/**
 * Module "Objectifs du mois" sur le Dashboard.
 *
 * 5 progress bars : Appels / Contacts (mails+RS) / RDV / Signatures / CA signé.
 * Si aucune Objective MENSUEL n'est active pour le user, on affiche un CTA
 * vers /objectifs pour en créer une.
 */
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCHF, formatCHFCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { MonthlyObjectiveProgress } from "@/lib/queries/dashboard";

export function MonthlyGoals({
  progress,
  isAdmin,
}: {
  progress: MonthlyObjectiveProgress;
  isAdmin: boolean;
}) {
  if (!progress.hasObjective) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <p className="text-sm font-medium text-foreground">
            Pas d&apos;objectif mensuel fixé pour ce mois.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isAdmin
              ? "Crée-en un depuis Objectifs (templates rapides Démarrage / Croisière / Performance disponibles)."
              : "Demande à Arthur de t'en fixer un, ou crée-le toi-même depuis Objectifs."}
          </p>
          <Link
            href="/objectifs"
            className="mt-3 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Aller dans Objectifs →
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Indicateurs disponibles (on n'affiche que ceux qui ont un objectif fixé)
  const items: Array<{
    label: string;
    realise: number;
    objectif: number | null;
    formatValue: (n: number) => string;
    suffix?: string;
  }> = [
    {
      label: "Appels",
      realise: progress.nbAppelsRealise,
      objectif: progress.nbAppelsObjectif,
      formatValue: (n: number) => String(n),
    },
    {
      label: "Contacts (mails + RS)",
      realise: progress.nbContactsRealise,
      objectif: progress.nbContactsObjectif,
      formatValue: (n: number) => String(n),
    },
    {
      label: "RDV",
      realise: progress.nbRdvRealise,
      objectif: progress.nbRdvObjectif,
      formatValue: (n: number) => String(n),
    },
    {
      label: "Signatures",
      realise: progress.nbSignaturesRealise,
      objectif: progress.nbSignaturesObjectif,
      formatValue: (n: number) => String(n),
    },
    {
      label: "CA signé",
      realise: progress.caRealise,
      objectif: progress.caObjectif,
      formatValue: (n: number) => formatCHFCompact(n),
    },
  ].filter((i) => i.objectif !== null && i.objectif > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Objectifs du mois</CardTitle>
        <Link
          href="/objectifs"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Gérer →
        </Link>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune cible chiffrée dans l&apos;objectif courant.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((it) => (
              <GoalBar
                key={it.label}
                label={it.label}
                value={it.realise}
                goal={it.objectif!}
                formatValue={it.formatValue}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GoalBar({
  label,
  value,
  goal,
  formatValue,
}: {
  label: string;
  value: number;
  goal: number;
  formatValue: (n: number) => string;
}) {
  const pct = goal === 0 ? 0 : Math.min(100, Math.round((value / goal) * 100));
  const tone = pct >= 100 ? "emerald" : pct >= 80 ? "primary" : pct >= 50 ? "amber" : "red";

  const TONE_BAR: Record<string, string> = {
    emerald: "bg-emerald-500",
    primary: "bg-primary",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };
  const TONE_TEXT: Record<string, string> = {
    emerald: "text-emerald-700",
    primary: "text-primary",
    amber: "text-amber-700",
    red: "text-red-700",
  };

  // Affichage spécial pour CA (avec CHF complet sur les valeurs)
  const isMonetary = label.includes("CA");

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            TONE_TEXT[tone],
          )}
        >
          {isMonetary
            ? `${formatCHF(value)} / ${formatCHF(goal)}`
            : `${value} / ${goal}`}
          <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
            ({pct}%)
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all", TONE_BAR[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
