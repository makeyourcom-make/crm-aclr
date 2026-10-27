import Link from "next/link";

import { DossiersTabs } from "@/components/dossiers/dossiers-tabs";
import { PageHeader } from "@/components/page-header";
import { PlanningBoard } from "@/components/planning/planning-board";
import { prisma } from "@/lib/db";
import { addDays, addMonths, todayZurich } from "@/lib/planning/dates";
import { ensurePlanning } from "@/lib/planning/engine";
import { getPlanningData } from "@/lib/planning/queries";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Planning - Gestion des projets" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type Vue = "mois" | "semaine" | "jour";

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

  const vue: Vue =
    raw.vue === "semaine" ? "semaine" : raw.vue === "jour" ? "jour" : "mois";
  const today = todayZurich();

  // Début de fenêtre : mois courant (glissant) ou lundi de la semaine choisie.
  let from: Date;
  let to: Date;
  if (vue === "mois") {
    const m = typeof raw.debut === "string" && /^\d{4}-\d{2}$/.test(raw.debut) ? raw.debut : null;
    from = m ? new Date(`${m}-01T00:00:00.000Z`) : addMonths(today, 0);
    to = addMonths(from, 12);
  } else if (vue === "semaine") {
    const d = typeof raw.debut === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.debut) ? new Date(`${raw.debut}T00:00:00.000Z`) : today;
    from = addDays(d, -((d.getUTCDay() || 7) - 1)); // lundi
    to = addDays(from, 7);
  } else {
    from = today;
    to = addDays(today, 1);
  }

  await ensurePlanning(owner);
  const data = await getPlanningData(owner.id, from, to);

  const collaborateurs = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Gestion des projets"
        description="Planning de production : toutes les tâches clients récurrentes sur 12 mois glissants."
      />
      <DossiersTabs />

      {isAdmin && collaborateurs.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-muted-foreground">Planning de :</span>
          {collaborateurs.map((c) => (
            <Link
              key={c.id}
              href={c.id === user.id ? `/dossiers/planning?vue=${vue}` : `/dossiers/planning?vue=${vue}&pour=${c.id}`}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                c.id === owner.id
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {c.id === user.id ? `Moi (${c.name.split(" ")[0]})` : c.name.split(" ")[0]}
            </Link>
          ))}
        </div>
      )}

      <PlanningBoard
        vue={vue}
        from={from.toISOString().slice(0, 10)}
        today={today.toISOString().slice(0, 10)}
        ownerId={owner.id}
        ownerQuery={owner.id === user.id ? "" : `&pour=${owner.id}`}
        lignes={data.lignes}
        taches={data.taches}
      />
    </div>
  );
}
