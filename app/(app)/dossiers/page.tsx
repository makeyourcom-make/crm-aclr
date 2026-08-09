import Link from "next/link";

import { CreateDossierDialog } from "@/components/dossiers/create-dossier-dialog";
import { DossiersBoard } from "@/components/dossiers/dossiers-board";
import { DossiersTabs } from "@/components/dossiers/dossiers-tabs";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { ARCHIVE_APRES_JOURS } from "@/lib/dossiers";
import { getDossiersBoard } from "@/lib/queries/dossiers";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Gestion des projets" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DossiersPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const raw = await searchParams;
  // Les tâches terminées depuis > 7 jours sortent du tableau ; ce paramètre les
  // ramène, pour qu'une tâche sans client rattaché ne devienne jamais
  // inaccessible (la fiche client, elle, montre toujours tout).
  const avecArchives = raw.archives === "1";

  const [board, users] = await Promise.all([
    getDossiersBoard(user, undefined, avecArchives),
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
        description={`${board.total} projet${board.total > 1 ? "s" : ""} en cours de suivi${
          avecArchives ? " (archives incluses)" : ""
        }`}
        actions={<CreateDossierDialog users={users} currentUserId={user.id} />}
      />

      <DossiersTabs />

      {(board.nbArchivees > 0 || avecArchives) && (
        <div className="mb-3">
          <Link
            href={avecArchives ? "/dossiers" : "/dossiers?archives=1"}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            <Icon name="Inbox" className="h-3.5 w-3.5" />
            {avecArchives
              ? "Masquer les projets archivés"
              : `Voir les ${board.nbArchivees} projet${board.nbArchivees > 1 ? "s" : ""} archivé${board.nbArchivees > 1 ? "s" : ""}`}
          </Link>
        </div>
      )}

      <DossiersBoard initialData={board} users={users} />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        💡 Glisse une carte d&apos;une colonne à l&apos;autre pour changer son
        avancement — ou la confier à quelqu&apos;un d&apos;autre. Clique une
        carte pour éditer le détail, ajouter un suivi ou la terminer. Une tâche
        terminée depuis plus de {ARCHIVE_APRES_JOURS} jours quitte le tableau et
        reste consultable depuis la fiche du client.
      </p>
    </div>
  );
}
