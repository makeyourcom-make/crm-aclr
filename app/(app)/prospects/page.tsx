import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { ProspectFilters } from "@/components/prospects/prospect-filters";
import { ProspectsTable } from "@/components/prospects/prospects-table";
import { prisma } from "@/lib/db";
import {
  getProspects,
  getProspectStats,
} from "@/lib/queries/prospects";
import { ProspectListParamsSchema } from "@/lib/schemas/prospect";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Entreprises" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProspectsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;

  // Parse + valeurs par défaut. Ignore les params inconnus / mal formés.
  const params = ProspectListParamsSchema.parse(raw);

  const isAdmin = user.role === "ADMIN";

  // OPTIM : 4 queries en parallèle (prospects, stats, users admin, tags)
  const [
    { items, total, page, pageSize, totalPages },
    stats,
    teamUsers,
    tags,
  ] = await Promise.all([
    getProspects(user, params),
    getProspectStats(user),
    isAdmin
      ? prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    prisma.prospectTag.findMany({
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
    }),
  ]);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Entreprises"
        description={
          stats.nbSignes > 0
            ? `${stats.total} entreprise(s) au total — ${stats.nbSignes} client(s) signé(s) · ${stats.nbActifs} en cours de prospection.`
            : `${stats.total} entreprise(s) — ${stats.nbActifs} en cours de prospection.`
        }
        actions={
          <>
            {user.role === "ADMIN" && (
              <>
                <Link
                  href="/prospects/tags"
                  className={buttonVariants({ variant: "outline" })}
                >
                  <Icon name="Sparkles" className="mr-1.5 h-4 w-4" />
                  Gérer les tags
                </Link>
                <a
                  href={`/api/prospects/export?${new URLSearchParams(
                    Object.entries(params)
                      .filter(([, v]) => v !== undefined && v !== "" && v !== null)
                      .map(([k, v]) => [k, String(v)]),
                  ).toString()}`}
                  download
                  className={buttonVariants({ variant: "outline" })}
                >
                  <Icon name="FileSpreadsheet" className="mr-1.5 h-4 w-4" />
                  Export CSV
                </a>
                <Link
                  href="/prospects/import"
                  className={buttonVariants({ variant: "outline" })}
                >
                  <Icon name="FileSpreadsheet" className="mr-1.5 h-4 w-4" />
                  Importer CSV
                </Link>
              </>
            )}
            <Link
              href="/prospects/nouveau"
              className={buttonVariants({ variant: "default" })}
            >
              <Icon name="Users" className="mr-1.5 h-4 w-4" />
              Nouvelle entreprise
            </Link>
          </>
        }
      />

      <div className="mb-4">
        <ProspectFilters
          params={params}
          users={teamUsers}
          currentUserId={user.id}
          tags={tags}
        />
      </div>

      <ProspectsTable
        rows={items}
        teamUsers={teamUsers}
        showBulkActions={isAdmin}
      />

      <div className="mt-4">
        <Pagination
          current={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
        />
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        💡 Cette liste inclut tous les statuts (prospects + clients signés).
        Utilise le filtre <strong>Statut</strong> pour cibler une étape précise
        du funnel.
      </p>
    </div>
  );
}
