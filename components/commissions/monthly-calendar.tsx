"use client";

/**
 * Frise des commissions : historique des derniers mois + calendrier des
 * versements à venir (12 mois), une barre par mois (part « à la signature »
 * en navy, part récurrente étalements + renouvellements en vert ; mois futurs
 * en pointillés = déjà planifié). Clic sur un mois = détail (total, acquis,
 * à venir, contrats signés, évolution vs le mois d'avant).
 *
 * Remplace l'ancien calendrier 13 mois : mêmes informations (acquis / à venir
 * par mois, mois courant en évidence) + l'historique.
 */
import { History } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SectionCard } from "@/components/arena/section-card";
import { formatCHF, formatNumber } from "@/lib/format";
import type { TimelineMonth } from "@/lib/queries/commissions";
import { cn } from "@/lib/utils";

const BAR_MAX = 150;

export interface MonthlyCalendarProps {
  months: TimelineMonth[];
  /** « me » : tutoiement (commerciale) · « admin » : vue équipe. */
  audience: "me" | "admin";
  className?: string;
}

function totalOf(m: TimelineMonth) {
  return m.signature + m.recurrent;
}

function shortAmount(n: number): string {
  if (n >= 10_000) return `${formatNumber(Math.round(n / 100) / 10)}k`;
  return formatNumber(Math.round(n));
}

