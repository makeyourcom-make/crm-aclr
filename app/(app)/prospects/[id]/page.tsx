import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { QuickLogActivity } from "@/components/activities/quick-log-activity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { ProspectStatutBadge } from "@/components/prospects/prospect-statut-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateLong, formatPhone } from "@/lib/format";
import {
  getProspectSecteurLabel,
  getProspectSourceLabel,
} from "@/lib/labels";
import { getProspectActivities } from "@/lib/queries/activities";
import { getProspectById } from "@/lib/queries/prospects";
import { requireUser } from "@/lib/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Prospect ${id.slice(0, 8)}…` };
}

export default async function ProspectDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;
  const [prospect, activities] = await Promise.all([
    getProspectById(user, id),
    getProspectActivities(id, user),
  ]);

  if (!prospect) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 lg:px-8">
      <PageHeader
        title={prospect.raisonSociale}
        description={[
          prospect.contactPrenom,
          prospect.contactNom,
          prospect.contactFonction && `· ${prospect.contactFonction}`,
        ]
          .filter(Boolean)
          .join(" ") || undefined}
        breadcrumb={
          <Link
            href="/prospects"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour aux prospects
          </Link>
        }
        actions={
          <>
            <Link
              href={`/prospects/${prospect.id}/modifier`}
              className={buttonVariants({ variant: "outline" })}
            >
              Modifier
            </Link>
          </>
        }
      />

      {/* Ligne en-tête */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ProspectStatutBadge statut={prospect.statut} />
        {prospect.secteur && (
          <span className="text-xs text-muted-foreground">
            · {getProspectSecteurLabel(prospect.secteur)}
          </span>
        )}
        {prospect.source && (
          <span className="text-xs text-muted-foreground">
            · Source : {getProspectSourceLabel(prospect.source)}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coordonnées */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Field label="Email">
              {prospect.email ? (
                <a
                  href={`mailto:${prospect.email}`}
                  className="text-primary hover:underline"
                >
                  {prospect.email}
                </a>
              ) : (
                "—"
              )}
            </Field>

            <Field label="Téléphone">
              {prospect.telephone ? (
                <a
                  href={`tel:${prospect.telephone.replace(/\s/g, "")}`}
                  className="text-primary hover:underline"
                >
                  {formatPhone(prospect.telephone)}
                </a>
              ) : (
                "—"
              )}
            </Field>

            <Field label="Mobile">
              {prospect.telephoneMobile ? (
                <a
                  href={`tel:${prospect.telephoneMobile.replace(/\s/g, "")}`}
                  className="text-primary hover:underline"
                >
                  {formatPhone(prospect.telephoneMobile)}
                </a>
              ) : (
                "—"
              )}
            </Field>

            <Field label="Site web">
              {prospect.siteWeb ? (
                <a
                  href={prospect.siteWeb}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {prospect.siteWeb}
                </a>
              ) : (
                "—"
              )}
            </Field>

            <Field label="LinkedIn">
              {prospect.linkedIn ? (
                <a
                  href={prospect.linkedIn}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {prospect.linkedIn}
                </a>
              ) : (
                "—"
              )}
            </Field>

            <Field label="Effectif">{prospect.effectif ?? "—"}</Field>

            <Field label="Adresse" className="sm:col-span-2">
              <div className="text-sm">
                {prospect.adresse && <div>{prospect.adresse}</div>}
                <div>
                  {[prospect.codePostal, prospect.ville]
                    .filter(Boolean)
                    .join(" ") || "—"}
                  {prospect.canton ? ` · ${prospect.canton}` : ""}
                  {prospect.pays ? ` · ${prospect.pays}` : ""}
                </div>
              </div>
            </Field>
          </CardContent>
        </Card>

        {/* Méta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Méta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Assigné à">
              {prospect.assigneA?.name ?? "—"}
            </Field>
            <Field label="Créé le">{formatDateLong(prospect.createdAt)}</Field>
            <Field label="Dernière modif.">
              {formatDateLong(prospect.updatedAt)}
            </Field>
            {prospect.noga && <Field label="Code NOGA">{prospect.noga}</Field>}
            <div className="border-t pt-3 text-xs text-muted-foreground">
              {prospect._count.activities} activités ·{" "}
              {prospect._count.deals} deals ·{" "}
              {prospect._count.contracts} contrats
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes générales */}
      {prospect.notesGenerales && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Notes générales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm">
              {prospect.notesGenerales}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Timeline d'activités */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">
            Activités
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({prospect._count.activities} total)
            </span>
          </CardTitle>
          <QuickLogActivity
            prospectId={prospect.id}
            prospectRaisonSociale={prospect.raisonSociale}
          />
        </CardHeader>
        <CardContent>
          <ActivityTimeline activities={activities} showUser={user.role === "ADMIN"} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-foreground">{children}</p>
    </div>
  );
}
