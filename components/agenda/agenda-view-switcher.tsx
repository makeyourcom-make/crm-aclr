"use client";

/**
 * Sélecteur de vue de l'agenda (admin uniquement).
 *
 * Permet à Arthur de basculer entre :
 *   - son propre agenda
 *   - l'agenda d'une commerciale précise
 *   - la vue « Toute l'équipe » agrégée (défaut, cf. AGENDA_DEFAULT_VIEW)
 */
import { Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { initialsOf } from "@/lib/gamification/rules";
import { AGENDA_DEFAULT_VIEW } from "@/lib/agenda-view";
import { cn } from "@/lib/utils";

interface AgendaViewSwitcherProps {
  users: Array<{ id: string; name: string }>;
  currentUserId: string;
  /** Vue active : "mine" | "all" | userId */
  activeView: string;
  /** Couleur de chaque collaborateur (vue équipe), pour la pastille. */
  userColors?: Record<string, string>;
}

export function AgendaViewSwitcher({
  users,
  currentUserId,
  activeView,
  userColors = {},
}: AgendaViewSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goTo = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    // Le paramètre n'existe que pour DÉVIER du défaut ; la vue par défaut est
    // l'URL nue. (Attention : « mine » n'est pas le défaut : le supprimer ici
    // renverrait « Mon agenda » sur « Toute l'équipe ».)
    if (view === AGENDA_DEFAULT_VIEW) {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    router.push(`/agenda?${params.toString()}`, { scroll: false });
  };

  // Liste des autres users (= pas l'admin courant)
  const others = users.filter((u) => u.id !== currentUserId);
  const me = users.find((u) => u.id === currentUserId);

  return (
    <div
      role="group"
      aria-label="Agenda affiché"
      className="flex flex-wrap items-center gap-2"
    >
      <span className="mr-0.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        Vue
      </span>
      <Btn
        active={activeView === "mine"}
        onClick={() => goTo("mine")}
        label="Mon agenda"
        initials={me ? initialsOf(me.name) : undefined}
        color={me ? userColors[me.id] : undefined}
      />
      {others.map((u) => (
        <Btn
          key={u.id}
          active={activeView === u.id}
          onClick={() => goTo(u.id)}
          label={u.name.split(" ")[0]}
          initials={initialsOf(u.name)}
          color={userColors[u.id]}
        />
      ))}
      <Btn
        active={activeView === "all"}
        onClick={() => goTo("all")}
        label="Toute l'équipe"
        team
      />
    </div>
  );
}

function Btn({
  active,
  onClick,
  label,
  initials,
  color,
  team = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  initials?: string;
  color?: string;
  team?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] pr-3.5 pl-1.5 text-[13px] font-bold transition-colors",
        active
          ? "border-navy-700 bg-navy-700 text-white"
          : "border-border-strong bg-card text-foreground hover:bg-navy-50",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-7 items-center justify-center rounded-full text-[11px] font-extrabold",
          active ? "bg-white/15 text-white" : "bg-navy-50 text-navy-700",
        )}
        style={
          !team && color && !active
            ? { background: color, color: color === "#F5A524" ? "#0E1936" : "#FFFFFF" }
            : undefined
        }
      >
        {team ? <Users className="size-3.5" /> : initials}
      </span>
      {label}
    </button>
  );
}
