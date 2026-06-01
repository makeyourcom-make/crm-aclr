import Link from "next/link";
import { notFound } from "next/navigation";

import { ExpenseAllocationsPanel } from "@/components/charges/expense-allocations-panel";
import { ExpenseAttachmentsPanel } from "@/components/charges/expense-attachments-panel";
import { ExpenseEditForm } from "@/components/charges/expense-edit-form";
import { ExpenseDeleteButton } from "@/components/charges/expense-delete-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
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
  return { title: `Charge — ${label.slice(0, 40)}` };
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

  // Total alloué vs montant HT — indicateur de cohérence
  const totalAlloue = expense.allocations.reduce(
    (s, a) => s + Number(a.montantHT),
    0,
  );
  const reste = Number(expense.montantHT) - totalAlloue;

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 lg:px-8">
      <PageHeader
        title={
          expense.description ?? expense.fournisseur ?? "Charge"
        }
        description={`${formatDate(expense.date)} · ${formatCHF(Number(expense.montantTTC))} TTC`}
        breadcrumb={
          <Link
            href="/charges"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour aux charges
          </Link>
        }
        actions={<ExpenseDeleteButton id={expense.id} />}
      />

      {/* Méta info */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <StatutBadge statut={expense.statutPaiement} />
        {expense.dateReglement && (
          <span>réglé le {formatDate(expense.dateReglement)}</span>
        )}
        {expense.recurrence && (
          <Badge variant="outline">
            <Icon name="Repeat" className="mr-1 h-3 w-3" />
            généré par : {expense.recurrence.label}
          </Badge>
        )}
        {expense.createdBy && <span>· créé par {expense.createdBy.name}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form principal */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Détails de la charge</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

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

        {/* Sidebar : pièces jointes */}
        <div className="space-y-6">
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
    </div>
  );
}

function StatutBadge({ statut }: { statut: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    EN_ATTENTE: {
      label: "En attente",
      cls: "bg-amber-100 text-amber-800 border-amber-200",
    },
    PAYE: {
      label: "Payé",
      cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    LITIGE: {
      label: "Litige",
      cls: "bg-rose-100 text-rose-800 border-rose-200",
    },
    REMBOURSE: {
      label: "Remboursé",
      cls: "bg-blue-100 text-blue-800 border-blue-200",
    },
  };
  const c = config[statut] ?? config.EN_ATTENTE;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${c.cls}`}
    >
      {c.label}
    </span>
  );
}
