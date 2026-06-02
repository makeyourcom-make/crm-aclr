import Link from "next/link";

import { EmailPreviewButton } from "@/components/emails/email-preview-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Emails" };
export const dynamic = "force-dynamic";

const STATUT_BADGE: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-600",
  ENVOYE: "bg-blue-100 text-blue-700",
  LIVRE: "bg-blue-200 text-blue-800",
  OUVERT: "bg-emerald-100 text-emerald-700",
  CLIQUE: "bg-emerald-200 text-emerald-800",
  REPONDU: "bg-purple-100 text-purple-700",
  REBOND: "bg-red-100 text-red-700",
  ERREUR: "bg-red-100 text-red-700",
};
const STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoyé",
  LIVRE: "Livré",
  OUVERT: "Ouvert",
  CLIQUE: "Cliqué",
  REPONDU: "Répondu",
  REBOND: "Rebond",
  ERREUR: "Erreur",
};

export default async function EmailsPage() {
  const user = await requireUser();
  const emails = await prisma.email.findMany({
    where: user.role === "ADMIN" ? {} : { userId: user.id },
    include: {
      prospect: { select: { id: true, raisonSociale: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const isDryRun = process.env.EMAIL_MODE !== "live";

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Emails"
        description={`Boîte unifiée — tous les emails envoyés via le CRM. ${emails.length} email(s) suivi(s).`}
      />

      {isDryRun && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Mode dry-run</strong> — les emails sont enregistrés en
          base et loggés en console serveur, mais{" "}
          <strong>pas réellement envoyés</strong>. Pour activer l&apos;envoi
          réel via Resend, mets <code>EMAIL_MODE=live</code> dans{" "}
          <code>.env</code> et fournis <code>RESEND_API_KEY</code> +
          domaine vérifié.
        </div>
      )}

      {emails.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Icon
              name="Mail"
              className="mx-auto h-10 w-10 text-muted-foreground"
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun email envoyé pour l&apos;instant. Va sur la fiche
              d&apos;un prospect pour en composer un.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {emails.map((e) => (
                <li key={e.id} className="px-3 py-3 hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon
                          name={
                            e.direction === "SORTANT" ? "MailPlus" : "MailOpen"
                          }
                          className="h-3.5 w-3.5 text-muted-foreground"
                        />
                        <span className="text-xs text-muted-foreground">
                          {e.direction === "SORTANT" ? "→" : "←"} {e.destinataireEmail}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`font-normal ${STATUT_BADGE[e.statut]}`}
                        >
                          {STATUT_LABEL[e.statut]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-medium">{e.objet}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {e.contenuTexte}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {e.prospect && (
                          <Link
                            href={`/prospects/${e.prospect.id}`}
                            className="hover:underline"
                          >
                            {e.prospect.raisonSociale}
                          </Link>
                        )}
                        {" · "}
                        {formatRelative(e.createdAt)}
                        {user.role === "ADMIN" && ` · ${e.user.name}`}
                      </p>
                    </div>
                    <div className="shrink-0 pt-0.5">
                      <EmailPreviewButton
                        email={{
                          objet: e.objet,
                          expediteurEmail: e.expediteurEmail,
                          expediteurNom: e.expediteurNom,
                          destinataireEmail: e.destinataireEmail,
                          cc: e.cc,
                          bcc: e.bcc,
                          contenuHtml: e.contenuHtml,
                          contenuTexte: e.contenuTexte,
                          direction: e.direction,
                          statut: e.statut,
                          statutLabel: STATUT_LABEL[e.statut] ?? e.statut,
                          statutClass: STATUT_BADGE[e.statut] ?? "",
                          envoyeLe: e.envoyeLe,
                          createdAt: e.createdAt,
                          prospectNom: e.prospect?.raisonSociale ?? null,
                          userNom: e.user.name,
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
