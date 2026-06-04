import Link from "next/link";
import { notFound } from "next/navigation";

import { EmailDetailView } from "@/components/emails/email-detail-view";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Email" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Vue d'un mail isolé — accessible depuis la timeline d'activités d'un prospect.
 * Affiche le contenu complet même si le mail est archivé.
 *
 * RLS : seul le propriétaire du mail (email.userId === user.id) peut le lire.
 */
export default async function EmailDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;

  const email = await prisma.email.findUnique({
    where: { id },
    include: {
      prospect: { select: { id: true, raisonSociale: true } },
      user: { select: { name: true } },
      attachments: {
        select: {
          id: true,
          nom: true,
          taille: true,
          mimeType: true,
          url: true,
        },
      },
    },
  });

  if (!email) notFound();

  // Mailbox privée : tu ne peux lire que tes propres mails
  if (email.userId !== user.id) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title={email.objet}
        description={
          email.direction === "ENTRANT"
            ? `De ${email.expediteurNom ?? email.expediteurEmail}`
            : `Envoyé à ${email.destinataireEmail}`
        }
        breadcrumb={
          <Link
            href={email.prospect ? `/prospects/${email.prospect.id}` : "/emails"}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            {email.prospect
              ? `Retour à ${email.prospect.raisonSociale}`
              : "Retour à la boîte"}
          </Link>
        }
      />

      {email.archive && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          📥 Cet email est <strong>archivé</strong> (retiré de la boîte de
          réception). Il reste consultable depuis la fiche client.
        </div>
      )}

      <EmailDetailView
        email={{
          id: email.id,
          direction: email.direction as "SORTANT" | "ENTRANT",
          expediteurEmail: email.expediteurEmail,
          expediteurNom: email.expediteurNom,
          destinataireEmail: email.destinataireEmail,
          objet: email.objet,
          contenuHtml: email.contenuHtml,
          contenuTexte: email.contenuTexte,
          statut: email.statut,
          envoyeLe: email.envoyeLe ? email.envoyeLe.toISOString() : null,
          createdAt: email.createdAt.toISOString(),
          archive: email.archive,
          prospect: email.prospect,
          user: email.user,
          attachments: email.attachments,
        }}
      />
    </div>
  );
}
