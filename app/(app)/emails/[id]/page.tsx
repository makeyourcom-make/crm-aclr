import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EmailDetailView } from "@/components/emails/email-detail-view";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Email" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Vue d'un mail isolé : accessible depuis la timeline d'activités d'un prospect.
 * Affiche le contenu complet même si le mail est archivé.
 *
 * RLS : le propriétaire du mail (email.userId === user.id) peut le lire ; l'admin
 * a une vue complète (y compris les mails d'un collaborateur parti).
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

  // Mailbox privée : le propriétaire lit ses propres mails. L'admin a une vue
  // complète (ex. mails d'un collaborateur parti, cf. Sophie). Cohérent avec la
  // route de téléchargement des pièces jointes.
  if (email.userId !== user.id && user.role !== "ADMIN") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        rubrique="emails"
        title={email.objet}
        description={
          email.direction === "ENTRANT"
            ? `De ${email.expediteurNom || email.expediteurEmail}`
            : `Envoyé à ${email.destinataireEmail}`
        }
        breadcrumb={
          <Link
            href={email.prospect ? `/prospects/${email.prospect.id}` : "/emails"}
            className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-bold text-muted-foreground transition-colors hover:bg-navy-50 hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {email.prospect
              ? `Retour à ${email.prospect.raisonSociale}`
              : "Retour à la boîte"}
          </Link>
        }
      />

      {email.archive && (
        <div className="mb-4 rounded-[14px] bg-gold-50 px-4 py-3 text-[13px] font-semibold text-gold-700">
          Cet email est <strong className="font-extrabold">archivé</strong> (retiré de
          la boîte de réception). Il reste consultable depuis la fiche client et le
          dossier Archivés.
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
          resendInboundId: email.resendInboundId,
          prospect: email.prospect,
          user: email.user,
          attachments: email.attachments,
        }}
      />
    </div>
  );
}
