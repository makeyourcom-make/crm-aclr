"use client";

/**
 * Admin uniquement : choisir le portefeuille dont on vide la file
 * (le sien par défaut, ou celui d'une commerciale).
 */
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

export function PhoningOwnerSwitcher({
  users,
  currentUserId,
  ownerId,
}: {
  users: { id: string; name: string }[];
  currentUserId: string;
  ownerId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (id: string) =>
    startTransition(() => router.push(id === currentUserId ? "/phoning" : `/phoning?pour=${encodeURIComponent(id)}`));

  const others = users.filter((u) => u.id !== currentUserId);
  if (others.length === 0) return null;

  const options = [{ id: currentUserId, label: "Mes prospects" }, ...others.map((u) => ({ id: u.id, label: u.name.split(" ")[0] ?? u.name }))];

  return (
    <div role="group" aria-label="Portefeuille appelé" className="flex flex-wrap items-center gap-1.5" aria-busy={pending}>
      <span className="text-xs font-bold text-muted-foreground">File de :</span>
      {options.map((o) => {
        const active = o.id === ownerId;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => go(o.id)}
            className={cn(
              "h-9 rounded-full border px-3.5 text-[13px] font-bold transition-colors",
              active
                ? "border-navy-700 bg-navy-700 text-white"
                : "border-border-strong bg-card text-foreground hover:bg-navy-50",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
