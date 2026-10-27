import { ExpenseForm } from "@/components/charges/expense-form";
import { BackLink } from "@/components/common/back-link";
import { PageShell } from "@/components/common/page-shell";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Nouvelle charge" };
export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  await requireAdmin();
  // Tous les prospects rattachables : signés (clients actuels) en priorité,
  // puis tous les autres (au cas où la charge concerne un prospect en cours).
  const prospects = await prisma.prospect.findMany({
    select: { id: true, raisonSociale: true, statut: true },
    orderBy: [{ statut: "asc" }, { raisonSociale: "asc" }],
  });
  return (
    <PageShell width="narrow">
      <PageHeader
        rubrique="finance"
        title="Nouvelle charge"
        description="Charge un ticket en photo et laisse l'IA pré-remplir les champs, ou saisis tout à la main."
        breadcrumb={<BackLink href="/charges">Retour aux charges</BackLink>}
      />
      <ExpenseForm prospects={prospects} />
    </PageShell>
  );
}
