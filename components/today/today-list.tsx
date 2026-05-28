import { TodayItem } from "@/components/today/today-item";
import { cn } from "@/lib/utils";

import type { TodayCounters, TodaySections } from "@/lib/queries/today";

interface TodayListProps {
  sections: TodaySections;
  /** Compteurs du jour + objectifs pour évaluer si la journée est vraiment terminée. */
  counters: TodayCounters;
  goals: {
    appels: number;
    emails: number;
    rdv: number;
    propositions: number;
  };
}

export function TodayList({ sections, counters, goals }: TodayListProps) {
  const hasAnyToday =
    sections.maintenant.length +
      sections.ceMatin.length +
      sections.cetApresMidi.length +
      sections.ceSoir.length >
    0;

  // La journée est "terminée" SEULEMENT si tous les objectifs du jour
  // sont atteints. Sinon il reste du travail, peu importe l'agenda.
  const allGoalsReached =
    counters.appels >= goals.appels &&
    counters.emails >= goals.emails &&
    counters.rdvHonores >= goals.rdv &&
    counters.propositionsEnvoyees >= goals.propositions;

  // Calcul du manque pour l'encouragement contextuel
  const manques: string[] = [];
  if (counters.appels < goals.appels)
    manques.push(`${goals.appels - counters.appels} appel·s`);
  if (counters.emails < goals.emails)
    manques.push(`${goals.emails - counters.emails} email·s`);
  if (counters.rdvHonores < goals.rdv)
    manques.push(`${goals.rdv - counters.rdvHonores} RDV`);
  if (counters.propositionsEnvoyees < goals.propositions)
    manques.push(
      `${goals.propositions - counters.propositionsEnvoyees} proposition·s`,
    );

  return (
    <div className="space-y-6">
      {/* En retard — en haut, fond rouge */}
      {sections.enRetard.length > 0 && (
        <Section
          title="En retard"
          subtitle={`${sections.enRetard.length} tâche(s) à traiter d'urgence`}
          accent="red"
        >
          {sections.enRetard.map((a) => (
            <TodayItem key={a.id} activity={a} overdue />
          ))}
        </Section>
      )}

      {/* Maintenant — créneau actuel */}
      {sections.maintenant.length > 0 && (
        <Section
          title="Maintenant"
          subtitle="Prévu dans cette heure"
          accent="primary"
        >
          {sections.maintenant.map((a) => (
            <TodayItem key={a.id} activity={a} />
          ))}
        </Section>
      )}

      {/* Matin / après-midi / soir */}
      {sections.ceMatin.length > 0 && (
        <Section title="Ce matin" subtitle="Avant midi">
          {sections.ceMatin.map((a) => (
            <TodayItem key={a.id} activity={a} />
          ))}
        </Section>
      )}
      {sections.cetApresMidi.length > 0 && (
        <Section title="Cet après-midi" subtitle="12 h - 18 h">
          {sections.cetApresMidi.map((a) => (
            <TodayItem key={a.id} activity={a} />
          ))}
        </Section>
      )}
      {sections.ceSoir.length > 0 && (
        <Section title="Ce soir" subtitle="Après 18 h">
          {sections.ceSoir.map((a) => (
            <TodayItem key={a.id} activity={a} />
          ))}
        </Section>
      )}

      {/* État vide pour la journée — version contextuelle selon les objectifs */}
      {!hasAnyToday && sections.enRetard.length === 0 && (
        allGoalsReached ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-6 py-12 text-center">
            <p className="text-base font-medium text-emerald-900">
              Journée terminée 🎯
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              Tous tes objectifs sont atteints. Repose-toi ou prends de
              l&apos;avance sur demain.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 px-6 py-10 text-center">
            <p className="text-base font-medium text-amber-900">
              Plus rien de planifié — mais des objectifs à pousser 💪
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Il te reste {manques.join(" · ")} pour atteindre la journée.
            </p>
            <p className="mt-3 text-xs text-amber-700">
              Logger un appel ou un email depuis une fiche prospect, ou
              planifie un RDV depuis l&apos;agenda.
            </p>
          </div>
        )
      )}

      {/* Demain — preview */}
      {sections.demain.length > 0 && (
        <Section
          title="Demain — en aperçu"
          subtitle={`${sections.demain.length} prochains items`}
          accent="muted"
        >
          {sections.demain.map((a) => (
            <TodayItem key={a.id} activity={a} />
          ))}
        </Section>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  accent?: "red" | "primary" | "muted";
  children: React.ReactNode;
}

function Section({ title, subtitle, accent, children }: SectionProps) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h2
          className={cn(
            "text-sm font-semibold tracking-tight uppercase",
            accent === "red" && "text-red-700",
            accent === "primary" && "text-primary",
            (!accent || accent === "muted") && "text-muted-foreground",
          )}
        >
          {title}
        </h2>
        {subtitle && (
          <span className="text-xs text-muted-foreground">· {subtitle}</span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
