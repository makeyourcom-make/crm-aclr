/**
 * Aide des raccourcis clavier (masquée sur téléphone : pas de clavier).
 * Server-safe.
 */
import { Keyboard } from "lucide-react";

const KBD =
  "inline-flex min-w-6 items-center justify-center rounded-[6px] border border-border-strong bg-card px-1.5 py-0.5 font-mono text-[11px] font-bold text-foreground";

export function ShortcutsHelp() {
  return (
    <section
      aria-labelledby="raccourcis-titre"
      className="hidden rounded-[20px] border border-dashed border-border-strong bg-card/60 px-5 py-4 text-xs text-muted-foreground md:block"
    >
      <h2
        id="raccourcis-titre"
        className="mb-2 flex items-center gap-2 text-[13px] font-bold text-foreground"
      >
        <Keyboard aria-hidden="true" className="size-4" />
        Raccourcis clavier
      </h2>
      <ul className="space-y-1.5">
        <li className="flex items-center gap-2">
          <kbd className={KBD}>c</kbd>
          appeler le prochain prospect
        </li>
        <li className="flex items-center gap-2">
          <kbd className={KBD}>Espace</kbd>
          marquer la prochaine tâche faite
        </li>
      </ul>
    </section>
  );
}
