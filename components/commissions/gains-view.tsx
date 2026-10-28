/**
 * Vue « Objectifs & gains » de la commerciale (/commissions) : ce qu'elle a
 * gagné ce mois (CHF), simulateur « si tu signes encore N contrats » basé sur
 * ses taux réels, détail du mois, objectifs avec projection fin de mois,
 * historique des commissions, records en résultats et tous ses versements.
 * Données 100 % réelles (getGainsData + getPlayerStats), aucun point ni niveau.
 * Server component (le simulateur et la frise sont clients).
 */
import { Target, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/arena/empty-state";
import { formatDayKey, formatInt } from "@/components/arena/format";
import { SectionCard } from "@/components/arena/section-card";
import {
  MonthTimeBar,
  ObjectiveGridLegend,
  ObjectiveProgressGrid,
} from "@/components/objectifs/objective-progress-grid";
import { RecordsCard, type PersonalRecord } from "@/components/objectifs/records-card";
import { PageHeader } from "@/components/page-header";
import { formatCHF, formatCHFCompact } from "@/lib/format";
import type { PlayerStats } from "@/lib/gamification/rules";
import { formatMonthKey } from "@/lib/queries/commissions";
import type { GainsData } from "@/lib/queries/commissions-gains";
import {
  formatDateCH,
  formatDayMonthCH,
  formatPercentRate,
  formatTimeCH,
  type ObjectiveMetric,
} from "@/lib/queries/objectifs-pace";

import { CommissionsTable } from "./commissions-table";
import { GainsHero, type HeroGaugeData } from "./gains-hero";
import { GainsSimulator, type SimBase } from "./gains-simulator";
import { MonthBreakdown } from "./month-breakdown";
import { MonthlyCalendar } from "./monthly-calendar";

const CONTRAT_LABEL: Record<string, string> = {
  CDI: "CDI",
  CDD: "CDD",
  MANDAT: "Mandat",
  STAGE: "Stage",
  ESSAI: "Essai",
};

const plural = (n: number, s: string, p: string) => (Math.abs(n) >= 2 ? p : s);

function totalOf(m: { signature: number; recurrent: number } | null | undefined) {
  return m ? m.signature + m.recurrent : 0;
}

function monthWord(full: string | undefined): string {
  return full ? full.split(" ")[0].toLowerCase() : "";
}

function gaugeFrom(m: ObjectiveMetric, title: string, unitLabel?: string): HeroGaugeData {
  return {
    title,
    value: m.value,
    target: m.target,
    unit: m.unit,
    unitLabel,
    projection: m.projection,
    status: m.status,
  };
}

export function GainsView({ gains: g, stats }: { gains: GainsData; stats: PlayerStats | null }) {
  const w = g.window;
  const monthTotal = g.month.total;
  const objective = g.objective;
  const sigTarget = objective?.targets.signatures ?? null;
  const caTarget = objective?.targets.ca ?? null;
  const sigLeft = sigTarget ? Math.max(0, sigTarget - g.realised.signatures) : 0;
  const caGap = caTarget ? Math.max(0, caTarget - g.realised.ca) : 0;
  const prevTotal = totalOf(g.month.prev);
  const bestPastTotal = totalOf(g.month.bestPast);
  const nextTotal = totalOf(g.month.next);

  // ---- Titre du héros ----
  const coral = (t: string) => <span className="text-coral-400">{t}</span>;
  let headline: ReactNode;
  if (sigTarget && sigTarget > 0) {
    headline =
      sigLeft > 0 ? (
        <>· encore {coral(`${sigLeft} ${plural(sigLeft, "contrat", "contrats")}`)} pour l&apos;objectif</>
      ) : (
        <>· objectif contrats {coral("atteint")}</>
      );
  } else if (caTarget && caTarget > 0) {
    headline =
      caGap > 0 ? (
        <>· encore {coral(formatCHFCompact(caGap))} de CA pour l&apos;objectif</>
      ) : (
        <>· objectif CA {coral("atteint")}</>
      );
  } else {
    const n = g.realised.signatures;
    headline =
      n > 0 ? (
        <>· {coral(`${n} ${plural(n, "contrat signé", "contrats signés")}`)} ce mois</>
      ) : (
        <>· à toi de lancer le mois</>
      );
  }

  // ---- Phrase coach ----
  const coach: string[] = [];
  if (g.month.prev && prevTotal > 0) {
    const d = Math.round((monthTotal / prevTotal - 1) * 100);
    const prevName = monthWord(g.month.prev.full);
    if (monthTotal > 0 && monthTotal >= bestPastTotal) coach.push(`Déjà ton meilleur mois : +${d} % vs ${prevName}.`);
    else if (d >= 0) coach.push(`+${d} % vs ${prevName}.`);
    else coach.push(`${d} % vs ${prevName} : le mois n'est pas fini.`);
  }
  const days = w.daysLeftInclToday;
  if (days > 0) {
    if (caTarget && caGap > 0) {
      coach.push(
        `Il reste ${days} ${plural(days, "jour ouvré", "jours ouvrés")} pour aller chercher les ${formatCHFCompact(caGap)} de CA qui manquent.`,
      );
    } else if (sigTarget && sigLeft > 0) {
      coach.push(
        `Il reste ${days} ${plural(days, "jour ouvré", "jours ouvrés")} pour signer les ${sigLeft} ${plural(sigLeft, "contrat", "contrats")} qui manquent.`,
      );
    }
  }
  const rdvNames = [...new Set(g.upcomingRdvs.map((r) => r.client).filter((c): c is string => !!c))].slice(0, 2);
  if (rdvNames.length === 2) coach.push(`${rdvNames[0]} et ${rdvNames[1]} t'attendent cette semaine.`);
  else if (rdvNames.length === 1) coach.push(`${rdvNames[0]} t'attend cette semaine.`);
  if (coach.length === 0) coach.push("Chaque appel te rapproche de ta prochaine commission.");

  // ---- Pastilles ----
  const typeLabel = g.rates.typeContrat ? (CONTRAT_LABEL[g.rates.typeContrat] ?? g.rates.typeContrat) : null;
  const pills = [
    { text: `${w.label} · jour ${w.workingDaysElapsed} / ${w.workingDaysTotal}` },
    {
      text: w.workingDaysLeft > 0 ? `J-${w.workingDaysLeft}` : days > 0 ? "Dernier jour" : "Mois bouclé",
      accent: true,
    },
    {
      text: `${typeLabel ? `${typeLabel} · ` : ""}${formatPercentRate(g.rates.signature)} signature + ${formatPercentRate(g.rates.renouvellement)} renouvellement`,
    },
  ];

  const nextName = monthWord(g.month.next?.full);
  const tiles = [
    {
      label: `Acquis en ${w.year}`,
      value: formatCHF(g.cockpit.acquisYTD),
      sub: "déjà gagné depuis le 1er janvier",
    },
    {
      label: nextName ? `Déjà planifié en ${nextName}` : "Mois prochain",
      value: formatCHF(nextTotal),
      sub: "étalements et renouvellements déjà calés",
      positive: true,
    },
    {
      label: "À venir",
      value: formatCHF(g.cockpit.aVenirTotal),
      sub: "versements prévus, sans rien faire de plus",
    },
  ];

  // ---- Jauge ----
  const byKey = (k: ObjectiveMetric["key"]) => g.metrics.find((m) => m.key === k);
  const caM = byKey("ca");
  const sigM = byKey("signatures");
  const comM = byKey("commission");
  let gauge: HeroGaugeData | null = null;
  if (caM) gauge = gaugeFrom(caM, `CA signé de ${w.monthName}`);
  else if (sigM) gauge = gaugeFrom(sigM, `Contrats signés en ${w.monthName}`, "contrats");
  else if (comM) gauge = gaugeFrom(comM, `Commissions de ${w.monthName}`);
  else if (g.metrics[0]) gauge = gaugeFrom(g.metrics[0], g.metrics[0].label);
  else if (bestPastTotal > 0 && g.month.bestPast) {
    gauge = {
      title: "Ton record de gains à battre",
      value: monthTotal,
      target: bestPastTotal,
      unit: "chf",
      projection: null,
      status: null,
      pillText: g.month.bestPast.full,
    };
  }

  // ---- Simulateur ----
  const simBase: SimBase = {
    rates: { signature: g.rates.signature, renouvellement: g.rates.renouvellement },
    monthName: w.monthName,
    lastDayLabel: formatDayMonthCH(w.lastWorkingDay),
    monthTotal,
    ca: g.realised.ca,
    caTarget: caTarget && caTarget > 0 ? caTarget : null,
    signatures: g.realised.signatures,
    sigTarget: sigTarget && sigTarget > 0 ? sigTarget : null,
    presets: g.presets,
    defaultN: sigLeft > 0 ? sigLeft : 2,
    closing: {
      signatures: g.realised.signatures,
      rdv: g.realised.rdv,
      commissionSigned: g.realised.commissionSigned,
    },
  };

  // ---- Records (résultats réels) ----
  const records: PersonalRecord[] = [];
  if (stats && stats.records.bestMonthCaSigne > 0) {
    const best = stats.records.bestMonthCaSigne;
    const cur = stats.month.caSigne;
    const pct = Math.round((cur / best) * 100);
    records.push({
      label: "Meilleur mois en CA signé",
      value: formatCHFCompact(best),
      context: formatMonthKey(stats.records.bestMonthCaSigneKey),
      pct,
      ariaLabel: `Ce mois ${formatCHF(cur)} sur ${formatCHF(best)}`,
      challenge:
        cur >= best
          ? "Record en cours ce mois-ci : chaque signature le repousse."
          : `Ce mois ${formatCHFCompact(cur)} : il te manque ${formatCHFCompact(best - cur)} pour l'égaler`,
      highlight: pct >= 75,
    });
  }
  if (g.month.bestPast && bestPastTotal > 0) {
    const pct = Math.round((monthTotal / bestPastTotal) * 100);
    records.push({
      label: "Meilleur mois de commissions",
      value: formatCHFCompact(bestPastTotal),
      context: g.month.bestPast.full,
      pct,
      ariaLabel: `Ce mois ${formatCHF(monthTotal)} sur ${formatCHF(bestPastTotal)}`,
      challenge:
        monthTotal >= bestPastTotal
          ? "Déjà battu ce mois : nouveau record de gains en cours."
          : `Ce mois ${formatCHFCompact(monthTotal)} : encore ${formatCHFCompact(bestPastTotal - monthTotal)} pour l'égaler`,
      highlight: pct >= 75,
    });
  }
  if (stats && stats.records.biggestContractMensuel > 0) {
    const next = g.upcomingRdvs[0];
    records.push({
      label: "Plus gros revenu mensuel",
      value: `${formatCHFCompact(stats.records.biggestContractMensuel)} / mois`,
      context: "Ton plus gros contrat signé",
      challenge: next
        ? `${next.client ?? "Ton prochain RDV"} le ${formatDayMonthCH(next.date)} à ${formatTimeCH(next.date)} : de quoi le battre ?`
        : "Ton prochain RDV peut le battre.",
    });
  }
  if (stats && stats.records.bestDayRdvPris > 0) {
    const best = stats.records.bestDayRdvPris;
    const today = stats.today.rdvPris;
    const gap = best - today;
    records.push({
      label: "Meilleure journée en RDV pris",
      value: `${formatInt(best)} RDV`,
      context: stats.records.bestDayRdvPrisDate
        ? `Le ${formatDayKey(stats.records.bestDayRdvPrisDate)}`
        : undefined,
      pct: Math.round((today / best) * 100),
      ariaLabel: `Aujourd'hui ${formatInt(today)} sur ${formatInt(best)} RDV pris`,
      challenge:
        gap <= 0
          ? `Aujourd'hui ${formatInt(today)} RDV : record égalé, 1 de plus et tu le bats.`
          : gap === 1
            ? "1 RDV de plus aujourd'hui et tu égales ton record."
            : `Aujourd'hui ${formatInt(today)} RDV : encore ${formatInt(gap)} pour l'égaler`,
      highlight: gap <= 1,
    });
  }
  if (stats) {
    const longest = stats.records.longestStreak;
    records.push({
      label: "Plus longue série",
      value: `${formatInt(longest)} ${plural(longest, "jour", "jours")}`,
      context: `Jours ouvrés d'affilée à ${formatInt(stats.dailyCallTarget)} appels ou plus`,
      pct: longest > 0 ? Math.round((stats.streak / longest) * 100) : 0,
      ariaLabel: `Série actuelle ${stats.streak} sur ${longest} jours`,
      challenge:
        longest > 0 && stats.streak >= longest
          ? "Tu es sur ton record : chaque jour le repousse."
          : `Série actuelle ${formatInt(stats.streak)} ${plural(stats.streak, "jour", "jours")} : encore ${formatInt(longest - stats.streak + 1)} pour la battre`,
    });
  }

  // ---- Objectifs ----
  const okCount = g.metrics.filter((m) => m.status !== "accelerer").length;
  const accelCount = g.metrics.length - okCount;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Objectifs & gains"
        rubrique="finance"
        description={
          days > 0
            ? `${w.label} · jour ${w.workingDaysElapsed} sur ${w.workingDaysTotal} · ${days} ${plural(days, "jour", "jours")} pour tout plier`
            : `${w.label} · mois bouclé`
        }
      />

      <div className="flex flex-col gap-6">
        <GainsHero
          window={w}
          monthTotal={monthTotal}
          monthGenere={g.month.genere}
          monthAcquis={g.month.acquis}
          headline={headline}
          coach={coach.join(" ")}
          pills={pills}
          tiles={tiles}
          rdvCount={g.upcomingRdvCount}
          gauge={gauge}
        />

        <div className="flex flex-wrap items-stretch gap-6">
          <GainsSimulator base={simBase} className="flex-[1.5_1_520px]" />
          <MonthBreakdown
            className="flex-[1_1_340px]"
            monthName={w.monthName}
            lastDay={w.lastWorkingDay}
            total={monthTotal}
            acquis={g.month.acquis}
            aVenir={g.month.aVenir}
            signature={g.month.signature}
            recurrent={g.month.recurrent}
            annuleTotal={g.cockpit.annule}
            lines={g.month.lines}
            rates={g.rates}
          />
        </div>

        <SectionCard
          title={`Objectifs de ${w.monthName}`}
          icon={Target}
          tone="green"
          description={
            objective
              ? `Période : mois · du ${formatDateCH(objective.dateDebut)} au ${formatDateCH(objective.dateFin)}`
              : "Aucun objectif mensuel fixé pour l'instant"
          }
          contentClassName="flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <MonthTimeBar window={w} className="w-[240px] max-w-full" />
            {g.metrics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex h-6 items-center rounded-full bg-info-50 px-2.5 text-xs font-bold text-info-700">
                  {okCount} dans le rythme
                </span>
                {accelCount > 0 && (
                  <span className="inline-flex h-6 items-center rounded-full bg-alert-50 px-2.5 text-xs font-bold text-alert-700">
                    {accelCount} à accélérer
                  </span>
                )}
              </div>
            )}
          </div>
          {g.metrics.length > 0 ? (
            <>
              <ObjectiveProgressGrid
                metrics={g.metrics}
                window={w}
                audience="me"
                panierMoyen={g.panierMoyen}
              />
              <ObjectiveGridLegend window={w} />
              {objective?.notes && (
                <p className="rounded-[12px] bg-ground px-3.5 py-2.5 text-[13px] font-medium text-muted-foreground">
                  {objective.notes}
                </p>
              )}
            </>
          ) : (
            <EmptyState
              icon={Target}
              tone="green"
              title={`Ton objectif de ${w.monthName} n'est pas encore fixé`}
              description="En attendant, ta cible est simple : battre ton meilleur mois. Ta progression s'affichera ici dès que l'objectif sera posé."
            />
          )}
        </SectionCard>

        <div className="flex flex-wrap items-stretch gap-6">
          <MonthlyCalendar months={g.timeline} audience="me" className="flex-[1.4_1_480px]" />
          {records.length > 0 && <RecordsCard records={records} className="flex-[1_1_340px]" />}
        </div>

        <SectionCard
          id="versements"
          title={`Tous mes versements (${g.cockpit.payments.length})`}
          icon={Wallet}
          tone="navy"
          description="Les revenus « acquis » sont déjà gagnés. Ils te sont versés une fois par mois via ton salaire."
          className="scroll-mt-6"
        >
          <CommissionsTable payments={g.cockpit.payments} />
        </SectionCard>
      </div>
    </div>
  );
}
