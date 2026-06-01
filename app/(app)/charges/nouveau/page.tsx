import Link from "next/link";

import { ExpenseForm } from "@/components/charges/expense-form";
import { Icon } from "@/components/icon";
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
    <div className="mx-auto max-w-3xl px-6 py-6 lg:px-8">
      <PageHeader
        title="Nouvelle charge"
        description="Charge un ticket en photo et laisse l'IA pré-remplir les champs, ou saisis tout à la main."
        breadcrumb={
          <Link
            href="/charges"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour aux charges
          </Link>
        }
      />
      <ExpenseForm prospects={prospects} />
    </div>
  );
}
