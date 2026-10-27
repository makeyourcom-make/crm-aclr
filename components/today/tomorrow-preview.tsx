/**
 * « Demain en aperçu » : les 5 premiers items planifiés demain, avec les
 * mêmes actions que la feuille de route (Appeler, Marquer fait) en version
 * compacte pour prendre de l'avance. Lien vers l'agenda.
 *
 * Server-safe.
 */
import Link from "next/link";

import { TONE_CLASSES } from "@/components/arena/tones";
import type { TodayTask } from "@/lib/queries/today";
import { cn } from "@/lib/utils";

import { CallButton } from "./call-button";
import { DoneButton } from "./done-button";
import { TASK_TYPE_META } from "./task-meta";

export function TomorrowPreview({ items }: { items: TodayTask[] }) {
  return (
    <section
      aria-labelledby="demain-titre"
      className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-border bg-card p-5 shadow-arena"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="demain-titre"
          className="font-display text-lg font-extrabold tracking-[-0.02em] text-foreground"
        >
          Demain en aperçu
        </h2>
        <Link href="/agenda" className="text-[13px] font-bold text-info-700 hover:underline">
          Voir l&apos;agenda
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          Rien de planifié demain pour l&apos;instant. Planifie tes rappels depuis le phoning ou
          l&apos;agenda.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((t) => {
            const meta = TASK_TYPE_META[t.type];
            const name = t.prospect?.raisonSociale ?? t.sujet;
            const canCall = t.kind === "call" && !!t.prospect?.telephone;
            const detail = t.prospect
              ? [t.prospect.ville, t.sujet].filter(Boolean).join(" · ")
              : "";
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-[14px] bg-ground px-3 py-2.5"
              >
                <span className="w-11 shrink-0 text-[13px] font-extrabold tabular-nums">
                  {t.heure}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">
                    {t.prospect ? (
                      <Link
                        href={`/prospects/${t.prospect.id}`}
                        className="text-foreground hover:underline"
                      >
                        {t.prospect.raisonSociale}
                      </Link>
                    ) : (
                      <span>{t.sujet}</span>
                    )}
                  </div>
                  <div
                    className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
                    title={detail}
                  >
                    <span
                      aria-hidden="true"
                      className={cn("size-2 shrink-0 rounded-full", TONE_CLASSES[meta.tone].solid)}
                    />
                    <span className="min-w-0 truncate">
                      <span className={cn("font-bold", TONE_CLASSES[meta.tone].text)}>
                        {meta.label}
                      </span>
                      {detail ? ` · ${detail}` : ""}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {canCall && (
                    <CallButton
                      prospectId={t.prospect!.id}
                      raisonSociale={t.prospect!.raisonSociale}
                      telephone={t.prospect!.telephone!}
                      variant="icon"
                    />
                  )}
                  <DoneButton
                    activityId={t.id}
                    context={`${meta.label} ${name}, demain ${t.heure}`}
                    xp={t.xp}
                    xpLabel={meta.xpLabel}
                    xpSub={t.prospect?.raisonSociale}
                    future={t.rdvFutur}
                    compact
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
