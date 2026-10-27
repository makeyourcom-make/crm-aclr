"use client";

/**
 * Héros du planning de production (MYC Arena) : « où j'en suis et quoi faire
 * maintenant » en 2 secondes.
 *
 *  A. Production du mois : anneau % livré, retards, tâches de la semaine,
 *     phrase coach, CTA « Chasser les retards » / « Voir ma semaine ».
 *  B. Charge par jour (lundi-vendredi) : barres fait / à faire, capacité 6 h,
 *     bouton « Lisser ma charge » (rééquilibrage).
 *  C. Livraison à l'heure : taux du mois, record, 3 derniers mois, clients
 *     bouclés, balles chez le client, quick wins.
 *
 * Données réelles uniquement (planning + historique `faitLe`).
 */
import { CalendarDays, Clock, Star, Target, Waves, Zap } from "lucide-react";
import Link from "next/link";

import { HeroPanel } from "@/components/arena/hero-panel";
import { ProgressRing } from "@/components/arena/progress-ring";
import type { ProductionStats } from "@/components/planning/production";
import {
  CAPACITE_JOUR_MIN,
  dayAbbr,
  ddmm,
  fmtDuree,
  monthLabel,
  monthLong,
  monthName,
} from "@/components/planning/shared";
import { buttonVariants } from "@/components/ui/button";
import type { ProductionMois } from "@/lib/queries/dossiers-production";
import { libelleCourt } from "@/lib/planning/templates";
import { cn } from "@/lib/utils";

const EYEBROW = "text-[11px] font-bold tracking-[0.08em] text-navy-300 uppercase";
const DARK_OUTLINE =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-white/40 px-4 text-sm font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-50";

