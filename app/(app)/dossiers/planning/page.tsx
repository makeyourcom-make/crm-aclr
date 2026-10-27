import Link from "next/link";

import { PlayerAvatar, toneForRole } from "@/components/arena/player-avatar";
import { DossiersTabs } from "@/components/dossiers/dossiers-tabs";
import { PageHeader } from "@/components/page-header";
import { PlanningBoard } from "@/components/planning/planning-board";
import { prisma } from "@/lib/db";
import { addDays, addMonths, todayZurich } from "@/lib/planning/dates";
import { ensurePlanning } from "@/lib/planning/engine";
import { getPlanningData } from "@/lib/planning/queries";
import { getProductionStats } from "@/lib/queries/dossiers-production";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Planning - Gestion des projets" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type Vue = "mois" | "semaine" | "jour";

function initiales(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

export default async function PlanningPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const isAdmin = user.role === "ADMIN";

  // Planning affiché : le sien ; l'admin peut ouvrir celui d'un·e collaborateur·rice.
  const pourParam = typeof raw.pour === "string" ? raw.pour : undefined;
  const ownerId = isAdmin && pourParam ? pourParam : user.id;
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, name: true, role: true },
  });
  if (!owner) return null;

  const vue: Vue = raw.vue === "semaine" ? "semaine" : raw.vue === "jour" ? "jour" : "mois";
  const today = todayZurich();

  // Début de fenêtre : mois courant (glissant) ou lundi de la semaine choisie.
  let from: Date;
  let to: Date;
  if (vue === "mois") {
    const m = typeof raw.debut === "string" && /^\d{4}-\d{2}$/.test(raw.debut) ? raw.debut : null;
    from = m ? new Date(`${m}-01T00:00:00.000Z`) : addMonths(today, 0);
    to = addMonths(from, 12);
  } else if (vue === "semaine") {
    const d =
      typeof raw.debut === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.debut)
        ? new Date(`${raw.debut}T00:00:00.000Z`)
        : today;
    from = addDays(d, -((d.getUTCDay() || 7) - 1)); // lundi
    to = addDays(from, 7);
  } else {
    from = today;
    to = addDays(today, 1);
  }

  await ensurePlanning(owner);
  const collaborateursP: Promise<{ id: string; name: string; role: string }[]> = isAdmin
    ? prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : Promise.resolve([]);
  const [data, production, collaborateurs] = await Promise.all([
    getPlanningData(owner.id, from, to),
    getProductionStats(owner.id),
    collaborateursP,
  ]);

  const isSelf = owner.id === user.id;
  const ownerFirstName = owner.name.split(" ")[0] ?? owner.name;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="projets"
        title="Gestion des projets"
        description={
          isSelf
            ? "Planning de production · tu livres, tes clients restent."
            : `Planning de production de ${owner.name} · 12 mois glissants.`
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <DossiersTabs />
        {isAdmin && collaborateurs.length > 1 && (
          <div role="group" aria-label="Planning de" className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Planning de :</span>
            {collaborateurs.map((c) => {
              const actif = c.id === owner.id;
              return (
                <Link
                  key={c.id}
                  href={c.id === user.id ? `/dossiers/planning?vue=${vue}` : `/dossiers/planning?vue=${vue}&pour=${c.id}`}
                  aria-current={actif ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border py-0 pr-3.5 pl-1.5 text-[13px] font-bold transition-colors",
                    actif
                      ? "border-navy-700 bg-navy-700 text-white"
                      : "border-border-strong bg-card text-foreground hover:bg-navy-50",
                  )}
                >
                  <PlayerAvatar initials={initiales(c.name)} tone={toneForRole(c.role)} size={26} />
                  {c.id === user.id ? `Moi (${c.name.split(" ")[0]})` : c.name.split(" ")[0]}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <PlanningBoard
        vue={vue}
        from={from.toISOString().slice(0, 10)}
        today={today.toISOString().slice(0, 10)}
        ownerId={owner.id}
        ownerQuery={isSelf ? "" : `&pour=${owner.id}`}
        ownerFirstName={ownerFirstName}
        isSelf={isSelf}
        lignes={data.lignes}
        taches={data.taches}
        production={production}
      />
    </div>
  );
}
