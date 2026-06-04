import Link from "next/link";

import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { SocialProspectsTable } from "@/components/social/social-prospects-table";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Social — Prospects" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SocialProspectsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  const accountFilter =
    typeof raw.accountId === "string" ? raw.accountId : null;
  const statutFilter =
    typeof raw.statut === "string" ? raw.statut : null;

  // Stats agrégées par compte (admin voit tout, sinon ses comptes)
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

  const prospects = await prisma.socialProspect.findMany({
    where: {
      account: {
        ...(user.role !== "ADMIN" ? { responsableId: user.id } : {}),
      },
      ...(accountFilter ? { accountId: accountFilter } : {}),
      ...(statutFilter ? { statut: statutFilter as never } : {}),
    },
    include: {
      account: {
        select: {
          id: true,
          nom: true,
          reseau: true,
          responsable: { select: { name: true } },
        },
      },
    },
    orderBy: [{ dateDemarrage: "asc" }, { nom: "asc" }],
    take: 500,
  });

  // Compteurs par statut
  const totalByStatut = await prisma.socialProspect.groupBy({
    by: ["statut"],
    where: {
      account: {
        ...(user.role !== "ADMIN" ? { responsableId: user.id } : {}),
      },
    },
    _count: true,
  });
  const counts: Record<string, number> = {};
  for (const t of totalByStatut) counts[t.statut] = t._count;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Tous les prospects sociaux"
        description={`${prospects.length} prospects affichés · ${counts.EN_COURS ?? 0} en cours · ${counts.GAGNE ?? 0} gagnés · ${counts.PAS_REPONSE ?? 0} pas de réponse · ${counts.PERDU ?? 0} perdus.`}
        actions={
          <Link
            href="/social/import"
            className={buttonVariants({ variant: "default" })}
          >
            <Icon name="Plus" className="mr-1.5 h-4 w-4" />
            Charger un mois
          </Link>
        }
      />

      {/* Filtres simples via Links (Server Component compatible) */}
      <form className="mb-3 flex flex-wrap items-center gap-2" method="GET">
        <select
          name="accountId"
          defaultValue={accountFilter ?? ""}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
        >
          <option value="">Tous les comptes</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nom} · {a.reseau}
            </option>
          ))}
        </select>
        <select
          name="statut"
          defaultValue={statutFilter ?? ""}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="EN_COURS">En cours</option>
          <option value="PAS_REPONSE">Pas de réponse</option>
          <option value="GAGNE">Gagné</option>
          <option value="PERDU">Perdu</option>
        </select>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm hover:bg-muted"
        >
          Filtrer
        </button>
      </form>

      <SocialProspectsTable
        rows={prospects.map((p) => ({
          id: p.id,
          nom: p.nom,
          profilUrl: p.profilUrl,
          dateDemarrage: p.dateDemarrage.toISOString(),
          statut: p.statut,
          step0Done: !!p.step0Done,
          step2Done: !!p.step2Done,
          step4Done: !!p.step4Done,
          step6Done: !!p.step6Done,
          account: {
            id: p.account.id,
            nom: p.account.nom,
            reseau: p.account.reseau,
            responsable: p.account.responsable.name,
          },
        }))}
      />
    </div>
  );
}
