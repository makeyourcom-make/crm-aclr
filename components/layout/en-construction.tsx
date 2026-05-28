import { Icon } from "@/components/icon";

interface EnConstructionProps {
  /** Numéro de l'étape (1-30) qui implémente cette page. */
  etape: number;
  /** Titre de la page (ex. "Prospects", "Pipeline"). */
  titre: string;
  /** Description optionnelle de ce qui sera proposé une fois implémentée. */
  description?: string;
}

/**
 * Composant placeholder pour les pages pas encore implémentées.
 *
 * Utilisé pour les 23 modules à venir dans le route group (app)/, pour
 * que la navigation soit fonctionnelle dès maintenant.
 */
export function EnConstruction({
  etape,
  titre,
  description,
}: EnConstructionProps) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Icon name="Construction" className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{titre}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cette section sera implémentée à l&apos;<strong>étape {etape}/30</strong>.
      </p>
      {description && (
        <p className="mt-4 mx-auto max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      <p className="mt-8 text-xs text-muted-foreground">
        En attendant, tu peux naviguer dans les sections déjà disponibles depuis
        la sidebar.
      </p>
    </div>
  );
}
