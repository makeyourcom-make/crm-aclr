import { CalendarCheck, PenLine, Repeat, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionCard } from "@/components/arena/section-card";
import { ExpenseAllocationsPanel } from "@/components/charges/expense-allocations-panel";
import { ExpenseAttachmentsPanel } from "@/components/charges/expense-attachments-panel";
import { ExpenseDeleteButton } from "@/components/charges/expense-delete-button";
import { ExpenseEditForm } from "@/components/charges/expense-edit-form";
import {
  CategoryChip,
  ExpenseStatutPill,
} from "@/components/charges/expense-statut-pill";
import { BackLink } from "@/components/common/back-link";
import { PageShell } from "@/components/common/page-shell";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { formatCHF, formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const exp = await prisma.expense.findUnique({
    where: { id },
    select: { description: true, fournisseur: true },
  });
  const label =
    exp?.description ?? exp?.fournisseur ?? "Charge";
  return { title: `Charge · ${label.slice(0, 40)}` };
}

export default async function ExpenseDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;

  const [expense, prospects] = await Promise.all([
    prisma.expense.findUnique({
      where: { id },
      include: {
        prospect: { select: { id: true, raisonSociale: true } },
        attachments: true,
        allocations: {
          include: { prospect: { select: { id: true, raisonSociale: true } } },
        },
        recurrence: { select: { id: true, label: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.prospect.findMany({
      select: { id: true, raisonSociale: true, statut: true },
      orderBy: [{ statut: "asc" }, { raisonSociale: "asc" }],
    }),
  ]);

  if (!expense) notFound();

  // Total alloué vs montant HT : indicateur de cohérence
  const totalAlloue = expense.allocations.reduce(
    (s, a) => s + Number(a.montantHT),
    0,
  );
  const reste = Number(expense.montantHT) - totalAlloue;

  return (
    <PageShell width="medium">
      <PageHeader
        rubrique="finance"
        title={
          expense.description ?? expense.fournisseur ?? "Charge"
        }
        description={`${formatDate(expense.date)} · ${formatCHF(Number(expense.montantTTC))} TTC`}
        breadcrumb={<BackLink href="/charges">Retour aux charges</BackLink>}
        actions={<ExpenseDeleteButton id={expense.id} />}
      />

      {/* Méta info */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
        <ExpenseStatutPill statut={expense.statutPaiement} />
        <CategoryChip categorie={expense.categorie} />
        {expense.dateReglement && (
          <span className="inline-flex items-center gap-1">
            <CalendarCheck aria-hidden="true" className="size-3.5" />
            réglé le {formatDate(expense.dateReglement)}
          </span>
        )}
        {expense.recurrence && (
          <Link
            href="/charges/recurrences"
            className="inline-flex h-6 items-center gap-1 rounded-full bg-lvl-50 px-2.5 font-bold text-lvl-700 hover:underline"
          >
            <Repeat aria-hidden="true" className="size-3" />
            généré par : {expense.recurrence.label}
          </Link>
        )}
        {expense.createdBy && (
          <span className="inline-flex items-center gap-1">
            <UserRound aria-hidden="true" className="size-3.5" />
            créé par {expense.createdBy.name}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulaire principal */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard
            title="Détails de la charge"
            description="Modifie puis sauvegarde"
            icon={PenLine}
            tone="navy"
          >
            <ExpenseEditForm
              expense={{
                id: expense.id,
                date: expense.date.toISOString().slice(0, 10),
                dateReglement: expense.dateReglement
                  ? expense.dateReglement.toISOString().slice(0, 10)
                  : "",
                statutPaiement: expense.statutPaiement,
                categorie: expense.categorie,
                fournisseur: expense.fournisseur ?? "",
                description: expense.description ?? "",
                reference: expense.reference ?? "",
                montantHT: Number(expense.montantHT),
                tauxTVA: Number(expense.tauxTVA),
                montantTVA: Number(expense.montantTVA),
                montantTTC: Number(expense.montantTTC),
                tvaRecuperable: expense.tvaRecuperable,
                methodPaiement: expense.methodPaiement ?? "CARTE_BANCAIRE",
                prospectId: expense.prospectId ?? "",
              }}
              prospects={prospects}
              disableProspectIfAllocated={expense.allocations.length > 0}
            />
          </SectionCard>

          {/* Allocations */}
          <ExpenseAllocationsPanel
            expenseId={expense.id}
            montantHT={Number(expense.montantHT)}
            prospects={prospects}
            initial={expense.allocations.map((a) => ({
              id: a.id,
              prospectId: a.prospectId,
              prospectName: a.prospect.raisonSociale,
              montantHT: Number(a.montantHT),
              note: a.note,
            }))}
            totalAlloue={totalAlloue}
            reste={reste}
            hasDirectProspect={!!expense.prospectId}
          />
        </div>

        {/* Colonne : pièces jointes */}
        <div className="min-w-0 space-y-6">
          <ExpenseAttachmentsPanel
            expenseId={expense.id}
            ticketUrl={expense.ticketUrl}
            ticketName={expense.ticketName}
            attachments={expense.attachments.map((a) => ({
              id: a.id,
              fileUrl: a.fileUrl,
              fileName: a.fileName,
              kind: a.kind,
              fileSize: a.fileSize,
            }))}
          />
        </div>
      </div>
    </PageShell>
  );
}
