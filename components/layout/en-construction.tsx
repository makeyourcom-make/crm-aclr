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
 * Utilisé pour les modules à venir dans le route group (app)/, pour
 * que la navigation soit fonctionnelle dès maintenant.
 */
export function EnConstruction({
  etape,
  titre,
  description,
}: EnConstructionProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-[18px] bg-coral-50 text-coral-600 shadow-arena">
        <Icon name="Construction" className="size-8" />
      </div>
      <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-[28px]">
        {titre}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cette section sera implémentée à l&apos;<strong>étape {etape}/30</strong>.
      </p>
      {description && (
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
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
