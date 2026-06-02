import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Templates emails" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  COLD_1: "Cold 1",
  COLD_2_RELANCE: "Cold 2",
  COLD_3_RELANCE: "Cold 3",
  POST_RDV: "Post-RDV",
  POST_PROPOSITION: "Proposition",
  RELANCE_PROPOSITION: "Relance prop.",
  RELANCE_FACTURE: "Relance facture",
  RENOUVELLEMENT: "Renouvellement",
  AUTRE: "Autre",
};

export default async function TemplatesEmailsPage() {
  await requireAdmin();
  const templates = await prisma.emailTemplate.findMany({
    orderBy: [{ isActive: "desc" }, { type: "asc" }, { nom: "asc" }],
  });

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Templates emails"
        description={`${templates.length} template(s). Les variables {{prenomContact}}, {{raisonSociale}}, {{ville}}, etc. seront remplacées au moment de l'envoi.`}
        actions={
          <Link
            href="/templates-emails/nouveau"
            className={buttonVariants({ variant: "default" })}
          >
            <Icon name="MailPlus" className="mr-1.5 h-4 w-4" />
            Nouveau template
          </Link>
        }
      />

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Icon
              name="MailPlus"
              className="mx-auto h-10 w-10 text-muted-foreground"
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun template encore. Crée le premier pour la prospection à
              froid.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/templates-emails/${t.id}/modifier`}
              className="block"
            >
              <Card
                className={`h-full transition-shadow hover:shadow-md ${!t.isActive ? "opacity-50" : ""}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="secondary" className="font-normal">
                      {TYPE_LABEL[t.type]}
                    </Badge>
                    {!t.isActive && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Inactif
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-medium text-foreground">{t.nom}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {t.objet}
                  </p>
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                    {t.contenu}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
