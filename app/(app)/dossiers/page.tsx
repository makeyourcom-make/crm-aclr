import { CreateDossierDialog } from "@/components/dossiers/create-dossier-dialog";
import { DossiersBoard } from "@/components/dossiers/dossiers-board";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { getDossiersBoard } from "@/lib/queries/dossiers";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Gestion des projets" };
export const dynamic = "force-dynamic";

export default async function DossiersPage() {
  const user = await requireUser();

  const [board, users] = await Promise.all([
    getDossiersBoard(user),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Gestion des projets"
        description={`${board.total} projet${board.total > 1 ? "s" : ""} en cours de suivi`}
        actions={
          <CreateDossierDialog users={users} currentUserId={user.id} />
        }
      />

      <DossiersBoard initialData={board} users={users} />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        💡 Glisse une carte d&apos;une colonne à l&apos;autre pour changer son
        avancement — ou la confier à quelqu&apos;un d&apos;autre. Clique une
        carte pour éditer le détail, ajouter un suivi ou la terminer.
      </p>
    </div>
  );
}
