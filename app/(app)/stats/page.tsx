import Link from "next/link";

import { CallTimeChart } from "@/components/stats/call-time-chart";
import { RankingList } from "@/components/stats/ranking-list";
import { StatsViewSwitcher } from "@/components/stats/stats-view-switcher";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import {
  formatCHF,
  formatDate,
  formatDuration,
  formatPercent,
} from "@/lib/format";
import { getProspectSecteurLabel } from "@/lib/labels";
import {
  getCallProductivity,
  getStats,
  getTopRankings,
} from "@/lib/queries/stats";
import { requireUser } from "@/lib/session";

import type { ProspectSecteur } from "@prisma/client";

export const metadata = { title: "Statistiques" };
export const dynamic = "force-dynamic";

const RANGES = [
  { value: 7, label: "7 jours" },
  { value: 30, label: "30 jours" },
  { value: 90, label: "90 jours" },
  { value: 365, label: "1 an" },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StatsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const rangeJours = Number(raw.range ?? 30) || 30;
  const isAdmin = user.role === "ADMIN";

  // Filtre par utilisateur (admin uniquement) — la matrice "Arthur voit Sophie"
  const viewAsUserId =
    isAdmin && typeof raw.user === "string" ? raw.user : undefined;

  const [data, callProd, rankings] = await Promise.all([
    getStats(user, rangeJours, viewAsUserId),
    isAdmin ? getCallProductivity(rangeJours, viewAsUserId) : null,
    getTopRankings(user, rangeJours, viewAsUserId),
  ]);

  // Liste des users pour le switcher (admin uniquement)
  const teamUsers = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Libellé descriptif de la vue active
  const viewedUser =
    viewAsUserId && viewAsUserId !== user.id
      ? teamUsers.find((u) => u.id === viewAsUserId)
      : null;
  const viewLabel = isAdmin
    ? viewAsUserId === user.id
      ? "Mes résultats"
      : viewedUser
        ? `Résultats de ${viewedUser.name}`
        : "Toute l'équipe"
    : "Mes résultats";

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Statistiques"
        description={`${viewLabel} · Analyse sur les ${rangeJours} derniers jours.`}
      />

      {/* Switcher commerciale (admin uniquement) */}
      {isAdmin && teamUsers.length > 1 && (
        <div className="mb-4">
          <StatsViewSwitcher
            users={teamUsers}
            currentUserId={user.id}
            activeUserId={viewAsUserId}
          />
        </div>
      )}

      {/* Switcher période */}
      <div className="mb-6 flex flex-wrap gap-2">
        {RANGES.map((r) => {
          const href = new URLSearchParams();
          href.set("range", String(r.value));
          if (viewAsUserId) href.set("user", viewAsUserId);
          return (
            <Link
              key={r.value}
              href={`/stats?${href.toString()}`}
              className={buttonVariants({
                variant: rangeJours === r.value ? "default" : "outline",
                size: "sm",
              })}
            >
              {r.label}
            </Link>
          );
        })}
      </div>

      {/* Activité KPI */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Activité
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Appels sortants" value={data.nbAppels} />
        <Kpi label="Emails envoyés" value={data.nbEmails} />
        <Kpi
          label="RDV honorés"
          value={data.nbRdvHonores}
          subtitle={`${data.nbRdvManques} manqués`}
        />
        <Kpi
          label="Propositions envoyées"
          value={data.nbPropositions}
        />
      </div>

      {/* Performance financière */}
      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Performance financière
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Signatures"
          value={data.nbSignatures}
          subtitle={formatCHF(data.caSigne)}
          tone="emerald"
        />
        <Kpi
          label="Pipeline pondéré"
          value={formatCHF(data.pipelinePondere)}
          subtitle={`Brut : ${formatCHF(data.pipelineTotal)}`}
        />
        <Kpi
          label="CA récurrent / mois"
          value={formatCHF(data.caRecurrentMensuel)}
          subtitle={`${formatCHF(data.caRecurrentMensuel * 12)} / an`}
        />
      </div>

      {/* Taux de conversion */}
      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Taux de conversion
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Appel → RDV"
          value={formatPercent(data.tauxAppelRdv)}
          subtitle={`${data.nbRdvHonores + data.nbRdvManques} RDV pour ${data.nbAppels} appels`}
        />
        <Kpi
          label="RDV → Signature"
          value={formatPercent(data.tauxRdvSignature)}
          subtitle={`${data.nbSignatures} sign. pour ${data.nbRdvHonores} RDV`}
        />
        <Kpi
          label="Proposition → Signature"
          value={formatPercent(data.tauxPropositionSignature)}
          subtitle={`${data.nbSignatures} / ${data.nbPropositions}`}
        />
      </div>

      {/* ====================================================================
          Productivité téléphone — ADMIN ONLY
          Sophie ne voit RIEN de cette section.
      ==================================================================== */}
      {isAdmin && callProd && (
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Productivité téléphone
            </h2>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: "#F4717419", color: "#F47174" }}
            >
              Admin only
            </span>
          </div>

          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Temps total téléphone"
              value={formatDuration(callProd.totalSeconds)}
              subtitle={`${callProd.nbAppelsWithDuration} appel(s) chronométrés`}
              tone="emerald"
            />
            <Kpi
              label="Durée moyenne / appel"
              value={formatDuration(Math.round(callProd.avgSeconds))}
            />
            <Kpi
              label="Plus long appel"
              value={formatDuration(callProd.maxSeconds)}
            />
            <Kpi
              label="Cadence"
              value={
                callProd.nbAppelsWithDuration > 0
                  ? `${(callProd.nbAppelsWithDuration / rangeJours).toFixed(1)}/jour`
                  : "—"
              }
              subtitle={`sur ${rangeJours} j`}
            />
          </div>

          {/* Graph temps par jour */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">
                Temps téléphone par jour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CallTimeChart data={callProd.parJour} />
            </CardContent>
          </Card>

          {/* Conversion par bucket */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">
                Conversion selon la durée d&apos;appel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {callProd.parBucket.map((b) => {
                  const max = Math.max(
                    ...callProd.parBucket.map((x) => x.tauxConversion),
                    0.01,
                  );
                  const pct = b.tauxConversion;
                  const widthPct = (pct / max) * 100;
                  return (
                    <div key={b.bucket}>
                      <div className="mb-1 flex items-baseline justify-between text-sm">
                        <span className="font-medium">{b.label}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {b.nbRdvPris}/{b.nbAppels} ={" "}
                          <span className="font-semibold text-foreground">
                            {formatPercent(pct)}
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={
                            b.bucket === "long"
                              ? "h-full bg-emerald-500"
                              : b.bucket === "moyen"
                                ? "h-full bg-amber-500"
                                : "h-full bg-slate-400"
                          }
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Conversion = appel ayant obtenu un RDV, une proposition, ou un
                rappel intéressé. Insight clé : si les appels longs convertissent
                bien mieux, ça vaut la peine d&apos;investir le temps dans le
                discovery au lieu de pitcher vite.
              </p>
            </CardContent>
          </Card>

          {/* Décomposition par commerciale (si plus d'une) */}
          {callProd.parUser.length > 1 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Par commerciale</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Commerciale</th>
                      <th className="px-3 py-2 text-right">Nb appels</th>
                      <th className="px-3 py-2 text-right">Temps total</th>
                      <th className="px-3 py-2 text-right">ø / appel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callProd.parUser.map((u) => (
                      <tr
                        key={u.userId}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-3 py-2 font-medium">{u.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {u.nbAppels}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatDuration(u.totalSeconds)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatDuration(Math.round(u.avgSeconds))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Top 5 plus longs appels */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">
                Top 5 plus longs appels
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {callProd.topLongs.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  Aucun appel chronométré sur la période.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {callProd.topLongs.map((c) => (
                    <li
                      key={c.activityId}
                      className="flex items-center gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/prospects/${c.prospectId}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {c.prospectName}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.sujet} · {formatDate(c.date)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {formatDuration(c.secondes)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Funnel */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">
            Funnel (cumulatif depuis le début)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <FunnelStep
              label="Prospects (total)"
              value={data.funnel.prospects}
              max={data.funnel.prospects}
              color="bg-slate-400"
            />
            <FunnelStep
              label="Contactés"
              value={data.funnel.contactes}
              max={data.funnel.prospects}
              color="bg-blue-400"
            />
            <FunnelStep
              label="RDV pris"
              value={data.funnel.rdvPris}
              max={data.funnel.prospects}
              color="bg-amber-400"
            />
            <FunnelStep
              label="Proposition envoyée"
              value={data.funnel.propositions}
              max={data.funnel.prospects}
              color="bg-orange-400"
            />
            <FunnelStep
              label="Signés"
              value={data.funnel.signes}
              max={data.funnel.prospects}
              color="bg-emerald-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* ====================================================================
          CLASSEMENTS — produits / secteurs B2B / cantons
          Visibles pour tous (Sophie voit ses propres rankings).
      ==================================================================== */}
      <h2 className="mt-12 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Classements — sur la période ({rangeJours} j)
      </h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top produits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Produits les plus vendus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RankingList
              items={rankings.produits.map((p) => ({
                key: p.productId,
                label: p.nom,
                sublabel: p.categorie,
                count: p.nbContrats,
                ca: p.ca,
                pct: p.pct,
              }))}
              emptyMessage="Aucun produit vendu sur cette période."
              hint="% = part des contrats signés contenant ce produit. CA = part de valeur an 1 attribuée."
            />
          </CardContent>
        </Card>

        {/* Top secteurs B2B */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Secteurs B2B</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingList
              items={rankings.secteurs.map((s) => ({
                key: s.secteur,
                label:
                  s.secteur === "INCONNU"
                    ? "—"
                    : getProspectSecteurLabel(s.secteur as ProspectSecteur),
                count: s.nbContrats,
                ca: s.ca,
                pct: s.pct,
              }))}
              emptyMessage="Aucun contrat signé sur cette période."
              hint="% = part des signatures dans ce secteur d'activité."
            />
          </CardContent>
        </Card>

        {/* Top cantons */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Couverture géographique
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RankingList
              items={rankings.cantons.map((c) => ({
                key: c.canton,
                label: c.canton,
                count: c.nbContrats,
                ca: c.ca,
                pct: c.pct,
              }))}
              emptyMessage="Aucune signature sur cette période."
              hint="% = part des signatures dans ce canton (le code postal du prospect)."
            />
          </CardContent>
        </Card>
      </div>
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
  value: string | number;
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

function FunnelStep({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
