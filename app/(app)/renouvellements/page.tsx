import Link from "next/link";

import { RecomputeButton } from "@/components/commissions/recompute-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { formatCHF, formatDateLong } from "@/lib/format";
import { requireUser, scopedWhere } from "@/lib/session";

export const metadata = { title: "Renouvellements" };
export const dynamic = "force-dynamic";

export default async function RenouvellementsPage() {
  const user = await requireUser();
  const now = new Date();
  const in90Days = new Date(now);
  in90Days.setDate(in90Days.getDate() + 90);

  // Contrats ACTIF avec anniversaire dans les 90 jours
  const contracts = await prisma.contract.findMany({
    where: { ...scopedWhere(user, {}), statut: "ACTIF", montantMensuel: { gt: 0 } },
    select: {
      id: true,
      numero: true,
      dateSignature: true,
      montantMensuel: true,
      prospect: { select: { raisonSociale: true } },
      assigneA: {
        select: { id: true, name: true, tauxCommissionRenouvellement: true },
      },
      renewals: { orderBy: { dateRenouvellement: "desc" } },
    },
  });

  // Calcule pour chaque contrat le prochain anniversaire
  const enrichis = contracts.map((c) => {
    const next = new Date(c.dateSignature);
    while (next <= now) next.setFullYear(next.getFullYear() + 1);
    const taux = Number(c.assigneA.tauxCommissionRenouvellement);
    return {
      ...c,
      nextAnniv: next,
      commissionMensuelle: Number(c.montantMensuel) * taux,
      yearsSince: next.getFullYear() - c.dateSignature.getFullYear(),
      diffDays: Math.ceil((next.getTime() - now.getTime()) / 86400_000),
    };
  });

  const aVenirCount = enrichis.filter((c) => c.nextAnniv <= in90Days).length;
  const dejaRenoueles = enrichis.filter((c) => c.renewals.length > 0).length;
  const totalMensuelARenouveler = enrichis
    .filter((c) => c.nextAnniv <= in90Days)
    .reduce((s, c) => s + Number(c.montantMensuel), 0);
  const commissionATtenduSemaine = enrichis
    .filter((c) => c.nextAnniv <= in90Days)
    .reduce((s, c) => s + c.commissionMensuelle * 12, 0);

  // Groupe par mois pour l'affichage
  const byMonth = new Map<string, typeof enrichis>();
  for (const c of enrichis) {
    if (c.nextAnniv > in90Days) continue;
    const key = `${c.nextAnniv.getFullYear()}-${c.nextAnniv.getMonth()}`;
    const arr = byMonth.get(key) ?? [];
    arr.push(c);
    byMonth.set(key, arr);
  }
  const sortedMonths = Array.from(byMonth.entries()).sort();

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Renouvellements"
        description="Anniversaires de contrats dans les 90 prochains jours. Tous les contrats se renouvellent automatiquement."
        actions={user.role === "ADMIN" ? <RecomputeButton /> : null}
      />

      {/* KPI */}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Kpi
          label="À renouveler 90j"
          value={`${aVenirCount}`}
          subtitle="contrats"
        />
        <Kpi
          label="Renouvellements totaux"
          value={`${dejaRenoueles}`}
          subtitle="déjà traités"
          tone="emerald"
        />
        <Kpi
          label="CA mensuel renouvelé"
          value={formatCHF(totalMensuelARenouveler)}
          subtitle={`${formatCHF(totalMensuelARenouveler * 12)} / an`}
        />
        <Kpi
          label="Commission attendue"
          value={formatCHF(commissionATtenduSemaine)}
          subtitle="sur 12 mois renouvelés"
          tone="emerald"
        />
      </div>

      {/* Liste groupée par mois */}
      {sortedMonths.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Icon name="Repeat" className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun anniversaire de contrat dans les 90 prochains jours.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedMonths.map(([key, items]) => {
            const [year, mois] = key.split("-").map(Number);
            const d = new Date(year, mois, 1);
            const monthLabel = d.toLocaleDateString("fr-CH", {
              month: "long",
              year: "numeric",
            });
            const totalMonth = items.reduce(
              (s, c) => s + c.commissionMensuelle * 12,
              0,
            );
            return (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="text-base flex items-baseline justify-between">
                    <span className="capitalize">{monthLabel}</span>
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                      {items.length} contrat(s) · commission an N+1 estimée :{" "}
                      {formatCHF(totalMonth)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {items.map((c) => {
                      const isAlreadyRenewedThisYear = c.renewals.some(
                        (r) =>
                          r.dateRenouvellement.getFullYear() ===
                          c.nextAnniv.getFullYear(),
                      );
                      const urgent = c.diffDays <= 7;
                      return (
                        <li
                          key={c.id}
                          className="flex items-center gap-3 px-3 py-2.5"
                        >
                          <Icon
                            name="Repeat"
                            className={`h-4 w-4 ${urgent ? "text-red-600" : "text-muted-foreground"}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/contrats/${c.id}`}
                                className="font-mono text-xs hover:underline"
                              >
                                {c.numero}
                              </Link>
                              <span className="text-sm font-medium">
                                {c.prospect.raisonSociale}
                              </span>
                              {isAlreadyRenewedThisYear && (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 font-normal">
                                  Auto-renouvelé
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Anniversaire {formatDateLong(c.nextAnniv)} ·{" "}
                              {c.diffDays > 0
                                ? `dans ${c.diffDays} jour(s)`
                                : "aujourd'hui"}
                              {user.role === "ADMIN" &&
                                ` · ${c.assigneA.name}`}
                            </p>
                          </div>
                          <div className="text-right text-xs">
                            <p className="tabular-nums">
                              {formatCHF(Number(c.montantMensuel))} / mois
                            </p>
                            <p className="font-semibold tabular-nums text-emerald-700">
                              + {formatCHF(c.commissionMensuelle)} comm./mois
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        💡 Auto-renouvellement déclenché par le bouton 🔄 Recalculer (admin)
        ou la tâche CRON nocturne à l&apos;étape 27. Génère 12 nouvelles
        factures clients + 12 versements de commission RENOUVELLEMENT pour
        l&apos;année suivante.
      </p>
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
  tone?: "emerald";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "emerald" ? "text-emerald-700" : ""}`}
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
