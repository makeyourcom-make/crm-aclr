/**
 * Pastilles des vues rapides de la liste Entreprises (avec compteurs réels).
 * Liens d'URL (`?vue=`) : fonctionnent sans JavaScript, se partagent, et se
 * combinent avec les autres filtres. Server-safe.
 */
import Link from "next/link";

import { formatInt } from "@/components/arena";
import { cn } from "@/lib/utils";

import { PROSPECT_VUES, VUE_META, type ProspectVue } from "./lead-views";
import { prospectsHref, type RawSearchParams } from "./list-href";

export function LeadsViews({
  active,
  counts,
  raw,
}: {
  active: ProspectVue;
  counts: Record<ProspectVue, number>;
  raw: RawSearchParams;
}) {
  return (
    <nav
      aria-label="Vues rapides"
      className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
    >
      <span className="mr-1 shrink-0 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        Vues
      </span>
      {PROSPECT_VUES.map((v) => {
        const on = v === active;
        const href = prospectsHref(raw, (sp) => {
          if (v === "toutes") sp.delete("vue");
          else sp.set("vue", v);
        });
        return (
          <Link
            key={v}
            href={href}
            prefetch={false}
            aria-current={on ? "page" : undefined}
            title={VUE_META[v].hint}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-bold whitespace-nowrap transition-colors",
              on
                ? "border-navy-700 bg-navy-700 text-white"
                : "border-border-strong bg-card text-foreground hover:bg-navy-50",
            )}
          >
            {VUE_META[v].label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums",
                on ? "bg-coral-400 text-navy-700" : "bg-navy-50 text-navy-500",
              )}
            >
              {formatInt(counts[v])}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
