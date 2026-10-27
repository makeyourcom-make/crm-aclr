"use client";

/**
 * Sélecteur de vue de la liste d'activités - admin uniquement.
 *
 * Permet à Arthur de basculer entre :
 *   - ses propres activités (défaut)
 *   - les activités de chaque commerciale
 *   - "Toute l'équipe"
 */
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

interface ActivityViewSwitcherProps {
  users: Array<{ id: string; name: string }>;
  currentUserId: string;
  activeView: string;
}

export function ActivityViewSwitcher({
  users,
  currentUserId,
  activeView,
}: ActivityViewSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goTo = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "mine") {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    // Reset page sur changement de vue
    params.delete("page");
    router.push(`/activites?${params.toString()}`);
  };

  const others = users.filter((u) => u.id !== currentUserId);

  return (
    <div role="group" aria-label="Vue" className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-bold text-muted-foreground">Vue :</span>
      <Btn
        active={activeView === "mine"}
        onClick={() => goTo("mine")}
        label="Mes activités"
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
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-bold transition-colors",
        active
          ? "border-navy-700 bg-navy-700 text-white"
          : "border-border-strong bg-card text-foreground hover:bg-navy-50",
      )}
    >
      {label}
    </button>
  );
}
