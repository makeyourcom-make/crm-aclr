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
  const isAdmin = user.role === "ADMIN";
  const [cockpit, teamRows] = await Promise.all([
    getCommissionsCockpit(user),
    isAdmin ? getCommissionsByUser() : Promise.resolve([]),
  ]);

  // Vocabulaire selon le point de vue :
  //  - Sophie : "acquises" = ce qu'elle a gagné, prêt à lui être versé
  //  - Arthur : "versées" = ce qu'il a déjà / doit verser à la commerciale
  const labelGagneCetteAnnee = isAdmin
    ? "Versées cette année"
    : "Acquis cette année";
  const labelGagneCeMois = isAdmin ? "À verser ce mois" : "Acquis ce mois";
  const subtitleCeMois = isAdmin
    ? "→ via le salaire mensuel"
    : "→ prochain salaire";

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Commissions"
        description={
          isAdmin
            ? "Vue agrégée de toutes les commissions versées et à verser."
            : "Tes commissions acquises, à venir et le calendrier des versements."
        }
        actions={isAdmin ? <RecomputeButton /> : null}
      />

      {/* KPIs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label={labelGagneCetteAnnee}
          value={formatCHF(cockpit.acquisYTD)}
          tone="emerald"
          subtitle="Total YTD"
        />
        <Kpi
          label={labelGagneCeMois}
          value={formatCHF(cockpit.acquisMoisCourant)}
          tone="emerald"
          subtitle={subtitleCeMois}
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
          💡 {isAdmin
            ? "Les commissions « versées » sont déjà payées à la commerciale via son salaire mensuel."
            : "Les revenus « acquis » sont déjà gagnés. Ils te sont versés une fois par mois via ton salaire (étape 14)."}
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
