"use client";

/**
 * En-tête de colonne cliquable générique (réutilisable sur toutes les pages).
 *
 * Met à jour ?sortBy=X&sortDir=Y dans l'URL et reset à la page 1.
 *
 * Style MYC Arena : 11 px, 700, majuscules espacées 0.08em ; flèches Lucide
 * (double flèche = non triée, flèche haut / bas = sens du tri). Le sens du
 * tri est aussi annoncé aux lecteurs d'écran.
 */
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

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

  const Indicator = !isActive
    ? ChevronsUpDown
    : activeSortDir === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group -mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left text-[11px] font-bold tracking-[0.08em] uppercase transition-colors",
        isActive
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span>{label}</span>
      <Indicator
        aria-hidden="true"
        className={cn(
          "size-3.5 shrink-0",
          isActive ? "text-coral-600" : "opacity-50 group-hover:opacity-100",
        )}
      />
      <span className="sr-only">
        {isActive
          ? activeSortDir === "asc"
            ? ", trié par ordre croissant"
            : ", trié par ordre décroissant"
          : ", cliquer pour trier"}
      </span>
    </button>
  );
}
