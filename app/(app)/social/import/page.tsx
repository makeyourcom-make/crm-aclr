import { redirect } from "next/navigation";

import { SocialImportForm } from "@/components/social/social-import-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Social — Charger un mois" };
export const dynamic = "force-dynamic";

export default async function SocialImportPage() {
  const user = await requireUser();

  // Comptes accessibles
  const accounts = await prisma.socialAccount.findMany({
    where: {
      actif: true,
      ...(user.role !== "ADMIN" ? { responsableId: user.id } : {}),
    },
    select: {
      id: true,
      nom: true,
      reseau: true,
      responsable: { select: { name: true } },
    },
    orderBy: [{ reseau: "asc" }, { nom: "asc" }],
  });

  if (accounts.length === 0) {
    redirect("/social/aujourdhui");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Charger un mois de prospection"
        description="Pour le compte choisi, importe ta liste de prospects. Ils seront distribués automatiquement sur les jours ouvrables du mois (10/jour)."
      />
      <SocialImportForm accounts={accounts} />
    </div>
  );
}