const pl = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function PlanningHero({
  stats,
  today,
  historique,
  record,
  isSelf,
  ownerFirstName,
  clientOf,
  hrefJour,
  hrefSemaine,
  onLisser,
  lisserPending,
  onFiltre,
}: {
  stats: ProductionStats;
  today: string;
  historique: ProductionMois[];
  record: { mois: string; taux: number } | null;
  isSelf: boolean;
  ownerFirstName: string;
  /** Nom du client d'une tâche (par ligne). */
  clientOf: (ligneId: string) => string;
  hrefJour: string;
  hrefSemaine: string;
  onLisser: () => void;
  lisserPending: boolean;
  onFiltre: (f: "retard" | "attente" | "quick") => void;
}) {
  const moisNom = monthName(stats.mois);
  const reste = stats.resteCount;

  // Phrase coach (maquette validée), au tutoiement pour son propre planning.
  let accroche: string;
  let conseil: string;
  if (stats.boss) {
    const b = stats.boss;
    accroche = isSelf ? "Un boss t'attend." : `Un boss attend ${ownerFirstName}.`;
    conseil = `${libelleCourt(b.code ?? null, b.titre ?? "Tâche")} · ${clientOf(b.ligneId)}, reportée du ${ddmm(b.date)} : ${fmtDuree(b.dureeMin)}. ${isSelf ? "Abats-le et le reste suit." : "À abattre en premier."}`;
  } else if (stats.retards > 0) {
    accroche = `Plus que ${pl(stats.retards, "retard", "retards")} à chasser.`;
    conseil = `Solde-les et le taux à l'heure remonte.${reste ? ` Encore ${pl(reste, "tâche", "tâches")} et ${moisNom} est bouclé.` : ""}`;
  } else if (reste > 0) {
    accroche = "Zéro retard. Machine de guerre.";
    conseil = `Encore ${pl(reste, "tâche", "tâches")} et ${moisNom} est bouclé.`;
  } else if (stats.total > 0) {
    accroche = `${cap(moisNom)} est bouclé !`;
    conseil = "Mois livré à 100 %. Le suivant peut venir.";
  } else {
    accroche = "Rien à livrer ce mois-ci.";
    conseil = "Les tâches se génèrent toutes seules dès qu'un service est au planning.";
  }

  // --- B. Charge par jour -------------------------------------------------
  const jours = stats.semaine.jours;
  const maxJour = Math.max(CAPACITE_JOUR_MIN, ...jours.map((j) => j.totalMin));
  const H = 120; // hauteur utile des barres (px)
  const px = (min: number) => Math.round((min / maxJour) * H);
  const capaY = px(CAPACITE_JOUR_MIN);
  const chargeAria = `Charge par jour, capacité ${fmtDuree(CAPACITE_JOUR_MIN)} : ${jours
    .map((j) => `${dayAbbr(j.date)} ${fmtDuree(j.totalMin)} dont ${fmtDuree(j.faitMin)} fait`)
    .join(", ")}`;

  // --- C. À l'heure -------------------------------------------------------
  const taux = stats.aLHeure.taux;
  const histo = [
    ...historique.map((h) => ({ mois: h.mois, taux: h.taux, current: false })),
    { mois: stats.mois, taux, current: true },
  ];
  const aHisto = historique.some((h) => h.taux !== null);
  const histoAria = `Taux à l'heure : ${histo
    .map((h) => `${monthLabel(h.mois)} ${h.taux === null ? "aucune livraison" : `${h.taux} %`}`)
    .join(", ")}`;

  return (
    <HeroPanel
      aria-labelledby="planning-hero-titre"
      className="grid gap-7 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]"
    >
      {/* A. Production du mois */}
      <div className="flex min-w-0 flex-col gap-4">
        <p className={EYEBROW}>Score de livraison · {monthLong(stats.mois)}</p>
        <div className="flex flex-wrap items-center gap-5">
          <ProgressRing
            value={stats.faites}
            max={Math.max(stats.total, 1)}
            size={128}
            stroke={12}
            tone="coral"
            trackColor="#2F4470"
            label={`Production de ${moisNom} : ${stats.pct} % livré, ${stats.faites} tâches sur ${stats.total}`}
          >
            <span className="score-number text-[32px] text-white">{stats.pct} %</span>
            <span className="mt-1 text-xs font-semibold text-navy-200">livré</span>
          </ProgressRing>
          <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-2.5">
            <h2
              id="planning-hero-titre"
              className="font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] sm:text-[30px]"
            >
              Production {/^[aeiouyéè]/i.test(moisNom) ? "d'" : "de "}
              {moisNom} : {stats.pct} % livré
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onFiltre("retard")}
                className="inline-flex items-center gap-1.5 rounded-full bg-alert-50 px-3 py-1.5 text-[13px] font-extrabold text-alert-700 transition-transform hover:-translate-y-px"
              >
                <Clock aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
                {pl(stats.retards, "tâche en retard", "tâches en retard")}
                {stats.critiques > 0 && ` · ${pl(stats.critiques, "boss", "boss")}`}
              </button>
              <Link
                href={hrefSemaine}
                className="inline-flex items-center gap-1.5 rounded-full bg-lvl-50 px-3 py-1.5 text-[13px] font-extrabold text-lvl-700 transition-transform hover:-translate-y-px"
              >
                <CalendarDays aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
                {pl(stats.semaine.resteCount, "tâche cette semaine", "tâches cette semaine")}
              </Link>
            </div>
            <p className="text-[13px] text-navy-200">
              {stats.faites} / {stats.total} tâches livrées · {fmtDuree(stats.resteMin)} à faire ce mois
            </p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-navy-100">
          <strong className="text-white">{accroche}</strong> {conseil}
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Link href={hrefJour} className={buttonVariants({ variant: "hero" })}>
            <Target aria-hidden="true" />
            {stats.retards > 0 ? "Chasser les retards" : isSelf ? "Voir ma journée" : "Voir la journée"}
          </Link>
          <Link href={hrefSemaine} className={DARK_OUTLINE}>
            {isSelf ? "Voir ma semaine" : "Voir la semaine"}
          </Link>
        </div>
      </div>

      {/* B. Charge par jour */}
      <div className="flex min-w-0 flex-col gap-3.5 rounded-[16px] border border-white/12 bg-white/[0.06] p-4 sm:p-[18px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className={EYEBROW}>Charge par jour · semaine du {ddmm(jours[0]?.date ?? today)}</p>
            <p className="mt-0.5 font-display text-[22px] font-extrabold">
              {stats.semaine.totalMin > 0
                ? `${fmtDuree(stats.semaine.faitMin)} faites sur ${fmtDuree(stats.semaine.totalMin)}`
                : "Semaine libre"}
            </p>
          </div>
          <p className="text-xs text-navy-200">Capacité {fmtDuree(CAPACITE_JOUR_MIN)} / jour</p>
        </div>

        <div
          role="img"
          aria-label={chargeAria}
          className="relative grid grid-cols-5 items-end gap-3 border-b border-white/20"
          style={{ height: H + 22 }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/35"
            style={{ bottom: capaY }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 text-[11px] font-semibold text-navy-200"
            style={{ bottom: capaY + 3 }}
          >
            {fmtDuree(CAPACITE_JOUR_MIN)}
          </div>
          {jours.map((j) => {
            const resteMin = j.totalMin - j.faitMin;
            const ratio = j.totalMin / CAPACITE_JOUR_MIN;
            return (
              <div key={j.date} aria-hidden="true" className="flex h-full flex-col items-stretch justify-end">
                <span className="mb-1 text-center text-[11px] font-bold text-white tabular-nums">
                  {j.totalMin > 0 ? fmtDuree(j.totalMin) : ""}
                </span>
                {resteMin > 0 && (
                  <span
                    className={cn("block rounded-t-[8px]", ratio < 0.7 ? "bg-[#A48BFF]" : "bg-gold-500")}
                    style={{ height: Math.max(3, px(resteMin)) }}
                  />
                )}
                {j.faitMin > 0 && (
                  <span
                    className={cn("block bg-win-500", resteMin === 0 && "rounded-t-[8px]")}
                    style={{ height: Math.max(3, px(j.faitMin)) }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="-mt-1.5 grid grid-cols-5 gap-3">
          {jours.map((j) => (
            <span
              key={j.date}
              className={cn(
                "rounded-full py-[3px] text-center text-xs font-bold",
                j.date === today ? "bg-white text-navy-700" : "text-navy-200",
              )}
            >
              {dayAbbr(j.date)}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap gap-3 text-xs text-navy-200">
            <Legend color="bg-win-500" label="Fait" />
            <Legend color="bg-[#A48BFF]" label="À faire" />
            <Legend color="bg-gold-500" label="Chargé" />
          </div>
          <button
            type="button"
            onClick={onLisser}
            disabled={lisserPending}
            className={cn(DARK_OUTLINE, "h-9 px-3 text-[13px]")}
          >
            <Waves aria-hidden="true" className="size-4" />
            {lisserPending ? "Calcul..." : isSelf ? "Lisser ma charge" : "Lisser la charge"}
          </button>
        </div>
      </div>

      {/* C. Livraison à l'heure */}
      <div className="flex min-w-0 flex-col gap-3.5">
        <p className={EYEBROW}>Livraison à l&apos;heure · {moisNom}</p>
        <div className="flex flex-wrap items-end gap-3.5">
          {taux !== null ? (
            <span className="score-number text-[52px] sm:text-[56px]">{taux} %</span>
          ) : (
            <span className="font-display text-xl font-extrabold">Pas encore de livraison ce mois.</span>
          )}
          <div className="flex flex-col gap-1 pb-1.5">
            {record && (
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-gold-50 px-2.5 py-[3px] text-xs font-extrabold text-gold-700">
                <Star aria-hidden="true" className="size-3 fill-current" />
                Record {record.taux} % ({monthName(record.mois)})
              </span>
            )}
            {taux !== null && (
              <span className="text-xs text-navy-200">
                {stats.aLHeure.aLHeure} / {stats.aLHeure.faites} livrées au plus tard le jour prévu
              </span>
            )}
          </div>
        </div>

        {aHisto ? (
          <div role="img" aria-label={histoAria} className="grid h-16 grid-cols-4 items-end gap-2">
            {histo.map((h) => (
              <div key={h.mois} aria-hidden="true" className="flex h-16 flex-col justify-end gap-1">
                <span
                  className={cn("block rounded-[6px]", h.current ? "bg-coral-400" : "bg-[#5B6E9A]")}
                  style={{ height: h.taux === null ? 4 : Math.max(4, Math.round((Math.max(h.taux, 50) - 50) / 50 * 40)) }}
                />
                <span className="text-center text-[11px] font-semibold text-navy-200">
                  {monthLabel(h.mois).split(" ")[0]}
                  {h.taux !== null && ` · ${h.taux} %`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-navy-200">
            L&apos;historique se remplit au fil des mois : chaque tâche cochée au plus tard le jour prévu compte.
          </p>
        )}

        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
          <div className="rounded-[14px] bg-white/[0.08] px-3 py-2.5">
            <p className="font-display text-[22px] font-extrabold text-gold-500">
              {stats.clients.boucles} / {stats.clients.total}
            </p>
            <p className="text-xs text-navy-100">clients bouclés ce mois</p>
          </div>
          <button
            type="button"
            onClick={() => onFiltre("attente")}
            className="rounded-[14px] bg-white/[0.08] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.14]"
          >
            <span className="block font-display text-[22px] font-extrabold text-lvl-200">{stats.attente}</span>
            <span className="block text-xs text-navy-100">
              {stats.attente > 1 ? "balles chez le client" : "balle chez le client"} · <span className="font-bold text-white underline underline-offset-2">Voir</span>
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => onFiltre("quick")}
          disabled={stats.quickWins === 0}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-white px-3.5 text-[13px] font-extrabold text-navy-700 transition-colors hover:bg-navy-50 disabled:opacity-60"
        >
          <Zap aria-hidden="true" className="size-4 fill-gold-500 text-gold-500" />
          {stats.quickWins > 0
            ? pl(stats.quickWins, "quick win de 15 min ou moins", "quick wins de 15 min ou moins")
            : "Aucun quick win en attente"}
        </button>
      </div>
    </HeroPanel>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-2.5 rounded-[3px]", color)} />
      {label}
    </span>
  );
}
