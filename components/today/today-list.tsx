import { TodayItem } from "@/components/today/today-item";
import { cn } from "@/lib/utils";

import type { TodaySections } from "@/lib/queries/today";

interface TodayListProps {
  sections: TodaySections;
}

export function TodayList({ sections }: TodayListProps) {
  const hasAnyToday =
    sections.maintenant.length +
      sections.ceMatin.length +
      sections.cetApresMidi.length +
      sections.ceSoir.length >
    0;

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

      {/* État vide pour la journée */}
      {!hasAnyToday && sections.enRetard.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <p className="text-base font-medium text-foreground">
            Journée terminée 🎯
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Plus rien de planifié pour aujourd&apos;hui. Repose-toi ou prends de
            l&apos;avance sur demain.
          </p>
        </div>
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
