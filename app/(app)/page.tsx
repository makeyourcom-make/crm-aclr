import Link from "next/link";

import { CommissionsChartLazy as CommissionsChart } from "@/components/dashboard/commissions-chart-lazy";
import { RdvAValiderBanner } from "@/components/dashboard/rdv-a-valider";
import { ValidateContractButton } from "@/components/contrats/validate-contract-button";
import { SignAclrButton } from "@/components/signatures/sign-aclr-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { buttonVariants } from "@/components/ui/button";
import { formatCHF, formatCHFCompact, formatDate } from "@/lib/format";
import { getDashboard } from "@/lib/queries/dashboard";
import { getPlanningAlertes } from "@/lib/planning/queries";
import { getRdvAValider } from "@/lib/queries/rdv-a-valider";
import {
  getTeamActivityOverview,
  resolvePeriode,
} from "@/lib/queries/stats";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const data = await getDashboard(user);

  // Pilotage équipe (admin) : activité par collaborateur sur jour/semaine/mois.
  const raw = await searchParams;
  const periodeActivite = resolvePeriode(
    typeof raw.activite === "string" ? raw.activite : "jour",
  );
  // Alerte planning de production (tâches du jour / en retard).
  const planning = await getPlanningAlertes(user.id);
  // Rappel de fin de journée : RDV passés à valider (effectué / manqué / annulé).
  const rdvAValider = await getRdvAValider(user.id);
  const todayZurich = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });

  const teamActivity =
    user.role === "ADMIN"
      ? await getTeamActivityOverview(
          periodeActivite.start,
          periodeActivite.end,
        )
      : null;
  const yoy = data.caAnnuel;
  const caAnnuelSubtitle = yoy
    ? yoy.variationPct === null
      ? `depuis le 1er janvier ${yoy.annee}`
      : `${yoy.variationPct >= 0 ? "+" : ""}${yoy.variationPct.toFixed(0)} % vs ${yoy.annee - 1}`
    : "";
  const monthLabel = new Date()
    .toLocaleDateString("fr-CH", { month: "long", year: "numeric" })
    .replace(/^(.)/, (m) => m.toUpperCase());

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bonjour {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble · {monthLabel}
        </p>
      </div>

      {user.role === "ADMIN" ? (
        // ====================================================================
        // VUE ADMIN — KPIs agence uniquement (pas de "Commissions acquises"
        // ni "Salaire prévu" perso : c'est la rémunération des commerciales,
        // pas pertinent au niveau direction).
        // ====================================================================
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/contrats"
            className="block rounded-xl transition hover:shadow-md"
          >
            <Kpi
              label="Signatures du mois"
              value={`${data.signaturesMois.count}`}
              subtitle="voir les contrats →"
            />
          </Link>
          <Kpi
            label="CA du mois"
            value={formatCHF(data.caAgenceMois ?? 0)}
            subtitle="valeur totale des contrats signés"
            tone="primary"
          />
          <Kpi
            label="CA récurrent mensuel"
            value={`${formatCHFCompact(data.caRecurrentTotalMensuel ?? 0)} / mois`}
            subtitle="facturé chaque mois"
            tone="primary"
          />
          <Kpi
            label={`CA ${yoy?.annee ?? ""} (annuel)`}
            value={formatCHF(yoy?.courant ?? 0)}
            subtitle={caAnnuelSubtitle}
            tone="primary"
          />
        </div>
      ) : (
        // ====================================================================
        // VUE COMMERCIAL — KPIs personnels (signatures, commissions, salaire,
        // pipeline pondéré perso).
        // ====================================================================
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Signatures du mois"
            value={`${data.signaturesMois.count}`}
            subtitle={formatCHF(data.signaturesMois.montant)}
          />
          <Kpi
            label="Commissions acquises"
            value={formatCHF(data.commissionsAcquisesMois)}
            subtitle="versées via ton salaire mensuel"
            tone="emerald"
          />
          <Kpi
            label="Salaire prévu"
            value={formatCHF(data.salairePrevuMois)}
            subtitle={
              data.garantieActiveMois ? "Garantie active" : "Performance pure"
            }
            tone={data.garantieActiveMois ? "amber" : "emerald"}
          />
          <Kpi
            label="Pipeline pondéré"
            value={formatCHF(
              data.topDeals.reduce((s, d) => s + d.montantPondere, 0),
            )}
            subtitle={`${data.topDeals.length} deals chauds`}
          />
        </div>
      )}

      {/* Contrats contre-signés par la commerciale → validation DÉFINITIVE
          (admin uniquement). C'est l'étape finale : Sophie a validé, tu valides. */}
      {user.role === "ADMIN" &&
        data.contratsAValiderDefinitif &&
        data.contratsAValiderDefinitif.length > 0 && (
          <Card className="mt-6 border-purple-300 bg-purple-50/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-purple-600 px-2 text-xs font-bold text-white">
                  {data.contratsAValiderDefinitif.length}
                </span>
                Contrats à valider définitivement
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-purple-200">
                {data.contratsAValiderDefinitif.map((c) => (
                  <li
                    key={c.contractId}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        <Link
                          href={`/contrats/${c.contractId}`}
                          className="hover:underline"
                        >
                          {c.numero} · {c.raisonSociale}
                        </Link>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Signé par {c.commercialeName}
                        {c.contreSigneLe
                          ? ` le ${formatDate(c.contreSigneLe)}`
                          : ""}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-purple-700">
                      {formatCHF(c.valeurAn1)}
                    </p>
                    <ValidateContractButton contractId={c.contractId} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

      {/* Contrats en attente de contre-signature ACLR (admin uniquement) */}
      {user.role === "ADMIN" &&
        data.contratsAValider &&
        data.contratsAValider.length > 0 && (
          <Card className="mt-6 border-emerald-300 bg-emerald-50/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-600 px-2 text-xs font-bold text-white">
                  {data.contratsAValider.length}
                </span>
                Contrats signés client — signature commerciale à faire
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-emerald-200">
                {data.contratsAValider.map((c) => (
                  <li
                    key={c.contractId}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        <Link
                          href={`/contrats/${c.contractId}`}
                          className="hover:underline"
                        >
                          {c.numero} · {c.raisonSociale}
                        </Link>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Signé par le client le{" "}
                        {c.dateSignatureClient
                          ? formatDate(c.dateSignatureClient)
                          : "—"}{" "}
                        · Commerciale : {c.commercialeName}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-emerald-700">
                      {formatCHF(c.valeurAn1)}
                    </p>
                    <SignAclrButton signatureId={c.signatureId} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

      <RdvAValiderBanner rdvs={rdvAValider.rdvs} today={todayZurich} />

      {/* Planning de production : tâches du jour + retards (alerte rouge au-delà
          d'un mois de retard, règle validée avec Arthur). */}
      {(planning.aujourdhui > 0 || planning.enRetard > 0) && (
        <Link
          href="/dossiers/planning?vue=jour"
          className={`mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-3 text-sm transition hover:shadow-md ${
            planning.critiques > 0
              ? "border-red-300 bg-red-50 text-red-900"
              : planning.enRetard > 0
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-border bg-card"
          }`}
        >
          <span className="flex items-center gap-2 font-semibold">
            <Icon name="CalendarRange" className="h-4 w-4" />
            Planning de production
          </span>
          <span>{planning.aujourdhui} tâche(s) aujourd&apos;hui</span>
          {planning.enRetard > 0 && <span>· {planning.enRetard} en retard</span>}
          {planning.critiques > 0 && (
            <span className="font-semibold">· {planning.critiques} avec plus d&apos;un mois de retard</span>
          )}
          <span className="ml-auto text-xs underline-offset-2 hover:underline">Voir mes tâches →</span>
        </Link>
      )}

      {/* ====================================================================
          PILOTAGE ÉQUIPE — activité par collaborateur (jour/semaine/mois)
          Admin uniquement : appels / RDV pris / RDV effectués / emails / sign.
      ==================================================================== */}
      {user.role === "ADMIN" && teamActivity && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                Activité de l&apos;équipe · {periodeActivite.label}
              </CardTitle>
              <div className="flex gap-2">
                {(
                  [
                    ["jour", "Aujourd'hui"],
                    ["semaine", "Cette semaine"],
                    ["mois", "Ce mois"],
                  ] as const
                ).map(([val, label]) => (
                  <Link
                    key={val}
                    href={`/?activite=${val}`}
                    className={buttonVariants({
                      variant:
                        periodeActivite.type === val ? "default" : "outline",
                      size: "sm",
                    })}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Collaborateur</th>
                    <th className="px-4 py-2 text-right">Appels</th>
                    <th className="px-4 py-2 text-right">RDV pris</th>
                    <th className="px-4 py-2 text-right">RDV effectués</th>
                    <th className="px-4 py-2 text-right">Emails</th>
                    <th className="px-4 py-2 text-right">Signatures</th>
                  </tr>
                </thead>
                <tbody>
                  {teamActivity.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        Aucun collaborateur actif.
                      </td>
                    </tr>
                  ) : (
                    teamActivity.map((r) => {
                      const isJour = periodeActivite.type === "jour";
                      const rdvAtteint =
                        isJour && r.objRdvJour > 0 && r.rdvPris >= r.objRdvJour;
                      return (
                        <tr
                          key={r.userId}
                          className="border-b border-border last:border-0 hover:bg-muted/20"
                        >
                          <td className="px-4 py-2 font-medium">
                            <Link
                              href={`/stats?user=${r.userId}`}
                              className="hover:underline"
                            >
                              {r.name}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {r.appels}
                            {isJour && r.objAppelsJour > 0 && (
                              <span className="text-muted-foreground">
                                {" "}
                                / {r.objAppelsJour}
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-semibold tabular-nums ${
                              rdvAtteint ? "text-emerald-700" : ""
                            }`}
                          >
                            {r.rdvPris}
                            {isJour && r.objRdvJour > 0 && (
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                / {r.objRdvJour}
                                {rdvAtteint ? " 🎉" : ""}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {r.rdvEffectues}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {r.emails}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {r.signatures}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {teamActivity.length > 1 && (
                  <tfoot className="border-t border-border bg-muted/20 font-semibold">
                    <tr>
                      <td className="px-4 py-2">Total équipe</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {teamActivity.reduce((s, r) => s + r.appels, 0)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {teamActivity.reduce((s, r) => s + r.rdvPris, 0)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {teamActivity.reduce((s, r) => s + r.rdvEffectues, 0)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {teamActivity.reduce((s, r) => s + r.emails, 0)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {teamActivity.reduce((s, r) => s + r.signatures, 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Évolution du CA — signatures (12 derniers mois)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CommissionsChart
            data={data.evolutionCASignatures}
            tooltipLabel="CA signé"
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Renouvellements (90 prochains jours)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.renouvellementsAVenir.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Aucun anniversaire de contrat dans les 90 prochains jours.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.renouvellementsAVenir.map((r) => (
                <li
                  key={r.contractId}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <Icon name="Repeat" className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/contrats/${r.contractId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {r.numero}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {r.raisonSociale}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs">{formatDate(r.dateAnniversaire)}</p>
                    <p className="text-[10px] text-emerald-700 tabular-nums">
                      + {formatCHFCompact(r.commissionMensuelle)} / mois
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
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
  tone?: "emerald" | "amber" | "primary";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "primary"
          ? "text-primary"
          : "";
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>
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
