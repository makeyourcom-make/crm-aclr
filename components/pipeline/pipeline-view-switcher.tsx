"use client";

/**
 * Sélecteur de vue du Pipeline : admin uniquement.
 *
 * Bascule entre :
 *   - ses propres deals (« Mon pipeline »)
 *   - ceux de chaque collaborateur actif
 *   - « Toute l'équipe » (défaut, vue de pilotage globale)
 *
 * Utilise le paramètre URL ?assigneAId={userId} déjà supporté par la query.
 * "mine" → assigneAId = currentUserId. "all" → pas de filtre.
 */
import type { Role } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";

import { PlayerAvatar, toneForRole } from "@/components/arena";
import { firstNameOf, initialsOf } from "@/lib/gamification/rules";
import { cn } from "@/lib/utils";

interface PipelineViewSwitcherProps {
  users: Array<{ id: string; name: string; role?: Role }>;
  currentUserId: string;
  currentUserName: string;
  /** Valeur actuelle de assigneAId dans l'URL, ou undefined si "Tous". */
  activeAssigneAId?: string;
}

export function PipelineViewSwitcher({
  users,
  currentUserId,
  currentUserName,
  activeAssigneAId,
}: PipelineViewSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goTo = (mode: "mine" | "all" | string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "all") {
      params.delete("assigneAId");
    } else if (mode === "mine") {
      params.set("assigneAId", currentUserId);
    } else {
      params.set("assigneAId", mode);
    }
    router.push(`/pipeline?${params.toString()}`);
  };

  const isMine = activeAssigneAId === currentUserId;
  const isAll = !activeAssigneAId;
  const others = users.filter((u) => u.id !== currentUserId);

  return (
    <div
      role="group"
      aria-label="Vue du pipeline"
      className="flex flex-wrap gap-1 rounded-[14px] bg-ground p-1"
    >
      <ViewBtn
        active={isMine}
        onClick={() => goTo("mine")}
        label="Mon pipeline"
        avatar={<PlayerAvatar initials={initialsOf(currentUserName)} tone="navy" size={22} />}
      />
      {others.map((u) => (
        <ViewBtn
          key={u.id}
          active={activeAssigneAId === u.id}
          onClick={() => goTo(u.id)}
          label={firstNameOf(u.name)}
          avatar={
            <PlayerAvatar
              initials={initialsOf(u.name)}
              tone={toneForRole(u.role)}
              size={22}
            />
          }
        />
      ))}
      <ViewBtn
        active={isAll}
        onClick={() => goTo("all")}
        label="Toute l'équipe"
        avatar={<PlayerAvatar initials="ÉQ" tone="violet" size={22} />}
      />
    </div>
  );
}

function ViewBtn({
  active,
  onClick,
  label,
  avatar,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  avatar: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-[10px] px-3 text-[13px] font-bold transition-colors",
        active
          ? "bg-card text-foreground shadow-[0_1px_3px_rgba(14,25,54,0.14)]"
          : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
      )}
    >
      {avatar}
      {label}
    </button>
  );
}
