"use client";

/**
 * Sélecteur de vue de l'agenda — admin uniquement.
 *
 * Permet à Arthur de basculer entre :
 *   - son propre agenda (défaut)
 *   - l'agenda d'une commerciale précise (Sophie, ...)
 *   - la vue "Toute l'équipe" agrégée
 */
import { useRouter, useSearchParams } from "next/navigation";

import { AGENDA_DEFAULT_VIEW } from "@/lib/agenda-view";
import { cn } from "@/lib/utils";

interface AgendaViewSwitcherProps {
  users: Array<{ id: string; name: string }>;
  currentUserId: string;
  /** Vue active : "mine" | "all" | userId */
  activeView: string;
}

export function AgendaViewSwitcher({
  users,
  currentUserId,
  activeView,
}: AgendaViewSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goTo = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    // Le paramètre n'existe que pour DÉVIER du défaut ; la vue par défaut est
    // l'URL nue. (Attention : "mine" n'est plus le défaut — le supprimer ici
    // renverrait « Mon agenda » sur « Toute l'équipe ».)
    if (view === AGENDA_DEFAULT_VIEW) {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    router.push(`/agenda?${params.toString()}`);
  };

  // Liste des autres users (= pas Arthur)
  const others = users.filter((u) => u.id !== currentUserId);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        Vue :
      </span>
      <Btn
        active={activeView === "mine"}
        onClick={() => goTo("mine")}
        label="Mon agenda"
      />
      {others.map((u) => (
        <Btn
          key={u.id}
          active={activeView === u.id}
          onClick={() => goTo(u.id)}
          label={u.name.split(" ")[0]}
        />
      ))}
      <Btn
        active={activeView === "all"}
        onClick={() => goTo("all")}
        label="Toute l'équipe"
      />
    </div>
  );
}

function Btn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
