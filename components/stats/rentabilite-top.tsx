"use client";

/**
 * Top 10 des clients par rentabilité (admin) : CA facturé (envoyé, payé, en
 * retard) moins les charges directes et allouées, tri au choix. La période
 * (mois, trimestre, année, 12 mois) vit dans l'URL (?renta=), calculée côté
 * serveur : les liens arrivent tout prêts dans `periodes`.
 * Le détail complet (périodes, toutes les colonnes) est sur /rentabilite.
 */
import Link from "next/link";
import { useState } from "react";

import { formatCHFCompact, formatPercent } from "@/lib/format";
import type { RentabiliteRow } from "@/lib/queries/rentabilite";
import { cn } from "@/lib/utils";

import { MiniStat, RankBadge, SegmentGroup, cleanText, marginTone, segmentClass } from "./ui";

type Tri = "marge" | "ca" | "pct";

const TRIS: { key: Tri; label: string }[] = [
  { key: "marge", label: "Marge brute" },
  { key: "ca", label: "CA facturé" },
  { key: "pct", label: "Marge %" },
];

export interface RentabilitePeriodeLink {
  key: string;
  label: string;
  href: string;
  active: boolean;
}

export function RentabiliteTop({
  rows,
  periodes,
}: {
  rows: RentabiliteRow[];
  periodes: RentabilitePeriodeLink[];
}) {
  const [tri, setTri] = useState<Tri>("marge");
  const sorted = [...rows]
    .filter((r) => r.caFacture > 0 || r.chargesTotal > 0)
    .sort((a, b) =>
      tri === "ca"
        ? b.caFacture - a.caFacture
        : tri === "pct"
          ? (b.margePct ?? -Infinity) - (a.margePct ?? -Infinity)
          : b.margeBrute - a.margeBrute,
    )
    .slice(0, 10);

  const tCa = sorted.reduce((s, r) => s + r.caFacture, 0);
  const tCh = sorted.reduce((s, r) => s + r.chargesTotal, 0);
  const tMarge = tCa - tCh;
  const tPct = tCa > 0 ? tMarge / tCa : null;
  const aRedresser = sorted.filter((r) => r.margeBrute < 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentGroup label="Période rentabilité" visibleLabel="Période :" muted>
          {periodes.map((p) => (
            <Link
              key={p.key}
              href={p.href}
              scroll={false}
              aria-current={p.active ? "true" : undefined}
              className={segmentClass(p.active)}
            >
              {p.label}
            </Link>
          ))}
        </SegmentGroup>
        <SegmentGroup label="Trier le tableau" visibleLabel="Trier par :" muted>
          {TRIS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tri === t.key}
              onClick={() => setTri(t.key)}
              className={segmentClass(tri === t.key)}
            >
              {t.label}
            </button>
          ))}
        </SegmentGroup>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))]">
        <MiniStat label="CA facturé · top 10" value={formatCHFCompact(tCa)} />
        <MiniStat label="Charges allouées" value={formatCHFCompact(tCh)} />
        <MiniStat
          label={`Marge brute${tPct !== null ? ` · ${formatPercent(tPct, 0)}` : ""}`}
          value={formatCHFCompact(tMarge)}
          tone={tMarge >= 0 ? "green" : "red"}
        />
        <MiniStat
          label="À redresser"
          value={`${aRedresser} client${aRedresser > 1 ? "s" : ""}`}
          tone={aRedresser > 0 ? "red" : "neutral"}
        />
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-[14px] bg-ground px-4 py-6 text-center text-sm text-muted-foreground">
          Aucune facture ni charge client sur cette période pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-border">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <caption className="sr-only">Rentabilité des 10 premiers clients</caption>
            <thead>
              <tr className="bg-ground text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                <th scope="col" className="px-3.5 py-3 text-left">Client</th>
                <th scope="col" className="px-2 py-3 text-right">CA facturé</th>
                <th scope="col" className="px-2 py-3 text-right">Charges</th>
                <th scope="col" className="px-2 py-3 text-right">Marge brute</th>
                <th scope="col" className="px-3.5 py-3 text-left">Marge %</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const tone = marginTone(r.margePct);
                const w = r.margePct === null ? 0 : Math.max(3, Math.min(100, Math.round(r.margePct * 100)));
                return (
                  <tr key={r.prospectId} className="border-t border-border">
                    <th scope="row" className="px-3.5 py-3 text-left font-semibold">
                      <div className="flex items-center gap-2.5">
                        <RankBadge rank={i + 1} size={26} />
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <Link
                            href={`/prospects/${r.prospectId}`}
                            className="text-sm font-bold text-foreground hover:text-info-700 hover:underline"
                          >
                            {cleanText(r.raisonSociale)}
                          </Link>
                          {r.margeBrute < 0 && (
                            <span className="rounded-full bg-alert-50 px-2 py-0.5 text-[11px] font-bold text-alert-700">
                              À redresser
                            </span>
                          )}
                          {tri === "marge" && i < 3 && r.margeBrute > 0 && (
                            <span className="rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-bold text-gold-700">
                              Top rentable
                            </span>
                          )}
                        </span>
                      </div>
                    </th>
                    <td className="px-2 py-3 text-right tabular-nums">
                      <span className="block text-sm font-bold whitespace-nowrap">{formatCHFCompact(r.caFacture)}</span>
                      {r.caEnAttente > 0.01 && (
                        <span className="block text-[11px] font-bold whitespace-nowrap text-gold-700">
                          {formatCHFCompact(r.caEnAttente)} en attente
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right text-sm font-semibold whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatCHFCompact(r.chargesTotal)}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-3 text-right text-sm font-extrabold whitespace-nowrap tabular-nums",
                        r.margeBrute < 0 ? "text-alert-700" : "text-foreground",
                      )}
                    >
                      {formatCHFCompact(r.margeBrute)}
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 min-w-14 flex-1 overflow-hidden rounded-full bg-ground">
                          <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${w}%` }} />
                        </div>
                        <span className={cn("w-12 shrink-0 text-right text-[13px] font-extrabold tabular-nums", tone.text)}>
                          {r.margePct !== null ? formatPercent(r.margePct, 0) : "n.d."}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Charges = dépenses directes rattachées au client + ventilations multi-clients. Les frais généraux (sans
        client) restent hors tableau. Périodes et détail complet dans{" "}
        <Link href="/rentabilite" className="font-bold text-info-700 hover:underline">
          Rentabilité clients
        </Link>
        .
      </p>
    </div>
  );
}