export function MonthlyCalendar({ months, audience, className }: MonthlyCalendarProps) {
  const currentKey = months.find((m) => m.isCurrent)?.key ?? months[0]?.key;
  const [selectedKey, setSelectedKey] = useState(currentKey);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  // Centre le mois en cours dans la frise (défilement horizontal uniquement).
  useEffect(() => {
    const box = scrollRef.current;
    const btn = currentRef.current;
    if (!box || !btn) return;
    box.scrollLeft = Math.max(0, btn.offsetLeft - box.clientWidth / 2 + btn.clientWidth / 2);
  }, []);

  if (months.length === 0) return null;
  const maxTotal = Math.max(1, ...months.map(totalOf));
  const pastTotals = months.filter((m) => !m.isFuture).map(totalOf);
  const bestPast = Math.max(0, ...pastTotals);
  // Mois choisi absent de la frise (ex. changement de filtre admin) : retour
  // au mois en cours plutôt qu'au plus ancien.
  const selIdx = months.findIndex((m) => m.key === selectedKey);
  const idx =
    selIdx >= 0 ? selIdx : Math.max(0, months.findIndex((m) => m.isCurrent));
  const sel = months[idx];
  const prev = idx > 0 ? months[idx - 1] : null;
  const selTotal = totalOf(sel);
  const prevTotal = prev ? totalOf(prev) : 0;

  let delta: { text: string; tone: string } = { text: "Premier mois", tone: "text-foreground" };
  if (sel.isFuture) delta = { text: "Déjà planifié", tone: "text-win-700" };
  else if (prev && prevTotal > 0) {
    const d = Math.round((selTotal / prevTotal - 1) * 100);
    delta = { text: `${d >= 0 ? "+" : ""}${d} %`, tone: d >= 0 ? "text-win-700" : "text-alert-700" };
  } else if (prev) delta = { text: selTotal > 0 ? "En hausse" : "=", tone: "text-foreground" };

  const isRecord = !sel.isFuture && selTotal > 0 && selTotal >= bestPast;
  const pill = sel.isFuture
    ? { text: "Prévision", cls: "bg-win-50 text-win-700" }
    : sel.isCurrent
      ? { text: isRecord ? "En cours · record" : "En cours", cls: "bg-gold-50 text-gold-700" }
      : { text: isRecord ? "Clôturé · record" : "Clôturé", cls: "bg-navy-50 text-navy-500" };

  const me = audience === "me";
  const msg = sel.isFuture
    ? selTotal > 0
      ? me
        ? `${formatCHF(selTotal)} déjà planifiés avant même de décrocher. Chaque signature d'ici là vient s'empiler dessus.`
        : `${formatCHF(selTotal)} déjà planifiés pour ce mois.`
      : me
        ? "Rien de planifié pour l'instant : chaque signature remplit ce mois-là."
        : "Aucun versement planifié pour ce mois."
    : sel.isCurrent
      ? me
        ? isRecord
          ? "Déjà ton meilleur mois. Il reste quelques jours pour creuser l'écart."
          : `${formatCHF(sel.acquis)} déjà acquis, ${formatCHF(sel.aVenir)} encore à venir d'ici la fin du mois.`
        : `${formatCHF(sel.acquis)} acquis, ${formatCHF(sel.aVenir)} à venir d'ici la fin du mois.`
      : isRecord
        ? me
          ? "Ton record de gains à ce jour."
          : "Meilleur mois sur la période."
        : `${formatCHF(sel.acquis)} acquis sur ce mois.`;

  return (
    <SectionCard
      title={me ? "Historique et calendrier de tes commissions" : "Historique et calendrier des commissions"}
      icon={History}
      tone="navy"
      description={
        me
          ? "Ta boule de neige : la part récurrente grossit chaque mois. Choisis un mois."
          : "Mois passés, mois en cours et versements planifiés sur 12 mois. Choisis un mois."
      }
      className={className}
      contentClassName="flex flex-col gap-4"
    >
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-navy-600" />À la signature
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-win-500" />Récurrent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[3px] border border-dashed border-win-500 bg-win-50" />Planifié
        </span>
      </div>
      <div ref={scrollRef} className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max items-end gap-2">
          {months.map((m) => {
            const t = totalOf(m);
            const isSel = m.key === sel.key;
            const hSig = Math.round((m.signature / maxTotal) * BAR_MAX);
            const hRec = Math.round((m.recurrent / maxTotal) * BAR_MAX);
            const planned = m.isFuture;
            return (
              <button
                key={m.key}
                ref={m.isCurrent ? currentRef : undefined}
                type="button"
                aria-pressed={isSel}
                aria-label={`${m.full} : ${formatCHF(t)}${planned ? " planifiés" : ""}`}
                onClick={() => setSelectedKey(m.key)}
                className={cn(
                  "flex h-[230px] w-[58px] shrink-0 flex-col items-center justify-end gap-1.5 rounded-[14px] border-2 px-1.5 py-2 transition-colors",
                  isSel ? "border-navy-700 bg-navy-50" : "border-transparent hover:bg-ground",
                )}
              >
                <span className="text-xs font-extrabold text-foreground tabular-nums">
                  {shortAmount(t)}
                </span>
                <span aria-hidden="true" className="flex w-full max-w-[40px] flex-col gap-0.5">
                  {hSig > 0 && (
                    <span
                      className={cn(
                        "block rounded-t-[8px] rounded-b-[2px]",
                        planned ? "border border-dashed border-navy-500 bg-navy-100" : "bg-navy-600",
                      )}
                      style={{ height: Math.max(3, hSig) }}
                    />
                  )}
                  {hRec > 0 && (
                    <span
                      className={cn(
                        "block rounded-t-[2px] rounded-b-[8px]",
                        hSig === 0 && "rounded-t-[8px]",
                        planned ? "border-2 border-dashed border-win-500 bg-win-50" : "bg-win-500",
                      )}
                      style={{ height: Math.max(3, hRec) }}
                    />
                  )}
                  {t === 0 && <span className="block h-[3px] rounded-full bg-border" />}
                </span>
                <span
                  className={cn(
                    "text-xs leading-none",
                    isSel || m.isCurrent ? "font-extrabold text-foreground" : "font-semibold text-muted-foreground",
                  )}
                >
                  {m.label}
                </span>
                <span className="text-[11px] leading-none font-semibold text-muted-foreground">{m.year2}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div aria-live="polite" className="flex flex-col gap-3 rounded-[14px] bg-ground p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="font-display text-lg font-extrabold text-foreground">{sel.full}</h3>
          <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold", pill.cls)}>
            {pill.text}
          </span>
        </div>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
          <Cell label="Total" value={formatCHF(selTotal)} big />
          <Cell label="À la signature" value={formatCHF(sel.signature)} />
          <Cell label="Récurrent" value={formatCHF(sel.recurrent)} tone="text-win-700" />
          <Cell label="Acquis" value={formatCHF(sel.acquis)} tone="text-win-700" />
          <Cell label="À venir" value={formatCHF(sel.aVenir)} />
          {sel.contrats !== null && !sel.isFuture && (
            <Cell label="Contrats signés" value={formatNumber(sel.contrats)} />
          )}
          <Cell label="vs mois d'avant" value={delta.text} tone={delta.tone} />
        </dl>
        <p className="text-[13px] font-semibold text-foreground">{msg}</p>
      </div>
    </SectionCard>
  );
}

function Cell({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: string;
  big?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-extrabold break-words tabular-nums",
          big ? "text-xl" : "text-base",
          tone ?? "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
