import { CalendarClock, ListChecks, PlusCircle, Repeat, Sigma } from "lucide-react";
import Link from "next/link";

import { EmptyState, SectionCard, StatTile, StatusPill } from "@/components/arena";
import { CategoryChip } from "@/components/charges/expense-statut-pill";
import { GenerateRecurrenceButton } from "@/components/charges/generate-recurrence-button";
import { FREQ_LABEL } from "@/components/charges/labels";
import { RecurrenceForm } from "@/components/charges/recurrence-form";
import { RecurrenceRowActions } from "@/components/charges/recurrence-row-actions";
import {
  TABLE_CLASS,
  THEAD_CLASS,
  TR_CLASS,
  TableEmptyRow,
  TableScroll,
  Td,
  Th,
} from "@/components/common/arena-table";
import { BackLink } from "@/components/common/back-link";
import { ChfValue } from "@/components/common/chf-value";
import { PageShell } from "@/components/common/page-shell";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { formatCHF, formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Charges récurrentes" };
export const dynamic = "force-dynamic";

export default async function RecurrencesPage() {
  await requireAdmin();
  const [recurrences, prospects] = await Promise.all([
    prisma.expenseRecurrence.findMany({
      orderBy: [{ actif: "desc" }, { label: "asc" }],
      include: {
        prospect: { select: { id: true, raisonSociale: true } },
        _count: { select: { expenses: true } },
      },
    }),
    prisma.prospect.findMany({
      select: { id: true, raisonSociale: true, statut: true },
      orderBy: [{ statut: "asc" }, { raisonSociale: "asc" }],
    }),
  ]);

  const actives = recurrences.filter((r) => r.actif);
  const totalMensualise = actives.reduce((s, r) => {
    const month =
      r.frequence === "MENSUEL"
        ? Number(r.montantEstime)
        : r.frequence === "BIMESTRIEL"
          ? Number(r.montantEstime) / 2
          : r.frequence === "TRIMESTRIEL"
            ? Number(r.montantEstime) / 3
            : r.frequence === "SEMESTRIEL"
              ? Number(r.montantEstime) / 6
              : Number(r.montantEstime) / 12;
    return s + month;
  }, 0);

  return (
    <PageShell>
      <PageHeader
        rubrique="finance"
        title="Charges récurrentes"
        description="Modèles qui génèrent automatiquement des charges en attente chaque mois. Utile pour les abonnements (Sunrise, Workspace, Lucas freelance...)."
        breadcrumb={<BackLink href="/charges">Retour aux charges</BackLink>}
        actions={<GenerateRecurrenceButton />}
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Récurrences actives"
          value={actives.length}
          sub={`sur ${recurrences.length} au total`}
          tone="violet"
          icon={Repeat}
        />
        <StatTile
          label="Total mensualisé estimé"
          value={<ChfValue amount={totalMensualise} />}
          sub="Équivalent / mois (toutes fréquences)"
          tone="red"
          icon={Sigma}
        />
        <StatTile
          label="Charges générées"
          value={recurrences.reduce((s, r) => s + r._count.expenses, 0)}
          sub="Toutes périodes"
          tone="navy"
          icon={ListChecks}
        />
      </div>

      {/* Nouveau modèle */}
      <SectionCard
        className="mb-6"
        title="Nouvelle récurrence"
        description="Un abonnement = un modèle, généré chaque période"
        icon={PlusCircle}
        tone="green"
      >
        <RecurrenceForm prospects={prospects} />
      </SectionCard>

      {/* Liste */}
      <SectionCard
        className="overflow-hidden"
        title="Modèles récurrents"
        description={`${recurrences.length} modèle(s)`}
        icon={CalendarClock}
        tone="navy"
        contentClassName="-mx-5 -mb-5 sm:-mx-6 sm:-mb-6"
      >
        <TableScroll label="Liste des charges récurrentes">
          <table className={TABLE_CLASS}>
            <thead className={THEAD_CLASS}>
              <tr>
                <Th className="pl-5 sm:pl-6">Libellé</Th>
                <Th>Fréquence</Th>
                <Th>Catégorie</Th>
                <Th>Client</Th>
                <Th className="text-right">Montant estimé</Th>
                <Th>Statut</Th>
                <Th className="text-right">Générées</Th>
                <Th className="pr-5 text-right sm:pr-6">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {recurrences.length === 0 ? (
                <TableEmptyRow colSpan={8}>
                  <EmptyState
                    icon={Repeat}
                    tone="violet"
                    title="Aucune récurrence définie"
                    description="Crée ton premier modèle ci-dessus : les charges seront générées chaque période."
                  />
                </TableEmptyRow>
              ) : (
                recurrences.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(TR_CLASS, !r.actif && "bg-ground/60 text-muted-foreground")}
                  >
                    <Td className="min-w-[180px] pl-5 sm:pl-6">
                      <p className="text-[13px] font-bold text-foreground">{r.label}</p>
                      {r.fournisseur && (
                        <p className="text-xs text-muted-foreground">
                          {r.fournisseur}
                        </p>
                      )}
                    </Td>
                    <Td className="text-xs whitespace-nowrap">
                      <span className="font-semibold">
                        {FREQ_LABEL[r.frequence] ?? r.frequence}
                      </span>
                      <div className="text-[11px] text-muted-foreground">
                        le {r.jourMois ?? 1} du mois
                      </div>
                    </Td>
                    <Td>
                      <CategoryChip categorie={r.categorie} />
                    </Td>
                    <Td className="text-xs">
                      {r.prospect ? (
                        <Link
                          href={`/prospects/${r.prospect.id}`}
                          className="font-bold text-info-700 hover:underline"
                        >
                          {r.prospect.raisonSociale}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">interne</span>
                      )}
                    </Td>
                    <Td className="text-right font-extrabold whitespace-nowrap text-foreground tabular-nums">
                      {formatCHF(Number(r.montantEstime))}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {r.actif ? (
                        <StatusPill tone="green">Actif</StatusPill>
                      ) : (
                        <StatusPill tone="navy">Suspendu</StatusPill>
                      )}
                      {r.dateFin && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          fin {formatDate(r.dateFin)}
                        </div>
                      )}
                    </Td>
                    <Td className="text-right text-xs font-semibold tabular-nums">
                      {r._count.expenses}
                    </Td>
                    <Td className="pr-5 sm:pr-6">
                      <RecurrenceRowActions id={r.id} actif={r.actif} label={r.label} />
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScroll>
      </SectionCard>
    </PageShell>
  );
}
