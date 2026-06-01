"use client";

/**
 * En-tête de colonne cliquable générique (réutilisable sur toutes les pages).
 *
 * Met à jour ?sortBy=X&sortDir=Y dans l'URL et reset à la page 1.
 *
 * Indicateurs :
 *   ↕ : pas triée
 *   ↑ : ascendant
 *   ↓ : descendant
 */
import { useRouter, useSearchParams } from "next/navigation";

interface SortableHeaderProps {
  label: string;
  field: string;
  /** Valeur par défaut de sortBy quand aucun query param n'est défini. */
  defaultSortBy: string;
  /** Direction par défaut quand on clique pour la 1ère fois sur cette colonne. */
  defaultDir?: "asc" | "desc";
}

export function SortableHeader({
  label,
  field,
  defaultSortBy,
  defaultDir = "asc",
}: SortableHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSortBy = searchParams.get("sortBy") ?? defaultSortBy;
  const activeSortDir = searchParams.get("sortDir") ?? "desc";
  const isActive = activeSortBy === field;

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    let nextDir: "asc" | "desc";
    if (isActive) {
      nextDir = activeSortDir === "asc" ? "desc" : "asc";
    } else {
      nextDir = defaultDir;
    }
    params.set("sortBy", field);
    params.set("sortDir", nextDir);
    params.delete("page");
    router.push(`?${params.toString()}`);
  };

  const indicator = !isActive ? "↕" : activeSortDir === "asc" ? "↑" : "↓";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider transition-colors ${
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] ${
          isActive ? "" : "opacity-40 group-hover:opacity-100"
        }`}
        aria-hidden
      >
        {indicator}
      </span>
    </button>
  );
}
