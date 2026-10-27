/**
 * Héros « Pilotage direction » (admin) en tête de /stats.
 *
 * Gauche (navy) : contrats signés du mois vs objectif, CA signé du mois vs
 * objectif, CA annuel vs objectif annuel, projection au rythme actuel.
 * Droite (carte blanche) : « Machine récurrente » MRR vs charges mensuelles
 * récurrentes, marge récurrente, détail des charges et plan d'attaque.
 *
 * Un objectif absent n'est jamais inventé : la tuile affiche la valeur seule
 * et propose de définir l'objectif. Server-safe.
 */
import {
  CalendarCheck,
  ChevronRight,
  FileCheck,
  FileText,
  Phone,
  Receipt,
  SquareKanban,
  Target,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { HeroPanel } from "@/components/arena/hero-panel";
import { ProgressRing } from "@/components/arena/progress-ring";
import { StatusPill } from "@/components/arena/pills";
import { TONE_CLASSES, type Tone } from "@/components/arena/tones";
import { formatInt, pctOf } from "@/components/arena/format";
import { buttonVariants } from "@/components/ui/button";
import { formatCHFCompact } from "@/lib/format";
import type { DirectionDashboard } from "@/lib/queries/pilotage";
import { cn } from "@/lib/utils";

import { Eyebrow, cleanText } from "./ui";

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function plural(n: number, one: string, many: string): string {
  return `${formatInt(n)} ${n > 1 ? many : one}`;
}

/** Montant compact pour le centre d'un anneau : « 13.5k », « 186k ». */
function compact(n: number): string {
  const v = Math.round(n);
  if (Math.abs(v) >= 100_000) return `${Math.round(v / 1000)}k`;
  if (Math.abs(v) >= 10_000) return `${(v / 1000).toFixed(1)}k`;
  return formatInt(v);
}

export function DirectionHero({ data }: { data: DirectionDashboard }) {
  const { contratsMois, caMois, caAnnee } = data;
  const mois = data.monthName;

  // ---- Titre « coach » ----------------------------------------------------
  const resteContrats =
    contratsMois.objectif != null ? Math.max(0, contratsMois.objectif - contratsMois.value) : null;
  const resteCa = caMois.objectif != null ? Math.max(0, caMois.objectif - caMois.value) : null;
  let headline: string;
  if (resteContrats === null && resteCa === null) {
    headline = `${cap(mois)} : ${plural(contratsMois.value, "contrat signé", "contrats signés")} pour ${formatCHFCompact(caMois.value)}`;
  } else if ((resteContrats ?? 0) === 0 && (resteCa ?? 0) === 0) {
    headline = `${cap(mois)} est plié : objectifs atteints, on fait exploser le compteur`;
  } else {
    const bits: string[] = [];
    if (resteContrats) bits.push(plural(resteContrats, "contrat", "contrats"));
    if (resteCa) bits.push(formatCHFCompact(resteCa));
    headline = `Encore ${bits.join(" et ")} pour plier ${mois}`;
  }

  const phrases: string[] = [];
  const pctMois = caMois.objectif ? pctOf(caMois.value, caMois.objectif) : null;
  const pctAnnee = caAnnee.objectif ? pctOf(caAnnee.value, caAnnee.objectif) : null;
  if (pctMois !== null && pctAnnee !== null) {
    phrases.push(`Tu es à ${pctMois} % du CA du mois et à ${pctAnnee} % de l'année.`);
  } else if (pctMois !== null) {
    phrases.push(`Tu es à ${pctMois} % du CA du mois.`);
  } else if (pctAnnee !== null) {
    phrases.push(`Tu es à ${pctAnnee} % de l'objectif annuel.`);
  }
  let projection = `Au rythme actuel, ${data.year} finit vers ${formatCHFCompact(caAnnee.projection)} de CA signé`;
  if (caAnnee.objectif != null && caAnnee.besoinParMois != null) {
    projection +=
      caAnnee.besoinParMois > 0
        ? ` : il faut ${formatCHFCompact(caAnnee.besoinParMois)} par mois d'ici décembre (mois en cours compris) pour taper les ${formatCHFCompact(caAnnee.objectif)}.`
        : `, objectif annuel de ${formatCHFCompact(caAnnee.objectif)} déjà atteint.`;
  } else {
    projection += ".";
  }
  phrases.push(projection);
  if (contratsMois.objectif == null && caMois.objectif == null && caAnnee.objectif == null) {
    phrases.push("Aucun objectif mensuel ou annuel n'est défini : fixe-les pour suivre les jauges.");
  }

  return (
    <HeroPanel aria-labelledby="pilotage-titre" className="flex flex-col gap-7 xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold tracking-[0.08em] text-coral-100 uppercase">
            Pilotage direction · {data.monthLabel}
          </span>
          <StatusPill tone="gold" dot={false}>
            {plural(data.workingDaysLeft, "jour ouvré restant", "jours ouvrés restants")}
          </StatusPill>
        </div>

        <div className="flex flex-col gap-2">
          <h2
            id="pilotage-titre"
            className="font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] text-white sm:text-[34px]"
          >
            {headline}
          </h2>
          <p className="max-w-[640px] text-[15px] leading-relaxed text-navy-200">
            {phrases.join(" ")}
          </p>
        </div>

        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          <HeroGoal
            title="Contrats du mois"
            tone="coral"
            value={contratsMois.value}
            objectif={contratsMois.objectif}
            center={
              contratsMois.objectif != null
                ? `${formatInt(contratsMois.value)}/${formatInt(contratsMois.objectif)}`
                : formatInt(contratsMois.value)
            }
            ariaLabel={
              contratsMois.objectif != null
                ? `Contrats signés ce mois : ${contratsMois.value} sur ${contratsMois.objectif}`
                : `Contrats signés ce mois : ${contratsMois.value}, sans objectif`
            }
            line1={
              contratsMois.objectif != null
                ? `${pctOf(contratsMois.value, contratsMois.objectif)} % de l'objectif`
                : plural(contratsMois.value, "contrat signé", "contrats signés")
            }
            line2={
              resteContrats != null
                ? resteContrats > 0
                  ? `${plural(resteContrats, "contrat", "contrats")} à signer d'ici le ${data.lastWorkingDayLabel}`
                  : "Objectif atteint, bravo"
                : null
            }
          />
          <HeroGoal
            title="CA signé du mois"
            tone="gold"
            value={caMois.value}
            objectif={caMois.objectif}
            center={caMois.objectif != null ? undefined : compact(caMois.value)}
            ariaLabel={
              caMois.objectif != null
                ? `CA signé ce mois : ${formatCHFCompact(caMois.value)} sur ${formatCHFCompact(caMois.objectif)}`
                : `CA signé ce mois : ${formatCHFCompact(caMois.value)}, sans objectif`
            }
            line1={
              caMois.objectif != null
                ? `${formatCHFCompact(caMois.value)} / ${formatCHFCompact(caMois.objectif)}`
                : formatCHFCompact(caMois.value)
            }
            line2={
              resteCa != null
                ? resteCa > 0
                  ? `Manque ${formatCHFCompact(resteCa)}`
                  : "Objectif atteint, bravo"
                : "Valeur an 1 des contrats signés"
            }
          />
          <HeroGoal
            title={`CA annuel ${data.year}`}
            tone="green"
            value={caAnnee.value}
            objectif={caAnnee.objectif}
            center={caAnnee.objectif != null ? undefined : compact(caAnnee.value)}
            ariaLabel={
              caAnnee.objectif != null
                ? `CA annuel signé : ${formatCHFCompact(caAnnee.value)} sur ${formatCHFCompact(caAnnee.objectif)}`
                : `CA annuel signé : ${formatCHFCompact(caAnnee.value)}, sans objectif`
            }
            line1={
              caAnnee.objectif != null
                ? `${formatCHFCompact(caAnnee.value)} / ${formatCHFCompact(caAnnee.objectif)}`
                : formatCHFCompact(caAnnee.value)
            }
            line2={
              caAnnee.objectif != null
                ? caAnnee.objectif - caAnnee.value > 0
                  ? `Reste ${formatCHFCompact(caAnnee.objectif - caAnnee.value)}`
                  : "Objectif annuel atteint"
                : `Projection ${formatCHFCompact(caAnnee.projection)}`
            }
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/phoning" className={buttonVariants({ variant: "hero", size: "lg" })}>
            <Phone aria-hidden="true" />
            Lancer le phoning
          </Link>
          <Link
            href="/pipeline"
            className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-white/45 px-[18px] text-[15px] font-bold text-white transition-colors hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            <SquareKanban aria-hidden="true" className="size-[18px]" />
            Voir les deals chauds
          </Link>
          {(contratsMois.objectif == null || caMois.objectif == null || caAnnee.objectif == null) && (
            <Link
              href="/objectifs"
              className="inline-flex h-11 items-center gap-2 rounded-[12px] px-3 text-[15px] font-bold text-navy-200 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none"
            >
              <Target aria-hidden="true" className="size-[18px]" />
              Définir les objectifs
            </Link>
          )}
        </div>
      </div>

      <RecurringMachine data={data} />
    </HeroPanel>
  );
}

function HeroGoal({
  title,
  tone,
  value,
  objectif,
  center,
  ariaLabel,
  line1,
  line2,
}: {
  title: string;
  tone: Tone;
  value: number;
  objectif: number | null;
  center?: string;
  ariaLabel: string;
  line1: ReactNode;
  line2: ReactNode | null;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3.5 rounded-[16px] border border-white/12 bg-white/6 p-3.5">
      {objectif != null ? (
        <ProgressRing
          value={value}
          max={objectif}
          size={84}
          stroke={11}
          tone={tone}
          trackColor="#2F4470"
          label={ariaLabel}
        >
          <span className="score-number text-[22px] text-white">
            {center ?? `${pctOf(value, objectif)}%`}
          </span>
        </ProgressRing>
      ) : (
        <span
          role="img"
          aria-label={ariaLabel}
          className="flex size-[84px] shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-dashed border-navy-500 text-center"
        >
          <span aria-hidden="true" className="score-number text-[20px] text-white">
            {center ?? compact(value)}
          </span>
          <span aria-hidden="true" className="mt-1 text-[10px] font-bold tracking-[0.06em] text-navy-200 uppercase">
            sans obj.
          </span>
        </span>
      )}
      <div className="flex min-w-0 flex-[1_1_120px] flex-col gap-1">
        <span className="text-[11px] font-bold tracking-[0.08em] text-navy-200 uppercase">{title}</span>
        <span className="text-sm font-bold text-white">{line1}</span>
        {line2 && <span className="text-xs text-navy-200">{line2}</span>}
        {objectif == null && (
          <Link
            href="/objectifs"
            className="text-xs font-bold text-white underline underline-offset-2 hover:text-coral-100"
          >
            Aucun objectif défini · le fixer
          </Link>
        )}
      </div>
    </div>
  );
}

function RecurringMachine({ data }: { data: DirectionDashboard }) {
  const mrr = data.mrr.value;
  const charges = data.charges.total;
  const marge = data.margeRecurrente;
  const positive = marge >= 0;
  const base = Math.max(mrr, charges, 1);
  const chargesW = Math.round((Math.min(charges, mrr) / base) * 1000) / 10;
  const margeW = positive ? Math.round((marge / base) * 1000) / 10 : 0;
  const deficitW = positive ? 0 : Math.round(((charges - mrr) / base) * 1000) / 10;
  const mrrOnlyW = positive ? 0 : Math.round((mrr / base) * 1000) / 10;

  const couverture = data.couverture;
  const couverturePill =
    couverture == null ? null : couverture >= 1 ? (
      <StatusPill tone="green" dot={false}>
        Charges couvertes x{couverture.toFixed(1)}
      </StatusPill>
    ) : (
      <StatusPill tone="red" dot={false}>
        MRR couvre {Math.round(couverture * 100)} % des charges
      </StatusPill>
    );

  const plan = data.plan;
  const actions: { href: string; icon: LucideIcon; tone: Tone; title: string; sub: string }[] = [];
  actions.push({
    href: "/agenda",
    icon: CalendarCheck,
    tone: "gold",
    title: `${plural(plan.rdvSemaine, "RDV client planifié", "RDV clients planifiés")} d'ici dimanche`,
    sub:
      plan.rdvAValider > 0
        ? `+ ${plural(plan.rdvAValider, "RDV passé à valider", "RDV passés à valider")}${plan.dernierRdvAValider ? ` : ${cleanText(plan.dernierRdvAValider.prospect)}, ${plan.dernierRdvAValider.quand}` : ""}`
        : "Aucun RDV passé en attente de validation",
  });
  if (plan.contratsAValider > 0) {
    actions.push({
      href: "/contrats?statut=ATTENTE_VALIDATION_ADMIN",
      icon: FileCheck,
      tone: "navy",
      title: `${plural(plan.contratsAValider, "contrat à valider", "contrats à valider")} définitivement`,
      sub: "Ils passent en Actif, factures prêtes à partir",
    });
  }
  actions.push({
    href: "/contrats?statut=ATTENTE_SIGNATURE_CLIENT",
    icon: FileText,
    tone: "violet",
    title: `${plural(plan.propositionsEnAttente, "proposition en attente", "propositions en attente")} de signature`,
    sub: `dont ${plural(plan.propositionsRecentes, "envoyée", "envoyées")} ces 30 derniers jours`,
  });

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-[20px] bg-card p-5 text-foreground shadow-arena-lg xl:w-[400px] xl:flex-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Machine récurrente</Eyebrow>
        {couverturePill}
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <span className="score-number text-[40px] sm:text-[44px]">{formatInt(mrr)}</span>
        <span className="text-sm font-bold text-muted-foreground">
          CHF de MRR / mois · {plural(data.mrr.nbContrats, "contrat actif", "contrats actifs")}
        </span>
      </div>

      <div
        role="img"
        aria-label={
          positive
            ? `Sur ${formatCHFCompact(mrr)} de MRR : ${formatCHFCompact(charges)} de charges récurrentes et ${formatCHFCompact(marge)} de marge`
            : `Le MRR de ${formatCHFCompact(mrr)} ne couvre pas les ${formatCHFCompact(charges)} de charges récurrentes : il manque ${formatCHFCompact(-marge)}`
        }
        className="flex h-3.5 overflow-hidden rounded-full bg-navy-50"
      >
        {positive ? (
          <>
            <div className="bg-navy-500" style={{ width: `${chargesW}%` }} />
            <div className="bg-win-500" style={{ width: `${margeW}%` }} />
          </>
        ) : (
          <>
            <div className="bg-navy-500" style={{ width: `${mrrOnlyW}%` }} />
            <div className="bg-alert-500" style={{ width: `${deficitW}%` }} />
          </>
        )}
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr))]">
        <div className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-ground p-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <span aria-hidden="true" className="size-2 rounded-full bg-navy-500" />
            Charges récurrentes / mois
          </span>
          <span className="text-lg font-extrabold tabular-nums">{formatCHFCompact(charges)}</span>
        </div>
        <div
          className={cn(
            "flex min-w-0 flex-col gap-0.5 rounded-[14px] p-3",
            positive ? "bg-win-50" : "bg-alert-50",
          )}
        >
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold",
              positive ? "text-win-700" : "text-alert-700",
            )}
          >
            <span aria-hidden="true" className={cn("size-2 rounded-full", positive ? "bg-win-500" : "bg-alert-500")} />
            Marge récurrente
          </span>
          <span
            className={cn("text-lg font-extrabold tabular-nums", positive ? "text-win-700" : "text-alert-700")}
          >
            {formatCHFCompact(marge)}
            {data.margePct != null && ` · ${Math.round(data.margePct * 100)} %`}
          </span>
        </div>
      </div>

      <details className="group rounded-[14px] border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-[14px] px-3 py-2.5 text-[13px] font-bold text-foreground hover:bg-ground [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <Receipt aria-hidden="true" className="size-4 text-muted-foreground" />
            Détail des charges récurrentes ({data.charges.items.length})
          </span>
          <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
          {data.charges.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucune charge récurrente détectée sur {data.charges.fenetreLabel}.
            </p>
          ) : (
            <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pr-1">
              {data.charges.items.map((it) => (
                <li key={it.key} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{cleanText(it.label)}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {it.source === "observe" ? `Vue ${it.moisVus} mois sur 3` : "Modèle de charge récurrente"}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">{formatCHFCompact(it.montantMensuel)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Estimation sur {data.charges.fenetreLabel} : fournisseurs présents au moins 2 mois sur 3
            (hors repas et matériel), moyenne sur 3 mois, plus les modèles de charges récurrentes actifs
            pas encore saisis. Montants TTC. Charges moyennes totales (ponctuelles comprises) :{" "}
            {formatCHFCompact(data.charges.moyenneTotale)} / mois.{" "}
            <Link href="/charges" className="font-bold text-info-700 hover:underline">
              Gérer les charges
            </Link>
          </p>
        </div>
      </details>

      <div className="flex flex-col gap-2">
        <Eyebrow>Plan d&apos;attaque</Eyebrow>
        {actions.map((a) => {
          const t = TONE_CLASSES[a.tone];
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex items-center gap-3 rounded-[14px] border border-border px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-ground"
            >
              <span
                aria-hidden="true"
                className={cn("flex size-9 shrink-0 items-center justify-center rounded-[12px]", t.bg, t.text)}
              >
                <Icon className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-bold">{a.title}</span>
                <span className="text-xs text-muted-foreground">{a.sub}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-subtle group-hover:text-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
