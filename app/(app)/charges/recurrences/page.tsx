import Link from "next/link";

import { RecurrenceForm } from "@/components/charges/recurrence-form";
import { GenerateRecurrenceButton } from "@/components/charges/generate-recurrence-button";
import { RecurrenceRowActions } from "@/components/charges/recurrence-row-actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { formatCHF, formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Charges récurrentes" };
export const dynamic = "force-dynamic";

const FREQ_LABEL: Record<string, string> = {
  MENSUEL: "Mensuel",
  BIMESTRIEL: "Bi-mensuel",
  TRIMESTRIEL: "Trimestriel",
  SEMESTRIEL: "Semestriel",
  ANNUEL: "Annuel",
};

const CATEGORIE_LABEL: Record<string, string> = {
  LOYER: "Loyer",
  SOFTWARE_SAAS: "Software",
  MARKETING: "Marketing",
  PUBLICITE: "Publicité",
  DEPLACEMENTS: "Déplacements",
  RESTAURATION: "Restauration",
  MATERIEL_BUREAU: "Matériel",
  ASSURANCES: "Assurances",
  TELECOM: "Télécom",
  FORMATION: "Formation",
  HONORAIRES: "Honoraires",
  IMPOTS: "Impôts",
  BANQUE_FRAIS: "Frais bancaires",
  AUTRE: "Autre",
};

export default async function RecurrencesPage() {
  await requireAdmin();
  const [recurrences, prospects] = await Promise.all([
    prisma.expenseRecurrence.findMany({
      orderBy: [{ actif: "desc" }, { label: "asc" }],
      include: {
        prospect: { select: { id: true, raisonSociale: true } },
        _count: { select: { expenses: true } },
      },
    }),
    prisma.prospect.findMany({
      select: { id: true, raisonSociale: true, statut: true },
      orderBy: [{ statut: "asc" }, { raisonSociale: "asc" }],
    }),
  ]);

  const actives = recurrences.filter((r) => r.actif);
  const totalMensualise = actives.reduce((s, r) => {
    const month =
      r.frequence === "MENSUEL"
        ? Number(r.montantEstime)
        : r.frequence === "BIMESTRIEL"
          ? Number(r.montantEstime) / 2
          : r.frequence === "TRIMESTRIEL"
            ? Number(r.montantEstime) / 3
            : r.frequence === "SEMESTRIEL"
              ? Number(r.montantEstime) / 6
              : Number(r.montantEstime) / 12;
    return s + month;
  }, 0);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Charges récurrentes"
        description="Templates qui génèrent automatiquement des charges en attente chaque mois. Utile pour les abonnements (Sunrise, Workspace, Lucas freelance...)."
        breadcrumb={
          <Link
            href="/charges"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour aux charges
          </Link>
        }
        actions={<GenerateRecurrenceButton />}
      />

      {/* KPIs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Récurrences actives
            </p>
            <p className="mt-1 text-2xl font-semibold text-primary tabular-nums">
              {actives.length}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              sur {recurrences.length} au total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Total mensualisé estimé
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCHF(totalMensualise)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Équivalent / mois (toutes fréquences confondues)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Charges générées
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {recurrences.reduce((s, r) => s + r._count.expenses, 0)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Toutes périodes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Nouveau template */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Nouvelle récurrence</CardTitle>
        </CardHeader>
        <CardContent>
          <RecurrenceForm prospects={prospects} />
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Libellé</th>
                <th className="px-3 py-2.5">Fréquence</th>
                <th className="px-3 py-2.5">Catégorie</th>
                <th className="px-3 py-2.5">Client</th>
                <th className="px-3 py-2.5 text-right">Montant estimé</th>
                <th className="px-3 py-2.5">Statut</th>
                <th className="px-3 py-2.5 text-right">Générées</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {recurrences.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-12 text-center text-muted-foreground"
                  >
                    Aucune récurrence définie.
                  </td>
                </tr>
              ) : (
                recurrences.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/30 ${!r.actif ? "opacity-50" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <p className="text-sm font-medium">{r.label}</p>
                      {r.fournisseur && (
                        <p className="text-[11px] text-muted-foreground">
                          {r.fournisseur}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {FREQ_LABEL[r.frequence] ?? r.frequence}
                      <div className="text-[10px] text-muted-foreground">
                        le {r.jourMois ?? 1} du mois
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="font-normal">
                        {CATEGORIE_LABEL[r.categorie] ?? r.categorie}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.prospect ? (
                        <Link
                          href={`/prospects/${r.prospect.id}`}
                          className="hover:text-primary"
                        >
                          {r.prospect.raisonSociale}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">interne</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatCHF(Number(r.montantEstime))}
                    </td>
                    <td className="px-3 py-2">
                      {r.actif ? (
                        <Badge variant="default" className="bg-emerald-100 text-emerald-800">
                          actif
                        </Badge>
                      ) : (
                        <Badge variant="outline">suspendu</Badge>
                      )}
                      {r.dateFin && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          fin {formatDate(r.dateFin)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">
                      {r._count.expenses}
                    </td>
                    <td className="px-3 py-2">
                      <RecurrenceRowActions id={r.id} actif={r.actif} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
