import { ComposeEmailButton } from "@/components/emails/compose-email-button";
import { InboxView } from "@/components/emails/inbox-view";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Emails" };
export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const user = await requireUser();
  // Boîte privée par utilisateur : même l'admin ne voit pas les mails de l'équipe.
  // Si supervision croisée nécessaire un jour, ajouter un toggle explicite.
  const emails = await prisma.email.findMany({
    where: { userId: user.id },
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
    orderBy: { createdAt: "desc" },
    // 80 = compromis : couvre la vue active (les threads inactifs > 80 derniers
    // sont rarement consultés depuis l'inbox). Avec index userId+createdAt DESC,
    // requête sub-ms. Pour rechercher plus loin, la fiche prospect montre tout.
    take: 80,
  });

  const isDryRun = process.env.EMAIL_MODE !== "live";

  // Sérialise pour le composant client (Date → string)
  const serialized = emails.map((e) => ({
    id: e.id,
    direction: e.direction as "SORTANT" | "ENTRANT",
    threadId: e.threadId,
    expediteurEmail: e.expediteurEmail,
    expediteurNom: e.expediteurNom,
    destinataireEmail: e.destinataireEmail,
    objet: e.objet,
    contenuHtml: e.contenuHtml,
    contenuTexte: e.contenuTexte,
    statut: e.statut,
    envoyeLe: e.envoyeLe ? e.envoyeLe.toISOString() : null,
    createdAt: e.createdAt.toISOString(),
    lu: e.lu,
    prospect: e.prospect,
    user: e.user,
    attachments: e.attachments,
  }));

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Boîte de réception"
          description={`${emails.length} email(s) suivi(s) — envoyés et reçus via le CRM.`}
        />
        <ComposeEmailButton />
      </div>

      {isDryRun && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Mode dry-run</strong> — les emails sont enregistrés en base
          mais pas réellement envoyés. Active <code>EMAIL_MODE=live</code> +
          <code>RESEND_API_KEY</code> dans Vercel pour passer en vrai envoi.
        </div>
      )}

      <InboxView
        emails={serialized}
        isAdmin={user.role === "ADMIN"}
        currentUserEmail={user.email}
      />
    </div>
  );
}
