import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Dashboard placeholder.
 *
 * Sera remplacé par le vrai dashboard à l'étape 16 (mois en cours, KPI,
 * pipeline, alertes). Pour l'instant : status + progression du chantier.
 */
export default async function DashboardPage() {
  const user = await requireUser();

  let dbStatus: { ok: boolean; message: string };
  try {
    const [users, prospects, deals, contracts] = await Promise.all([
      prisma.user.count(),
      prisma.prospect.count(),
      prisma.deal.count(),
      prisma.contract.count(),
    ]);
    dbStatus = {
      ok: true,
      message: `${users} utilisateurs · ${prospects} prospects · ${deals} deals · ${contracts} contrats`,
    };
  } catch (err) {
    dbStatus = {
      ok: false,
      message:
        err instanceof Error ? err.message : "Erreur de connexion inconnue.",
    };
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bonjour {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Le dashboard complet sera disponible à l&apos;étape 16. En attendant,
          tu peux explorer la navigation à gauche.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Application</CardTitle>
            <span className="text-emerald-600" aria-hidden>
              ✓
            </span>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Next.js répond, auth OK</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Session active pour {user.email}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Base de données
            </CardTitle>
            <span
              className={dbStatus.ok ? "text-emerald-600" : "text-amber-600"}
              aria-hidden
            >
              {dbStatus.ok ? "✓" : "!"}
            </span>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {dbStatus.ok ? "Postgres OK" : "Non connectée"}
            </p>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {dbStatus.message}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chantier</CardTitle>
            <Icon
              name="Construction"
              className="h-4 w-4 text-muted-foreground"
            />
          </CardHeader>
          <CardContent>
            <p className="text-sm">Étape 4 / 30</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Layout principal en place — les pages des modules suivent
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Feuille de route</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            <RoadmapItem done label="1. Scaffolding Next.js + Prisma + Docker" />
            <RoadmapItem done label="2. Schéma Prisma + moteur commissions + seed" />
            <RoadmapItem done label="3. Authentification NextAuth + middleware" />
            <RoadmapItem done label="4. Layout principal (sidebar + topbar)" />
            <RoadmapItem label="5. Module Prospects (liste, détail, import CSV)" />
            <RoadmapItem label="6. Module Activités + click-to-call" />
            <RoadmapItem label="7. Vue Aujourd'hui (cockpit Sophie)" />
            <RoadmapItem label="… et 23 étapes supplémentaires" muted />
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function RoadmapItem({
  done,
  muted,
  label,
}: {
  done?: boolean;
  muted?: boolean;
  label: string;
}) {
  return (
    <li
      className={
        muted
          ? "text-xs text-muted-foreground pl-5"
          : "flex items-center gap-2"
      }
    >
      {!muted && (
        <span className={done ? "text-emerald-600" : "text-muted-foreground"}>
          {done ? "✓" : "○"}
        </span>
      )}
      <span className={done ? "" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}
