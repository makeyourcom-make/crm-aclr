import { CommissionsTable } from "@/components/commissions/commissions-table";
import { MonthlyCalendar } from "@/components/commissions/monthly-calendar";
import { RecomputeButton } from "@/components/commissions/recompute-button";
import { TeamOverview } from "@/components/commissions/team-overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { formatCHF } from "@/lib/format";
import {
  getCommissionsCockpit,
  getCommissionsByUser,
} from "@/lib/queries/commissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Commissions" };
export const dynamic = "force-dynamic";

export default async function CommissionsPage() {
  const user = await requireUser();
  const [cockpit, teamRows] = await Promise.all([
    getCommissionsCockpit(user),
    user.role === "ADMIN" ? getCommissionsByUser() : Promise.resolve([]),
  ]);

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Commissions"
        description={
          user.role === "ADMIN"
            ? "Vue agrégée de toutes les commissions de l'équipe."
            : "Tes commissions acquises, à venir et le calendrier des versements."
        }
        actions={user.role === "ADMIN" ? <RecomputeButton /> : null}
      />

      {/* KPIs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Acquis cette année"
          value={formatCHF(cockpit.acquisYTD)}
          tone="emerald"
          subtitle="Total YTD"
        />
        <Kpi
          label="Acquis ce mois"
          value={formatCHF(cockpit.acquisMoisCourant)}
          tone="emerald"
          subtitle="→ prochaine facture"
        />
        <Kpi
          label="À venir"
          value={formatCHF(cockpit.aVenirTotal)}
          subtitle="Versements PREVU futurs"
        />
        <Kpi
          label="Annulées"
          value={formatCHF(cockpit.annule)}
          tone="muted"
          subtitle="Résiliations"
        />
      </div>

      {/* Calendrier mensuel */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Calendrier des versements — 13 mois
        </h2>
        <MonthlyCalendar parMois={cockpit.parMois} />
        <p className="mt-2 text-xs text-muted-foreground">
          💡 Les revenus « acquis » sont déjà gagnés. Ils sont versés à
          Sophie une fois par mois via la facture mensuelle (étape 14).
        </p>
      </section>

      {/* Vue admin : par commerciale */}
      {user.role === "ADMIN" && teamRows.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Par commerciale
          </h2>
          <TeamOverview rows={teamRows} />
        </section>
      )}

      {/* Détail */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Détail des versements ({cockpit.payments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <CommissionsTable
              payments={cockpit.payments}
              showCommerciale={user.role === "ADMIN"}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone?: "emerald" | "muted";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "emerald" ? "text-emerald-700" : tone === "muted" ? "text-muted-foreground" : ""}`}
        >
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
