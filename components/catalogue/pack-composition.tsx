import { formatCHF } from "@/lib/format";
import { resolvePackComponents } from "@/lib/queries/products";

interface PackCompositionProps {
  composantsIds: unknown;
}

/** Liste des composants d'un pack avec leurs prix (Server Component). */
export async function PackComposition({ composantsIds }: PackCompositionProps) {
  const components = await resolvePackComponents(composantsIds);

  if (components.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Aucun composant.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5 text-xs">
      {components.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between gap-3 rounded-[10px] bg-ground px-2.5 py-1.5"
        >
          <span className="min-w-0 truncate font-bold">{c.nom}</span>
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {c.prixOneShot && `${formatCHF(Number(c.prixOneShot))} one-shot`}
            {c.prixOneShot && c.prixMensuel && " · "}
            {c.prixMensuel && `${formatCHF(Number(c.prixMensuel))}/mois`}
            {!c.prixOneShot &&
              !c.prixMensuel &&
              c.prixAnnuel &&
              `${formatCHF(Number(c.prixAnnuel))}/an`}
          </span>
        </li>
      ))}
    </ul>
  );
}
