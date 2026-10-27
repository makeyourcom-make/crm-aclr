/**
 * « Ton entonnoir » : une tuile par étape (Nouveau → Signé) avec le nombre de
 * fiches, le taux de passage depuis l'étape précédente et une barre ; clic =
 * filtre de la liste sur ce statut (re-clic = retire le filtre). Sorties
 * (Perdu, Numéro invalide, Ne pas rappeler) en pastilles. Server-safe.
 */
import type { ProspectStatut } from "@prisma/client";
import { Filter } from "lucide-react";
import Link from "next/link";

import { SectionCard, formatInt } from "@/components/arena";
import { cn } from "@/lib/utils";

import { prospectsHref, type RawSearchParams } from "./list-href";
import { FUNNEL_EXITS, FUNNEL_STEPS, STATUT_META } from "./statut-meta";

const PIPELINE: ProspectStatut[] = [
  "CONTACTE",
  "QUALIFIE",
  "RDV_PRIS",
  "PROPOSITION_ENVOYEE",
  "SIGNE",
];

export function LeadsFunnel({
  byStatut,
  activeStatut,
  raw,
  nbSignes,
  nbActifs,
}: {
  byStatut: Partial<Record<ProspectStatut, number>>;
  /** Statut filtré (si un seul statut est sélectionné). */
  activeStatut: ProspectStatut | null;
  raw: RawSearchParams;
  nbSignes: number;
  nbActifs: number;
}) {
  const n = (s: ProspectStatut) => byStatut[s] ?? 0;
  const reach = (s: ProspectStatut) =>
    PIPELINE.slice(PIPELINE.indexOf(s)).reduce((sum, x) => sum + n(x), 0);
  const allLeads = n("NOUVEAU") + n("VIERGE") + reach("CONTACTE");
  const max = Math.max(1, ...FUNNEL_STEPS.map(n));

  const rateLabel = (s: ProspectStatut): { text: string; title: string } => {
    if (s === "NOUVEAU") return { text: "à ouvrir", title: "Fiches jamais ouvertes" };
    if (s === "VIERGE") return { text: "à attaquer", title: "Fiches ouvertes, pas encore contactées" };
    const i = PIPELINE.indexOf(s);
    const prev = i === 0 ? allLeads : reach(PIPELINE[i - 1]);
    const pct = prev > 0 ? Math.round((reach(s) / prev) * 100) : 0;
    return {
      text: `→ ${pct} %`,
      title: "Taux de passage depuis l'étape précédente (fiches arrivées à cette étape ou plus loin)",
    };
  };

  const toggle = (s: ProspectStatut) =>
    prospectsHref(raw, (sp) => {
      sp.delete("vue");
      if (activeStatut === s) sp.delete("statut");
      else sp.set("statut", s);
    });

  return (
    <SectionCard
      title="Ton entonnoir"
      icon={Filter}
      tone="violet"
      className="mb-6 gap-3.5"
      description={`Clique une étape pour filtrer la liste · ${formatInt(nbSignes)} client${nbSignes > 1 ? "s" : ""} signé${nbSignes > 1 ? "s" : ""}, ${formatInt(nbActifs)} en prospection`}
    >
      <div className="mb-3.5 flex flex-wrap items-center gap-1.5 text-xs font-bold">
        <span className="text-muted-foreground">Sorties :</span>
        {FUNNEL_EXITS.map((s) => {
          const active = activeStatut === s;
          return (
            <Link
              key={s}
              href={toggle(s)}
              prefetch={false}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-2.5 transition-opacity hover:opacity-85",
                STATUT_META[s].pill,
                active && "border-navy-700 ring-1 ring-navy-700",
              )}
            >
              {STATUT_META[s].label} {formatInt(n(s))}
            </Link>
          );
        })}
      </div>
      <ol className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 xl:grid xl:grid-cols-7 xl:overflow-visible">
        {FUNNEL_STEPS.map((s) => {
          const meta = STATUT_META[s];
          const active = activeStatut === s;
          const rate = rateLabel(s);
          const pct = Math.max(4, Math.round((n(s) / max) * 100));
          return (
            <li key={s} className="min-w-[140px] snap-start xl:min-w-0">
              <Link
                href={toggle(s)}
                prefetch={false}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex min-h-[104px] flex-col gap-1.5 rounded-[14px] border p-3 text-foreground transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-arena",
                  active ? cn("border-2 border-navy-700", meta.pill.split(" ")[0]) : "border-border bg-card",
                )}
              >
                <span className="flex w-full items-center justify-between gap-1.5">
                  <span className={cn("truncate text-xs font-bold", meta.text)}>{meta.short}</span>
                  <span className="shrink-0 text-[11px] font-bold text-muted-foreground" title={rate.title}>
                    {rate.text}
                  </span>
                </span>
                <span className="score-number text-[28px]">{formatInt(n(s))}</span>
                <span aria-hidden="true" className="mt-auto block h-1.5 w-full overflow-hidden rounded-full bg-navy-50">
                  <span className={cn("block h-full rounded-full", meta.solid)} style={{ width: `${pct}%` }} />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}
