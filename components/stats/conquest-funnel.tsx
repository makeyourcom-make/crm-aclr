/**
 * « Entonnoir commercial » : entonnoir de la période
 * appels → conversations → RDV pris → RDV effectués → propositions → signés,
 * avec le taux de chaque transition comparé à la moyenne des 12 mois
 * précédents (données réelles, pas de cible inventée) et le « levier n°1 ».
 *
 * En dessous : les 3 taux de conversion historiques et la base prospects
 * cumulée (funnel par statut, depuis le début). Server-safe.
 */
import { ArrowDown, Crosshair } from "lucide-react";
import Link from "next/link";

import { formatInt } from "@/components/arena/format";
import { formatPercent } from "@/lib/format";
import type { PeriodCounters } from "@/lib/queries/pilotage";
import type { StatsCockpit } from "@/lib/queries/stats";
import { cn } from "@/lib/utils";

import { Eyebrow } from "./ui";

interface Step {
  label: string;
  value: number;
  color: string;
}

const TRANSITIONS: {
  nom: string;
  suivant: [string, string];
  cta: { href: string; label: string };
}[] = [
  { nom: "Appel → conversation", suivant: ["conversation", "conversations"], cta: { href: "/phoning", label: "Lancer le phoning" } },
  { nom: "Conversation → RDV pris", suivant: ["RDV pris", "RDV pris"], cta: { href: "/phoning", label: "Lancer le phoning" } },
  { nom: "RDV pris → RDV effectué", suivant: ["RDV effectué", "RDV effectués"], cta: { href: "/agenda", label: "Ouvrir l'agenda" } },
  { nom: "RDV effectué → proposition", suivant: ["proposition", "propositions"], cta: { href: "/pipeline", label: "Voir le pipeline" } },
  { nom: "Proposition → signature", suivant: ["signature", "signatures"], cta: { href: "/contrats?statut=ATTENTE_SIGNATURE_CLIENT", label: "Propositions en attente" } },
];

function stepsOf(c: {
  appels: number;
  conversations: number;
  rdvPris: number;
  rdvEffectues: number;
  propositions: number;
  signatures: number;
}): Step[] {
  return [
    { label: "Appels passés", value: c.appels, color: "#3B6FF6" },
    { label: "Conversations", value: c.conversations, color: "#0EA5A4" },
    { label: "RDV pris", value: c.rdvPris, color: "#F5A524" },
    { label: "RDV effectués", value: c.rdvEffectues, color: "#7C5CFC" },
    { label: "Propositions", value: c.propositions, color: "#2F4470" },
    { label: "Signés", value: c.signatures, color: "#12A150" },
  ];
}

