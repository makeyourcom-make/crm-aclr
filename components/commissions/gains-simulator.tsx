"use client";

/**
 * Simulateur de gains de la commerciale, basé sur SES taux réels
 * (User.tauxCommissionSignature / tauxCommissionRenouvellement) et sur la
 * règle de calcul du CRM (lib/commissions.ts) :
 *  - commission = taux signature × base, base = one-shot + mensuel × min(durée, 12)
 *    (offre ADS : one-shot + mensuel × durée, sans plafond) ;
 *  - versée 50 % à la signature + 50 % étalés sur 11 mois ;
 *  - puis renouvellement dès l'an 2 : taux renouvellement × mensuel, chaque mois.
 *
 * Tout est exprimé en CHF : aucun point, aucun niveau.
 */
import { Calculator, Minus, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";

import { formatInt } from "@/components/arena/format";
import { Button } from "@/components/ui/button";
import { formatCHF, formatNumber } from "@/lib/format";
import type { SimPreset } from "@/lib/queries/commissions-gains";
import { formatPercentRate } from "@/lib/queries/objectifs-pace";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Données de base (serveur → client)
// ---------------------------------------------------------------------------

export interface SimBase {
  rates: { signature: number; renouvellement: number };
  /** « octobre » */
  monthName: string;
  /** « 30.10 » */
  lastDayLabel: string;
  monthTotal: number;
  ca: number;
  caTarget: number | null;
  signatures: number;
  sigTarget: number | null;
  presets: SimPreset[];
  defaultN: number;
  closing: { signatures: number; rdv: number; commissionSigned: number } | null;
}

interface SimState {
  n: number;
  presetId: string;
  oneShot: number;
  mensuel: number;
  duree: number;
  ads: boolean;
}

const N_MIN = 1;
const N_MAX = 10;
const DUREES = [3, 6, 12, 24];

function initialState(base: SimBase): SimState {
  const p = base.presets[0];
  return {
    n: Math.min(N_MAX, Math.max(N_MIN, base.defaultN)),
    presetId: p?.id ?? "perso",
    oneShot: p?.oneShot ?? 250,
    mensuel: p?.mensuel ?? 150,
    duree: p?.duree ?? 12,
    ads: p?.ads ?? false,
  };
}

function compute(base: SimBase, s: SimState) {
  const months = s.ads ? s.duree : Math.min(s.duree, 12);
  const assiette = s.oneShot + s.mensuel * months;
  const commission = Math.round(assiette * base.rates.signature * 100) / 100;
  const partSig = Math.floor((commission * 100) / 2) / 100;
  const etalMois = (commission - partSig) / 11;
  const gainNow = s.n * partSig;
  const gainEtalMois = s.n * etalMois;
  const gain12 = s.n * commission;
  const renouvMois = s.n * s.mensuel * base.rates.renouvellement;
  const moisNew = base.monthTotal + gainNow;
  const valeurTotale = s.oneShot + s.mensuel * s.duree;
  const caNew = base.ca + s.n * valeurTotale;
  const sigNew = base.signatures + s.n;
  return {
    months,
    assiette,
    commission,
    gainNow,
    gainEtalMois,
    gain12,
    renouvMois,
    moisNew,
    caNew,
    sigNew,
  };
}

/** « 1'025.50 » (montant suisse sans le préfixe CHF). */
function amount(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? formatNumber(r) : formatCHF(r).replace(/^CHF\s*/, "");
}

// ---------------------------------------------------------------------------
// Carte simulateur
// ---------------------------------------------------------------------------

export function GainsSimulator({ base, className }: { base: SimBase; className?: string }) {
  const [s, setState] = useState<SimState>(() => initialState(base));
  const r = compute(base, s);
  const reset = () => setState(initialState(base));

  const maxMensuel = Math.max(1000, ...base.presets.map((p) => Math.ceil(p.mensuel / 100) * 100));
  const maxOneShot = Math.max(5000, ...base.presets.map((p) => Math.ceil(p.oneShot / 500) * 500));
  const durees = [...new Set([...DUREES, ...base.presets.map((p) => p.duree), s.duree])].sort(
    (a, b) => a - b,
  );
  const contratsMot = s.n >= 2 ? "contrats" : "contrat";

  // Progression vers l'objectif (CA en priorité, sinon contrats).
  const goal = base.caTarget
    ? { now: base.ca, sim: r.caNew, target: base.caTarget, chf: true }
    : base.sigTarget
      ? { now: base.signatures, sim: r.sigNew, target: base.sigTarget, chf: false }
      : null;
  const goalOk = goal ? goal.sim >= goal.target : false;
  const nowPct = goal ? Math.min(100, Math.round((goal.now / goal.target) * 100)) : 0;
  const simPct = goal ? Math.min(100, Math.round((goal.sim / goal.target) * 100)) : 0;
  const fmtGoal = (v: number) => (goal?.chf ? `${amount(v)} CHF` : formatInt(v));

  const set = (patch: Partial<SimState>) => setState({ ...s, ...patch });

  return (
    <section
      aria-labelledby="sim-titre"
      className={cn(
        "flex min-w-0 flex-col gap-[18px] rounded-[20px] border border-border bg-card p-5 shadow-arena sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-[12px] bg-win-50 text-win-700">
          <Calculator className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-[1_1_220px]">
          <h2 id="sim-titre" className="font-display text-lg leading-tight font-extrabold tracking-[-0.02em] sm:text-xl">
            Simulateur de gains
          </h2>
          <p className="mt-0.5 text-[13px] font-medium text-muted-foreground">
            Fais le calcul avec tes taux réels : combien te rapporte ta prochaine signature ?
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          <RotateCcw aria-hidden="true" />
          Réinitialiser
        </Button>
      </div>

      {base.presets.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
            Offre type (catalogue)
          </div>
          <div className="flex flex-wrap gap-2">
            {base.presets.map((p) => {
              const on = s.presetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set({ presetId: p.id, oneShot: p.oneShot, mensuel: p.mensuel, duree: p.duree, ads: p.ads })
                  }
                  className={cn(
                    "flex min-h-11 max-w-full flex-col items-start gap-0.5 rounded-[12px] border-2 px-3.5 py-2 text-left transition-colors",
                    on ? "border-coral-500 bg-coral-50" : "border-border bg-card hover:border-border-strong",
                  )}
                >
                  <span className="max-w-[220px] truncate text-[13px] font-extrabold text-foreground">{p.nom}</span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {p.oneShot > 0 ? `${formatNumber(p.oneShot)} · ` : ""}
                    {formatNumber(p.mensuel)} / mois · {p.duree} mois
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <div className="flex flex-col gap-2 rounded-[14px] bg-ground p-3.5">
          <div id="sim-n-label" className="text-xs font-bold text-muted-foreground">
            Contrats en plus d&apos;ici le {base.lastDayLabel}
          </div>
          <div role="group" aria-labelledby="sim-n-label" className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label="Un contrat de moins"
              disabled={s.n <= N_MIN}
              onClick={() => set({ n: Math.max(N_MIN, s.n - 1) })}
              className="flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-border-strong bg-card text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus aria-hidden="true" className="size-5" strokeWidth={3} />
            </button>
            <output aria-live="polite" className="score-number flex-1 text-center text-4xl">
              {s.n}
            </output>
            <button
              type="button"
              aria-label="Un contrat de plus"
              disabled={s.n >= N_MAX}
              onClick={() => set({ n: Math.min(N_MAX, s.n + 1) })}
              className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-navy-700 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus aria-hidden="true" className="size-5" strokeWidth={3} />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-[14px] bg-ground p-3.5">
          <label htmlFor="sim-mensuel" className="text-xs font-bold text-muted-foreground">
            Mensuel par contrat
          </label>
          <div className="score-number text-2xl">
            {formatNumber(s.mensuel)} <span className="font-sans text-sm font-bold tracking-normal text-muted-foreground">CHF / mois</span>
          </div>
          <input
            id="sim-mensuel"
            type="range"
            min={0}
            max={maxMensuel}
            step={10}
            value={s.mensuel}
            onChange={(e) => set({ mensuel: Number(e.target.value), presetId: "perso", ads: false })}
            className="h-6 w-full accent-coral-500"
          />
        </div>
        <div className="flex flex-col gap-2 rounded-[14px] bg-ground p-3.5">
          <label htmlFor="sim-oneshot" className="text-xs font-bold text-muted-foreground">
            One-shot par contrat (setup, site...)
          </label>
          <div className="score-number text-2xl">
            {formatNumber(s.oneShot)} <span className="font-sans text-sm font-bold tracking-normal text-muted-foreground">CHF</span>
          </div>
          <input
            id="sim-oneshot"
            type="range"
            min={0}
            max={maxOneShot}
            step={50}
            value={s.oneShot}
            onChange={(e) => set({ oneShot: Number(e.target.value), presetId: "perso", ads: false })}
            className="h-6 w-full accent-coral-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div id="sim-duree-label" className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
          Durée d&apos;engagement
        </div>
        <div role="group" aria-labelledby="sim-duree-label" className="flex flex-wrap gap-1.5">
          {durees.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={s.duree === d}
              onClick={() => set({ duree: d })}
              className={cn(
                "h-9 rounded-[10px] border px-3 text-[13px] font-bold transition-colors",
                s.duree === d
                  ? "border-navy-700 bg-navy-700 text-white"
                  : "border-border-strong bg-card text-foreground hover:bg-navy-50",
              )}
            >
              {d} mois
            </button>
          ))}
        </div>
      </div>

      <div
        aria-live="polite"
        className="flex flex-wrap items-center gap-4 rounded-[16px] border border-win-500 bg-win-50 px-5 py-[18px]"
      >
        <p className="min-w-0 flex-[1_1_260px] text-base leading-normal text-foreground">
          Si tu signes encore <strong>{s.n} {contratsMot}</strong> à{" "}
          <strong>CHF {formatNumber(s.mensuel)} / mois</strong>
          {s.oneShot > 0 && (
            <>
              {" "}+ <strong>{formatNumber(s.oneShot)} CHF</strong> de one-shot
            </>
          )}{" "}
          → tu gagnes
        </p>
        <div className="min-w-0 text-right">
          <div className="score-number text-[40px] break-words text-win-700 sm:text-[48px]">
            +{amount(r.gain12)} CHF
          </div>
          <div className="mt-1 text-[13px] font-bold text-win-700">sur les 12 prochains mois</div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <SimTile label="Tout de suite · 50 %" value={`+${amount(r.gainNow)} CHF`} sub="à la signature, ce mois-ci" />
        <SimTile label="Étalé · 11 mois" value={`+${amount(r.gainEtalMois)} CHF`} sub="chaque mois, l'autre moitié" />
        <SimTile
          label={`Dès l'an 2 · ${formatPercentRate(base.rates.renouvellement)}`}
          value={`+${amount(r.renouvMois)} CHF`}
          sub="par mois à chaque renouvellement"
        />
        <SimTile
          label={`Ton ${base.monthName} passerait à`}
          value={`${amount(r.moisNew)} CHF`}
          sub={`au lieu de ${amount(base.monthTotal)} CHF`}
          tone="text-win-700"
        />
      </div>

      {goal && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] font-bold">
              {goal.chf ? `CA signé de ${base.monthName}` : `Contrats signés en ${base.monthName}`} :{" "}
              {fmtGoal(goal.now)} → <span className="tabular-nums">{fmtGoal(goal.sim)}</span> / {fmtGoal(goal.target)}
              {goal.chf && base.sigTarget ? ` · contrats ${r.sigNew} / ${base.sigTarget}` : ""}
            </div>
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold",
                goalOk ? "bg-win-50 text-win-700" : "bg-alert-50 text-alert-700",
              )}
            >
              {goalOk ? "Objectif atteint" : `Encore ${fmtGoal(goal.target - goal.sim)}`}
            </span>
          </div>
          <div
            role="img"
            aria-label={`Avec ta simulation : ${fmtGoal(goal.sim)} sur ${fmtGoal(goal.target)}`}
            className="relative h-3 overflow-hidden rounded-full bg-navy-50"
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-win-500 transition-[width] duration-500" style={{ width: `${simPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-coral" style={{ width: `${nowPct}%` }} />
          </div>
          <div className="flex flex-wrap gap-3.5 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-coral-500" />Déjà signé
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-[3px] bg-win-500" />Avec ta simulation
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 border-t border-dashed border-border-strong pt-3.5 text-[13px] text-muted-foreground">
        <p>
          Base de commission par contrat : {formatNumber(s.oneShot)} + {formatNumber(s.mensuel)} × {r.months} mois ={" "}
          <strong className="text-foreground">{amount(r.assiette)} CHF</strong> · ton taux{" "}
          {formatPercentRate(base.rates.signature)} →{" "}
          <strong className="text-foreground">{amount(r.commission)} CHF</strong> de commission.
        </p>
        {base.closing && base.closing.rdv > 0 && (
          <p>
            Ton taux de closing ce mois :{" "}
            <strong className="text-foreground">
              {Math.round((base.closing.signatures / base.closing.rdv) * 100)} %
            </strong>{" "}
            ({base.closing.signatures} {base.closing.signatures >= 2 ? "contrats" : "contrat"} sur{" "}
            {base.closing.rdv} RDV effectués).
            {base.closing.commissionSigned > 0 && (
              <>
                {" "}Chaque RDV effectué te rapporte donc{" "}
                <strong className="text-win-700">
                  ~{amount(base.closing.commissionSigned / base.closing.rdv)} CHF
                </strong>{" "}
                en moyenne.
              </>
            )}
          </p>
        )}
      </div>
    </section>
  );
}

function SimTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-[14px] border border-border px-3.5 py-3">
      <div className="text-xs font-bold text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-xl font-extrabold break-words tabular-nums", tone ?? "text-foreground")}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
