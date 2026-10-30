import {
  BadgeCheck,
  CalendarClock,
  Coins,
  FileText,
  Plus,
  Repeat,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { formatInt } from "@/components/arena/format";
import { SectionCard } from "@/components/arena/section-card";
import { StatTile } from "@/components/arena/stat-tile";
import { ContractFilters } from "@/components/contrats/contract-filters";
import { ContractsTable } from "@/components/contrats/contracts-table";
import { ContractsWorkQueue } from "@/components/contrats/contracts-work-queue";
import { FinanceTabs } from "@/components/contrats/finance-tabs";
import { MyMonthCard, SignatureBoard } from "@/components/contrats/signature-board";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { prisma } from "@/lib/db";
import {
  getContractCaStats,
  getContracts,
  getContractStats,
  getContractWorkQueue,
  getFinancePulse,
  getMonthlySignatureBoard,
} from "@/lib/queries/contracts";
import { ContractListParamsSchema } from "@/lib/schemas/contract";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Contrats" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function Chf({ value }: { value: number }) {
  return (
    <>
      {formatInt(value)}
      <span className="ml-1.5 text-base font-bold text-muted-foreground">CHF</span>
    </>
  );
}

export default async function ContractsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const params = ContractListParamsSchema.parse(raw);

  const isAdmin = user.role === "ADMIN";
  const [
    { items, total, page, pageSize, totalPages },
    stats,
    caStats,
    teamUsers,
    pulse,
    queue,
    board,
  ] = await Promise.all([
    getContracts(user, params),
    getContractStats(user),
    getContractCaStats(user),
    isAdmin
      ? prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    getFinancePulse(user),
    getContractWorkQueue(user),
    isAdmin ? getMonthlySignatureBoard() : Promise.resolve([]),
  ]);

  const nbActifs = stats.byStatut.ACTIF ?? 0;
  const nextRenewal = queue.renewals[0];
  const nbRenewals = queue.renewals.length;
  // Renouvellements cliquables : 1 seul → fiche du contrat ; plusieurs → la
  // file « À traiter » qui les liste tous (ancre #a-traiter).
  const renewalsHref =
    nbRenewals === 0
      ? undefined
      : nbRenewals === 1
        ? `/contrats/${nextRenewal.id}`
        : "#a-traiter";

  return (
    <div className="flex flex-col gap-6 [&>div:first-child]:mb-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="finance"
        title="Contrats"
        description={`Signatures, cash et renouvellements · ${pulse.dayLabel}`}
        actions={
          // Pour la commerciale, « Nouveau contrat » est déjà le CTA du héros.
          isAdmin ? (
            <Link
              href="/contrats/nouveau"
              className={buttonVariants({ variant: "default", size: "lg" })}
            >
              <Plus aria-hidden="true" />
              Nouveau contrat
            </Link>
          ) : undefined
        }
      />

      <FinanceTabs
        active="contrats"
        isAdmin={isAdmin}
        counts={{
          contrats: pulse.aValider,
          factures: pulse.invoices
            ? pulse.invoices.draftsCount + pulse.invoices.overdueCount
            : undefined,
          signatures: pulse.enAttenteSignature,
        }}
      />

      {/* Chiffres 100 % contrats (aucune info facture : voir l'onglet Factures). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Contrats"
          value={formatInt(stats.total)}
          sub={`dont ${formatInt(nbActifs)} actif${nbActifs > 1 ? "s" : ""}`}
          icon={FileText}
          tone="navy"
        />
        <StatTile
          label={`Contrats signés · ${pulse.monthLabel}`}
          value={formatInt(caStats.signedThisMonthCount)}
          sub={`${formatInt(caStats.caSignedThisMonth)} CHF de CA réel ce mois`}
          icon={BadgeCheck}
          tone="coral"
        />
        <StatTile
          label={`CA signé · ${pulse.monthLabel}`}
          value={<Chf value={caStats.caSignedThisMonth} />}
          sub="valeur réelle des contrats sur leur durée"
          icon={Coins}
          tone="green"
        />
        <StatTile
          label={`CA ${caStats.year}`}
          value={<Chf value={caStats.caYear} />}
          sub="signés sur leur terme + reconductions réalisées"
          icon={TrendingUp}
          tone="violet"
        />
        <StatTile
          label="Revenu mensuel récurrent (MRR)"
          value={
            <>
              <Chf value={stats.mensuelActif} />
              <span className="ml-1.5 text-base font-bold text-muted-foreground">/ mois</span>
            </>
          }
          sub="ce qui rentre automatiquement chaque mois"
          icon={Repeat}
          tone="gold"
        />
        <StatTile
          label="Renouvellements à sécuriser"
          value={
            <>
              {formatInt(nbRenewals)}
              <span className="ml-1.5 text-base font-bold text-muted-foreground">dans 30 j</span>
            </>
          }
          sub={
            nextRenewal
              ? `le plus proche J-${Math.max(0, nextRenewal.days)} · clique pour ${nbRenewals > 1 ? "les voir" : "l'ouvrir"}`
              : "Aucun renouvellement dans les 30 jours"
          }
          icon={CalendarClock}
          tone="navy"
          href={renewalsHref}
        />
      </div>

      <div id="a-traiter" className="flex scroll-mt-24 flex-wrap items-start gap-6">
        <ContractsWorkQueue
          queue={queue}
          isAdmin={isAdmin}
          userId={user.id}
          now={new Date().getTime()}
        />
        {isAdmin ? (
          <SignatureBoard entries={board} monthLabel={pulse.monthLabel} meId={user.id} />
        ) : (
          <MyMonthCard pulse={pulse} />
        )}
      </div>

      <SectionCard
        title="Tous les contrats"
        icon={FileText}
        tone="navy"
        description={`${formatInt(nbActifs)} contrat${nbActifs > 1 ? "s" : ""} actif${nbActifs > 1 ? "s" : ""} sur ${formatInt(stats.total)} au total · clique une ligne pour ouvrir la fiche`}
        contentClassName="flex flex-col gap-4"
      >
        <ContractFilters
          params={params}
          users={teamUsers}
          currentUserId={user.id}
          counts={stats.byStatut}
        />

        <ContractsTable rows={items} showCommerciale={isAdmin} />

        <Pagination
          current={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
        />
      </SectionCard>
    </div>
  );
}
