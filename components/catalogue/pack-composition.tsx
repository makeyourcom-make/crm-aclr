import { formatCHF } from "@/lib/format";
import { resolvePackComponents } from "@/lib/queries/products";

interface PackCompositionProps {
  composantsIds: unknown;
}

export async function PackComposition({ composantsIds }: PackCompositionProps) {
  const components = await resolvePackComponents(composantsIds);

  if (components.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">
        Aucun composant.
      </p>
    );
  }

  return (
    <ul className="space-y-1 text-xs">
      {components.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between rounded bg-muted/30 px-2 py-1"
        >
          <span className="font-medium">{c.nom}</span>
          <span className="text-muted-foreground tabular-nums">
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
