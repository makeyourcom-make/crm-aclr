import { CalendarClock, FileText, Plus, Repeat, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";

import { formatInt } from "@/components/arena/format";
import { Meter } from "@/components/arena/meter";
import { SectionCard } from "@/components/arena/section-card";
import { StatTile } from "@/components/arena/stat-tile";
import { ContractFilters } from "@/components/contrats/contract-filters";
import { ContractsTable } from "@/components/contrats/contracts-table";
import { ContractsWorkQueue } from "@/components/contrats/contracts-work-queue";
import { RoleFinanceHero } from "@/components/contrats/finance-hero-presets";
import { FinanceTabs } from "@/components/contrats/finance-tabs";
import { MyMonthCard, SignatureBoard } from "@/components/contrats/signature-board";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { prisma } from "@/lib/db";
import {
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
  const [{ items, total, page, pageSize, totalPages }, stats, teamUsers, pulse, queue, board] =
    await Promise.all([
      getContracts(user, params),
      getContractStats(user),
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
  const renewalsValue = queue.renewals.reduce((s, r) => s + r.valeurAn1, 0);
  const nextRenewal = queue.renewals[0];
  const caTarget = pulse.caTarget;

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

      <RoleFinanceHero pulse={pulse} />

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Valeur an 1 active"
          value={<Chf value={stats.valeurAn1Active} />}
          sub={`${formatInt(nbActifs)} contrat${nbActifs > 1 ? "s" : ""} actif${nbActifs > 1 ? "s" : ""} sur ${formatInt(stats.total)} au total`}
          icon={Wallet}
          tone="navy"
        />
        <StatTile
          label="CA récurrent annualisé"
          value={<Chf value={stats.mensuelActif * 12} />}
          sub={`MRR ${formatInt(stats.mensuelActif)} CHF x 12`}
          icon={Repeat}
          tone="violet"
        />
        <div className="flex min-w-0 flex-col gap-2.5 rounded-[16px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(14,25,54,0.04)]">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-win-50 text-win-700"
            >
              <TrendingUp className="size-[18px]" />
            </span>
            <span className="text-[13px] leading-tight font-bold text-muted-foreground">
              CA signé · {pulse.monthLabel}
            </span>
          </div>
          <div className="score-number text-[32px] break-words text-win-700 sm:text-[38px]">
            {formatInt(pulse.signedValue)}
            <span className="ml-1.5 text-base font-bold text-muted-foreground">
              {caTarget != null ? `/ ${formatInt(caTarget)}` : "CHF"}
            </span>
          </div>
          {caTarget != null && caTarget > 0 ? (
            <Meter
              value={pulse.signedValue}
              max={caTarget}
              tone="green"
              size="md"
              label="CA signé du mois"
              className="[&>div:first-child]:sr-only"
              hint={
                pulse.signedValue >= caTarget
                  ? "Objectif explosé : record du mois en vue"
                  : `Encore ${formatInt(caTarget - pulse.signedValue)} CHF pour l'objectif`
              }
            />
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">
              {formatInt(pulse.signedCount)} contrat{pulse.signedCount > 1 ? "s" : ""} signé
              {pulse.signedCount > 1 ? "s" : ""} · valeur an 1
            </span>
          )}
        </div>
        <StatTile
          label="Renouvellements à sécuriser"
          value={
            <>
              {formatInt(queue.renewals.length)}
              <span className="ml-1.5 text-base font-bold text-muted-foreground">dans 30 j</span>
            </>
          }
          sub={
            nextRenewal
              ? `${formatInt(renewalsValue)} CHF an 1 en jeu · le plus proche J-${Math.max(0, nextRenewal.days)}`
              : "Aucun renouvellement dans les 30 jours"
          }
          icon={CalendarClock}
          tone="gold"
        />
      </div>

      <div className="flex flex-wrap items-start gap-6">
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