export function ConquestFunnel({
  stats,
  baseline,
}: {
  stats: StatsCockpit;
  /** Compteurs des 12 mois précédant la période (référence), null si indisponible. */
  baseline: PeriodCounters | null;
}) {
  const steps = stepsOf({
    appels: stats.nbAppels,
    conversations: stats.nbConversations,
    rdvPris: stats.nbRdvPris,
    rdvEffectues: stats.nbRdvHonores,
    propositions: stats.nbPropositions,
    signatures: stats.nbSignatures,
  });
  const base = baseline ? stepsOf(baseline) : null;

  const rates = TRANSITIONS.map((_, i) => (steps[i].value > 0 ? steps[i + 1].value / steps[i].value : null));
  // Référence : taux des 12 mois précédents, seulement si l'échantillon est
  // parlant ET si l'étape suivante est bien un sous-ensemble (taux ≤ 100 %).
  // Les RDV effectués / propositions d'une période ne découlent pas tous des
  // RDV pris de la même période (décalage, RDV saisis sans résultat « RDV
  // pris ») : un taux > 100 % n'est pas une moyenne comparable.
  const refRates = TRANSITIONS.map((_, i) => {
    if (!base || base[i].value < 10) return null;
    const ref = base[i + 1].value / base[i].value;
    return ref <= 1 ? ref : null;
  });

  // Levier n°1 = la transition la plus en retard sur sa référence.
  let levier: number | null = null;
  let worst = Infinity;
  for (let i = 0; i < TRANSITIONS.length; i++) {
    const r = rates[i];
    const ref = refRates[i];
    if (r === null || ref === null || ref <= 0 || r > 1 || steps[i].value < 5) continue;
    const ratio = r / ref;
    if (ratio < worst) {
      worst = ratio;
      levier = i;
    }
  }
  const sousRef = levier !== null && worst < 1;

  const first = Math.max(1, steps[0].value);

  return (
    <div className="flex flex-col gap-5">
      {levier !== null ? (
        <LevierBox
          index={levier}
          rate={rates[levier] ?? 0}
          ref12={refRates[levier] ?? 0}
          gain={Math.max(1, Math.round(steps[levier].value * ((refRates[levier] ?? 0) - (rates[levier] ?? 0))))}
          sousRef={sousRef}
        />
      ) : (
        <div className="flex items-center gap-3 rounded-[16px] border border-coral-100 bg-coral-50 px-4 py-3.5 text-sm text-muted-foreground">
          <Crosshair aria-hidden="true" className="size-5 shrink-0 text-coral-600" />
          Pas encore assez d&apos;historique pour comparer chaque étape à ta moyenne sur 12 mois : continue
          d&apos;enregistrer tes appels et RDV, le levier n°1 s&apos;affichera ici.
        </div>
      )}

      <ol className="flex flex-col gap-1.5" aria-label="Entonnoir de la période">
        {steps.map((st, i) => {
          const w = Math.max(4, Math.round(Math.sqrt(st.value / first) * 1000) / 10);
          const hasRate = i < TRANSITIONS.length;
          const r = hasRate ? rates[i] : null;
          const ref = hasRate ? refRates[i] : null;
          const isLevier = levier === i && sousRef;
          const ok = r !== null && ref !== null && r >= ref;
          return (
            <li key={st.label} className="flex flex-col gap-1.5">
              {/* 390 px : 96 + 72 + 56 + 48 + gouttières ≈ 296 px, tient dans la carte (318 px). */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3">
                <span className="w-[96px] shrink-0 text-[13px] leading-tight font-bold sm:w-[120px]">{st.label}</span>
                <div className="h-[30px] min-w-[72px] flex-1 overflow-hidden rounded-[10px] bg-ground sm:min-w-[120px]">
                  <div
                    className="h-full rounded-[10px] transition-[width] duration-700 ease-out"
                    style={{ width: `${w}%`, backgroundColor: st.color }}
                  />
                </div>
                <span className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
                  <span className="score-number w-[56px] text-right text-lg sm:w-[72px] sm:text-[22px]">
                    {formatInt(st.value)}
                  </span>
                  <span className="w-[48px] text-right text-xs font-semibold text-muted-foreground sm:w-[56px]">
                    {i === 0 ? "base" : formatPercent(st.value / first, 1)}
                  </span>
                </span>
              </div>
              {hasRate && r !== null && (
                <div className="flex flex-wrap items-center gap-2 pb-1 sm:pl-[132px]">
                  <ArrowDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold",
                      // coral-600 sur coral-100 = 4.3:1 (insuffisant) : fond coral-50 + liseré.
                      isLevier
                        ? "bg-coral-50 text-coral-600 ring-1 ring-coral-400 ring-inset"
                        : ref === null
                          ? "bg-navy-50 text-navy-700"
                          : ok
                            ? "bg-win-50 text-win-700"
                            : "bg-gold-50 text-gold-700",
                    )}
                  >
                    {formatPercent(r, 1)}
                    {ref !== null &&
                      (isLevier ? " · Levier n°1" : ok ? " · Au-dessus de ta moyenne" : " · Sous ta moyenne")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {TRANSITIONS[i].nom}
                    {ref !== null && ` · moyenne 12 mois ${formatPercent(ref, 1)}`}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))]">
        <ConvTile
          label="Appel → RDV pris"
          value={formatPercent(stats.tauxAppelRdv)}
          sub={`${formatInt(stats.nbRdvPris)} RDV pris pour ${formatInt(stats.nbAppels)} appels`}
        />
        <ConvTile
          label="RDV → signature"
          value={formatPercent(stats.tauxRdvSignature, 0)}
          sub={`${formatInt(stats.nbSignatures)} sign. pour ${formatInt(stats.nbRdvHonores)} RDV effectués`}
        />
        <ConvTile
          label="Proposition → signature"
          value={formatPercent(stats.tauxPropositionSignature, 0)}
          sub={`${formatInt(stats.nbSignatures)} / ${formatInt(stats.nbPropositions)} propositions`}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-[16px] border border-dashed border-border-strong p-4">
        <Eyebrow>Base prospects · cumul depuis le début</Eyebrow>
        <div className="flex flex-col gap-2">
          {[
            { label: "Prospects (total)", value: stats.funnel.prospects, color: "#8A93A6" },
            { label: "Contactés", value: stats.funnel.contactes, color: "#3B6FF6" },
            { label: "RDV pris", value: stats.funnel.rdvPris, color: "#F5A524" },
            { label: "Proposition envoyée", value: stats.funnel.propositions, color: "#E95256" },
            { label: "Signés", value: stats.funnel.signes, color: "#12A150" },
          ].map((f) => {
            const pct = stats.funnel.prospects > 0 ? (f.value / stats.funnel.prospects) * 100 : 0;
            return (
              <div key={f.label}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-semibold">{f.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    <strong className="text-foreground">{formatInt(f.value)}</strong> ({pct.toFixed(1)} %)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ground">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: f.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Répartition des fiches entreprises par statut, tous temps confondus.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Basé sur l&apos;activité réelle de la période (appels, résultats « RDV pris », RDV clients au statut
        Fait, contrats créés et signés). Barres en échelle racine : les petites étapes restent lisibles.
      </p>
    </div>
  );
}

function LevierBox({
  index,
  rate,
  ref12,
  gain,
  sousRef,
}: {
  index: number;
  rate: number;
  ref12: number;
  gain: number;
  sousRef: boolean;
}) {
  const t = TRANSITIONS[index];
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[16px] border border-coral-100 bg-coral-50 px-4 py-4">
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-coral text-white"
      >
        <Crosshair className="size-[22px]" />
      </span>
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
        <span className="text-[11px] font-bold tracking-[0.08em] text-coral-600 uppercase">
          {sousRef ? "Ton levier n°1" : "Toutes les étapes au niveau"}
        </span>
        <span className="text-lg font-extrabold">
          {t.nom} : {formatPercent(rate, 1)}{" "}
          <span className="text-sm font-semibold text-muted-foreground">
            vs {formatPercent(ref12, 1)} sur 12 mois
          </span>
        </span>
        <span className="text-[13px] text-muted-foreground">
          {sousRef ? (
            <>
              À ta moyenne, c&apos;est{" "}
              <strong className="text-foreground">
                +{gain} {gain > 1 ? t.suivant[1] : t.suivant[0]}
              </strong>{" "}
              sur la période. C&apos;est là que tout se joue.
            </>
          ) : (
            "Chaque étape est au-dessus de ta moyenne des 12 derniers mois."
          )}
        </span>
      </div>
      <Link
        href={t.cta.href}
        className="inline-flex h-11 shrink-0 items-center rounded-[12px] bg-navy-700 px-4 text-sm font-bold text-white transition-colors hover:bg-navy-600"
      >
        {t.cta.label}
      </Link>
    </div>
  );
}

function ConvTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[14px] bg-ground p-3.5">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <span className="score-number text-2xl">{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}
