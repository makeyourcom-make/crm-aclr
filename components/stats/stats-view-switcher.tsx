"use client";

/**
 * Sélecteur de vue Statistiques : admin uniquement.
 *
 * Permet à Arthur d'analyser :
 *   - Toute l'équipe (défaut)
 *   - Ses propres résultats
 *   - Les résultats d'une commerciale
 *
 * Matrice « Arthur regarde la commerciale » demandée par l'utilisateur.
 * Contrôle segmenté MYC Arena (aria-pressed), la vue vit dans l'URL (?user=).
 */
import { useRouter, useSearchParams } from "next/navigation";

import { SegmentGroup, segmentClass } from "@/components/stats/ui";

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
    const qs = params.toString();
    router.push(qs ? `/stats?${qs}` : "/stats", { scroll: false });
  };

  const isAll = !activeUserId;
  const isMine = activeUserId === currentUserId;
  const others = users.filter((u) => u.id !== currentUserId);

  return (
    <SegmentGroup label="Vue" visibleLabel="Vue :">
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
    </SegmentGroup>
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
      className={segmentClass(active)}
    >
      {label}
    </button>
  );
}
