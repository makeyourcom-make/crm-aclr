/**
 * « Rappels à faire » : la file d'appels planifiés du jour.
 *
 * Retards d'abord (les plus chauds en tête selon le résultat du dernier
 * appel : intéressé > à rappeler > ... > combox), puis les rappels à venir
 * dans l'ordre de l'heure. Chaque ligne : résultat du dernier appel, note,
 * Appeler (click-to-call) et Marquer fait. CTA vers /phoning.
 *
 * Server-safe.
 */
import { PhoneCall, Zap } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/arena/empty-state";
import { formatInt, plural } from "@/components/arena/format";
import { StatusPill } from "@/components/arena/pills";
import { SectionCard } from "@/components/arena/section-card";
import { buttonVariants } from "@/components/ui/button";
import { XP_RULES } from "@/lib/gamification/rules";
import type { TodaySections, TodayTask } from "@/lib/queries/today";
import { cn } from "@/lib/utils";

import { CallButton } from "./call-button";
import { DoneButton } from "./done-button";
import { CHALEUR_INCONNUE, RESULTAT_META, TASK_TYPE_META } from "./task-meta";

const MAX_SHOWN = 8;

const chaleur = (t: TodayTask) =>
  t.dernierResultat ? RESULTAT_META[t.dernierResultat].chaleur : CHALEUR_INCONNUE;

export function CallQueue({ sections }: { sections: TodaySections }) {
  const isCall = (t: TodayTask) => t.kind === "call";
  // Tri stable : à chaleur égale, l'ordre chronologique est conservé.
  const late = sections.enRetard.filter(isCall).sort((a, b) => chaleur(b) - chaleur(a));
  const next = [
    ...sections.maintenant,
    ...sections.ceMatin,
    ...sections.cetApresMidi,
    ...sections.ceSoir,
  ].filter(isCall);
  const all = [...late, ...next];
  const shown = all.slice(0, MAX_SHOWN);
  const hidden = all.length - shown.length;

  return (
    <SectionCard
      id="rappels"
      className="scroll-mt-20"
      title="Rappels à faire"
      icon={PhoneCall}
      tone="coral"
      description={
        all.length === 0
          ? "Aucun rappel planifié aujourd'hui"
          : `${plural(all.length, "prospect")} à rappeler · retards et plus chauds en premier · +${XP_RULES.appel} XP l'appel, +${XP_RULES.conversation} XP s'il décroche`
      }
      action={
        all.length > 0 ? (
          <Link href="/phoning" className={buttonVariants({ variant: "default", size: "lg" })}>
            <Zap aria-hidden="true" className="fill-gold-500 text-gold-500" />
            Tout enchaîner en phoning
          </Link>
        ) : undefined
      }
    >
      {all.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          tone="coral"
          title="File de rappels vide"
          description={`Va chercher de nouvelles conversations : chaque appel rapporte +${XP_RULES.appel} XP.`}
          action={
            <Link href="/phoning" className={buttonVariants({ variant: "default", size: "lg" })}>
              Lancer le phoning
            </Link>
          }
        />
      ) : (
        <>
          <ol className="flex flex-col gap-2">
            {shown.map((t, i) => (
              <CallRow key={t.id} task={t} rank={i + 1} late={!!t.retard} />
            ))}
          </ol>
          {hidden > 0 && (
            <p className="mt-3 text-[13px] font-semibold text-muted-foreground">
              + {plural(hidden, "autre rappel", "autres rappels")} dans{" "}
              <a href="#feuille-de-route" className="font-bold text-info-700 hover:underline">
                ta feuille de route
              </a>
            </p>
          )}
        </>
      )}
    </SectionCard>
  );
}

function CallRow({ task: t, rank, late }: { task: TodayTask; rank: number; late: boolean }) {
  const res = t.dernierResultat ? RESULTAT_META[t.dernierResultat] : null;
  const name = t.prospect?.raisonSociale ?? t.sujet;
  const note = t.dernierNote ?? t.sujet;
  const quand = late
    ? t.retard?.veille
      ? `En retard · prévu le ${t.jour} à ${t.heure}`
      : `En retard · prévu ${t.heure}`
    : `Prévu ${t.heure}`;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[14px] border px-3.5 py-3",
        late ? "border-coral-100 bg-coral-50" : "border-border bg-card",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold",
          late ? "bg-alert-50 text-alert-700" : "bg-coral-50 text-coral-600",
        )}
      >
        {formatInt(rank)}
      </span>
      <div className="min-w-0 flex-[1_1_200px]">
        <div className="text-[15px] font-bold break-words">
          {t.prospect ? (
            <Link href={`/prospects/${t.prospect.id}`} className="text-foreground hover:underline">
              {t.prospect.raisonSociale}
            </Link>
          ) : (
            <span>{t.sujet}</span>
          )}
          {t.prospect?.ville && (
            <span className="text-[13px] font-medium text-muted-foreground"> · {t.prospect.ville}</span>
          )}
        </div>
        {note && note !== name && (
          <p className="mt-0.5 text-[13px] break-words text-muted-foreground">{note}</p>
        )}
      </div>
      <div className="flex min-w-0 flex-[0_1_190px] flex-col items-start gap-1">
        {res ? (
          <StatusPill tone={res.tone} dot={false}>
            {res.label}
          </StatusPill>
        ) : (
          <StatusPill tone="blue" dot={false}>
            Rappel planifié
          </StatusPill>
        )}
        <span
          className={cn(
            "text-xs font-semibold",
            late ? "text-alert-700" : "text-muted-foreground",
          )}
        >
          {quand}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {t.prospect?.telephone ? (
          <CallButton
            prospectId={t.prospect.id}
            raisonSociale={t.prospect.raisonSociale}
            telephone={t.prospect.telephone}
          />
        ) : t.prospect ? (
          <Link
            href={`/prospects/${t.prospect.id}`}
            className="inline-flex h-10 items-center rounded-[12px] border border-border-strong bg-card px-3.5 text-[13px] font-bold text-foreground hover:bg-navy-50"
          >
            Pas de numéro · voir la fiche
          </Link>
        ) : null}
        <DoneButton
          activityId={t.id}
          context={`rappel ${name}`}
          xp={t.xp}
          xpLabel={TASK_TYPE_META[t.type].xpLabel}
          xpSub={t.prospect?.raisonSociale}
        />
      </div>
    </li>
  );
}
