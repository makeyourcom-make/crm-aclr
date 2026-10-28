import {
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  ChevronLeft,
  FileCheck,
  Handshake,
  Mail,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDayKey, formatInt } from "@/components/arena/format";
import { HeroPanel } from "@/components/arena/hero-panel";
import { moneyTargetText } from "@/components/arena/money-stat";
import { StreakPill } from "@/components/arena/pills";
import { PlayerAvatar, toneForRole } from "@/components/arena/player-avatar";
import { SectionCard } from "@/components/arena/section-card";
import { StatTile } from "@/components/arena/stat-tile";
import { ImpersonateButton } from "@/components/collaborateurs/impersonate-button";
import { EmployeeDocuments } from "@/components/rh/employee-documents";
import { EmployeeForm } from "@/components/rh/employee-form";
import { ResetPasswordButton } from "@/components/rh/reset-password-button";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { formatCHF, formatCHFCompact } from "@/lib/format";
import { getPlayerStats } from "@/lib/gamification";
import { initialsOf, type PlayerStats } from "@/lib/gamification/rules";
import { getEmployeeById } from "@/lib/queries/hr";
import { formatDateCH } from "@/lib/queries/objectifs-pace";
import { getRealSessionUser, requireAdmin } from "@/lib/session";

export const metadata = { title: "Fiche collaborateur" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  COMMERCIAL: "Commerciale",
};

async function safeStats(userId: string): Promise<PlayerStats | null> {
  try {
    return await getPlayerStats(userId);
  } catch (err) {
    console.error("[rh] getPlayerStats a échoué :", err);
    return null;
  }
}

