import Link from "next/link";

import { ObjectiveForm } from "@/components/objectifs/objective-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { formatCHF, formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Objectifs" };
export const dynamic = "force-dynamic";

const PERIODE_LABEL: Record<string, string> = {
  HEBDOMADAIRE: "Semaine",
  MENSUEL: "Mois",
  TRIMESTRIEL: "Trimestre",
  ANNUEL: "Année",
};

export default async function ObjectifsPage() {
  const user = await requireAdmin();

  const [objectives, users] = await Promise.all([
    prisma.objective.findMany({
      where: user.role === "ADMIN" ? {} : { userId: user.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ isActif: "desc" }, { dateFin: "desc" }],
    }),
    user.role === "ADMIN"
      ? prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([{ id: user.id, name: user.name }]),
  ]);

  return (
    <div className="px-6 py-6 lg:px-8">
      <PageHeader
        title="Objectifs"
        description="Définir et suivre les cibles commerciales par période."
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Objectifs en cours
        </h2>
        {objectives.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucun objectif défini. Crée-en un ci-dessous.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {objectives.map((o) => (
              <Card key={o.id}>
                <CardContent className="py-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="font-normal">
                      {PERIODE_LABEL[o.periode]}
                    </Badge>
                    {user.role === "ADMIN" && (
                      <span className="text-xs text-muted-foreground">
                        {o.user.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(o.dateDebut)} → {formatDate(o.dateFin)}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm">
                    {o.nbAppelsObjectif != null && (
                      <li>📞 {o.nbAppelsObjectif} appels</li>
                    )}
                    {o.nbEmailsObjectif != null && (
                      <li>✉️ {o.nbEmailsObjectif} emails</li>
                    )}
                    {o.nbRdvObjectif != null && (
                      <li>📅 {o.nbRdvObjectif} RDV</li>
                    )}
                    {o.nbSignaturesObjectif != null && (
                      <li>✍️ {o.nbSignaturesObjectif} signatures</li>
                    )}
                    {o.caObjectif != null && (
                      <li className="font-semibold">
                        💰 {formatCHF(Number(o.caObjectif))} CA
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Créer un objectif</CardTitle>
          </CardHeader>
          <CardContent>
            <ObjectiveForm users={users} defaultUserId={user.id} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
