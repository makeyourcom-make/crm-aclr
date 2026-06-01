"use client";

/**
 * Sélecteur de vue Statistiques — admin uniquement.
 *
 * Permet à Arthur d'analyser :
 *   - Toute l'équipe (défaut)
 *   - Ses propres résultats
 *   - Les résultats de Sophie (ou d'une autre commerciale)
 *
 * → "Matrice Arthur regarde Sophie" demandée par l'utilisateur.
 */
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

interface StatsViewSwitcherProps {
  users: Array<{ id: string; name: string }>;
  currentUserId: string;
  activeUserId?: string;
}

export function StatsViewSwitcher({
  users,
  currentUserId,
  activeUserId,
}: StatsViewSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goTo = (mode: "all" | "mine" | string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "all") {
      params.delete("user");
    } else if (mode === "mine") {
      params.set("user", currentUserId);
    } else {
      params.set("user", mode);
    }
    router.push(`/stats?${params.toString()}`);
  };

  const isAll = !activeUserId;
  const isMine = activeUserId === currentUserId;
  const others = users.filter((u) => u.id !== currentUserId);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        Vue :
      </span>
      <Btn active={isAll} onClick={() => goTo("all")} label="Toute l'équipe" />
      <Btn active={isMine} onClick={() => goTo("mine")} label="Mes résultats" />
      {others.map((u) => (
        <Btn
          key={u.id}
          active={activeUserId === u.id}
          onClick={() => goTo(u.id)}
          label={u.name.split(" ")[0]}
        />
      ))}
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