export default async function EmployeeFichePage({ params }: PageProps) {
  await requireAdmin();
  const real = await getRealSessionUser();
  const { id } = await params;
  const employee = await getEmployeeById(id);
  if (!employee) notFound();

  // Emails archivés SOUS cette collaboratrice (trace des échanges, ex. recrutement).
  const [emailsArchives, stats] = await Promise.all([
    prisma.email.findMany({
      where: { collaborateurId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        direction: true,
        objet: true,
        expediteurNom: true,
        expediteurEmail: true,
        destinataireEmail: true,
        createdAt: true,
        envoyeLe: true,
        prospect: { select: { raisonSociale: true } },
      },
    }),
    employee.isActive ? safeStats(employee.id) : Promise.resolve(null),
  ]);

  // « Voir en tant que » : proposé pour tout collaborateur actif, sauf soi-même.
  const peutEndosser =
    employee.isActive && real != null && real.id !== employee.id;

  const salaireIndicatif =
    Math.max(Number(employee.salaireBase ?? 0), Number(employee.garantieMensuelle)) +
    Number(employee.forfaitFrais);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title={employee.name}
        description={`${employee.email} · ${ROLE_LABEL[employee.role] ?? employee.role}${employee.isActive ? "" : " · compte désactivé"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ResetPasswordButton
              userId={employee.id}
              userName={employee.name}
              hasRecoveryEmail={!!employee.emailRecuperation}
            />
            {peutEndosser && (
              <ImpersonateButton userId={employee.id} userName={employee.name} />
            )}
          </div>
        }
        breadcrumb={
          <Link
            href="/rh"
            className="inline-flex h-9 items-center gap-1 rounded-[10px] pr-2 text-[13px] font-bold text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Retour aux collaborateurs
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        {stats && (
          <HeroPanel aria-labelledby="fiche-resultats-titre">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex min-w-0 flex-[1_1_280px] items-center gap-4">
                <PlayerAvatar initials={initialsOf(employee.name)} tone={toneForRole(employee.role)} size="lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <h2 id="fiche-resultats-titre" className="text-xs font-bold tracking-[0.08em] text-navy-200 uppercase">
                    Résultats commerciaux
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <StreakPill days={stats.streak} variant="dark" size="md" />
                  </div>
                  <span className="text-xs font-semibold text-navy-200 tabular-nums">
                    Aujourd&apos;hui : {formatInt(stats.today.appels)} / {formatInt(stats.dailyTargets.appels)} appels ·{" "}
                    {formatInt(stats.today.rdvPris)} RDV pris · {formatInt(stats.today.propositions)} proposition
                    {stats.today.propositions > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <dl className="grid flex-[1_1_300px] grid-cols-2 gap-3 sm:grid-cols-3">
                <HeroStat
                  label="CA signé ce mois"
                  value={formatCHFCompact(stats.month.caSigne)}
                  sub={moneyTargetText(stats.month.caSigne, stats.monthTargets.caSigne) ?? "valeur totale des contrats"}
                />
                <HeroStat
                  label="Contrats signés"
                  value={formatInt(stats.month.contratsSignes)}
                  sub={
                    stats.monthTargets.contratsSignes != null
                      ? `ce mois · objectif ${formatInt(stats.monthTargets.contratsSignes)}`
                      : "ce mois"
                  }
                />
                <HeroStat
                  label="RDV pris ce mois"
                  value={formatInt(stats.month.rdvPris)}
                  sub={`${formatInt(stats.month.rdvEffectues)} effectué${stats.month.rdvEffectues > 1 ? "s" : ""} · ${formatInt(stats.month.appels)} appels`}
                />
                <HeroStat
                  label="Plus gros revenu mensuel"
                  value={stats.records.biggestContractMensuel > 0 ? formatCHF(stats.records.biggestContractMensuel) : "Aucun"}
                  sub="montant mensuel"
                />
                <HeroStat
                  label="Meilleure journée"
                  value={`${formatInt(stats.records.bestDayRdvPris)} RDV`}
                  sub={stats.records.bestDayRdvPrisDate ? `pris le ${formatDayKey(stats.records.bestDayRdvPrisDate)}` : "pas encore de RDV"}
                />
                <HeroStat
                  label="Plus longue série"
                  value={`${formatInt(stats.streakRecord)} j`}
                  sub={`objectif ${stats.dailyCallTarget} appels / jour`}
                />
              </dl>
            </div>
          </HeroPanel>
        )}

        {/* KPIs activité */}
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Prospects assignés" value={employee._count.prospectsAssignes} icon={Users} tone="blue" />
          <StatTile label="Deals en cours" value={employee._count.dealsAssignes} icon={Handshake} tone="violet" />
          <StatTile label="Contrats signés" value={employee._count.contratsAssignes} icon={FileCheck} tone="green" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <EmployeeForm
              initial={{
                id: employee.id,
                name: employee.name,
                email: employee.email,
                emailRecuperation: employee.emailRecuperation,
                role: employee.role,
                isActive: employee.isActive,
                telephone: employee.telephone,
                adresse: employee.adresse,
                iban: employee.iban,
                dateNaissance: employee.dateNaissance,
                numeroAVS: employee.numeroAVS,
                contactUrgenceNom: employee.contactUrgenceNom,
                contactUrgenceTel: employee.contactUrgenceTel,
                typeContrat: employee.typeContrat,
                dateEntree: employee.dateEntree,
                dateSortie: employee.dateSortie,
                pourcentageActivite: employee.pourcentageActivite,
                salaireBase:
                  employee.salaireBase != null
                    ? Number(employee.salaireBase)
                    : null,
                garantieMensuelle: Number(employee.garantieMensuelle),
                forfaitFrais: Number(employee.forfaitFrais),
                tauxCommissionSignature: Number(
                  employee.tauxCommissionSignature,
                ),
                tauxCommissionRenouvellement: Number(
                  employee.tauxCommissionRenouvellement,
                ),
                notesRH: employee.notesRH,
              }}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <EmployeeDocuments
              userId={employee.id}
              documents={employee.documentsRH.map((d) => ({
                id: d.id,
                type: d.type,
                titre: d.titre,
                fileUrl: d.fileUrl,
                fileSize: d.fileSize,
                createdAt: d.createdAt,
              }))}
            />

            <SectionCard
              title={`Échanges / emails${emailsArchives.length > 0 ? ` (${emailsArchives.length})` : ""}`}
              icon={Mail}
              tone="teal"
            >
              {emailsArchives.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  Aucun email archivé sous cette collaboratrice. Depuis la boîte
                  de réception, utilise « Attribuer à une collaboratrice » pour
                  garder la trace d&apos;un échange ici.
                </p>
              ) : (
                <ul className="-mx-2 flex flex-col gap-0.5">
                  {emailsArchives.map((e) => {
                    const tiers =
                      e.direction === "ENTRANT"
                        ? e.expediteurNom ?? e.expediteurEmail
                        : e.destinataireEmail;
                    const date = e.envoyeLe ?? e.createdAt;
                    const Dir = e.direction === "ENTRANT" ? ArrowDownLeft : ArrowUpRight;
                    return (
                      <li key={e.id}>
                        <Link
                          href={`/emails/${e.id}`}
                          className="group block rounded-[10px] px-2 py-2 hover:bg-ground"
                        >
                          <div className="flex items-center gap-1.5">
                            <Dir aria-hidden="true" className="size-3.5 shrink-0 text-mail-700" />
                            <span className="truncate text-[13px] font-bold text-foreground group-hover:underline">
                              {e.objet || "(sans objet)"}
                            </span>
                          </div>
                          <p className="truncate pl-5 text-xs text-muted-foreground">
                            {e.direction === "ENTRANT" ? "De " : "À "}
                            {tiers}
                            {" · "}
                            {formatDateCH(date)}
                            {e.prospect ? ` · ${e.prospect.raisonSociale}` : ""}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-[16px] border border-border bg-card p-4 text-[13px] text-muted-foreground">
          <Briefcase aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-subtle" />
          <p>
            Salaire = max(commissions du mois, garantie) + forfait frais. Pour
            un employé non-commercial, seul le salaire de base s&apos;applique.
            Salaire indicatif :{" "}
            <strong className="text-foreground">{formatCHF(salaireIndicatif)}</strong>{" "}
            / mois (hors performance commerciale).
          </p>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-white/12 bg-white/[0.08] px-3 py-2.5">
      <dt className="text-[11px] font-bold tracking-[0.06em] text-navy-200 uppercase">{label}</dt>
      <dd className="font-display text-xl font-extrabold break-words text-white tabular-nums">{value}</dd>
      <dd className="text-xs text-navy-200">{sub}</dd>
    </div>
  );
}
