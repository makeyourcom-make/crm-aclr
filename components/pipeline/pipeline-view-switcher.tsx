"use client";

/**
 * Sélecteur de vue du Pipeline — admin uniquement.
 *
 * Bascule entre :
 *   - les deals d'Arthur (défaut)
 *   - ceux de chaque commerciale (Sophie, ...)
 *   - "Toute l'équipe"
 *
 * Utilise le paramètre URL ?assigneAId={userId} déjà supporté par la query.
 * "mine" → assigneAId = currentUserId. "all" → pas de filtre.
 */
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

interface PipelineViewSwitcherProps {
  users: Array<{ id: string; name: string }>;
  currentUserId: string;
  /** Valeur actuelle de assigneAId dans l'URL, ou undefined si "Tous". */
  activeAssigneAId?: string;
}

export function PipelineViewSwitcher({
  users,
  currentUserId,
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
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        Vue :
      </span>
      <Btn active={isMine} onClick={() => goTo("mine")} label="Mon pipeline" />
      {others.map((u) => (
        <Btn
          key={u.id}
          active={activeAssigneAId === u.id}
          onClick={() => goTo(u.id)}
          label={u.name.split(" ")[0]}
        />
      ))}
      <Btn
        active={isAll}
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
