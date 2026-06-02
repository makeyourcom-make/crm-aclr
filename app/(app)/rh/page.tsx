import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { formatCHF, formatDate } from "@/lib/format";
import { listEmployees } from "@/lib/queries/hr";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Collaborateurs" };
export const dynamic = "force-dynamic";

const CONTRAT_LABEL: Record<string, string> = {
  CDI: "CDI",
  CDD: "CDD",
  MANDAT: "Mandat",
  STAGE: "Stage",
  ESSAI: "Essai",
};

const CONTRAT_COLOR: Record<string, string> = {
  CDI: "bg-emerald-100 text-emerald-700",
  CDD: "bg-amber-100 text-amber-700",
  MANDAT: "bg-blue-100 text-blue-700",
  STAGE: "bg-purple-100 text-purple-700",
  ESSAI: "bg-slate-100 text-slate-700",
};

export default async function RhPage() {
  await requireAdmin();
  const employees = await listEmployees();

  const actifs = employees.filter((e) => e.isActive);
  const inactifs = employees.filter((e) => !e.isActive);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Collaborateurs"
        description={`${actifs.length} collaborateur(s) actif(s)${inactifs.length > 0 ? ` · ${inactifs.length} sorti(s)` : ""}.`}
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {employees.map((e) => (
          <Link
            key={e.id}
            href={`/rh/${e.id}`}
            className="block"
          >
            <Card
              className={
                e.isActive
                  ? "hover:border-primary hover:shadow-md transition"
                  : "opacity-60 hover:opacity-100 hover:border-primary transition"
              }
            >
              <CardContent className="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold">
                      {e.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.email}
                    </p>
                  </div>
                  {e.typeContrat && (
                    <Badge
                      variant="secondary"
                      className={`font-normal ${CONTRAT_COLOR[e.typeContrat] ?? ""}`}
                    >
                      {CONTRAT_LABEL[e.typeContrat] ?? e.typeContrat}
                    </Badge>
                  )}
                  {!e.isActive && (
                    <Badge variant="secondary" className="font-normal">
                      Sorti
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Cell label="Rôle" value={e.role} />
                  <Cell
                    label="Activité"
                    value={`${e.pourcentageActivite ?? 100} %`}
                  />
                  {e.dateEntree && (
                    <Cell
                      label="Entrée"
                      value={formatDate(e.dateEntree)}
                    />
                  )}
                  {e.dateSortie && (
                    <Cell label="Sortie" value={formatDate(e.dateSortie)} />
                  )}
                  {e.salaireBase != null && Number(e.salaireBase) > 0 && (
                    <Cell
                      label="Salaire base"
                      value={`${formatCHF(Number(e.salaireBase))} / mois`}
                    />
                  )}
                  {e.role === "COMMERCIAL" && (
                    <Cell
                      label="Garantie"
                      value={formatCHF(Number(e.garantieMensuelle))}
                    />
                  )}
                </div>

                <div className="mt-3 flex items-center gap-3 border-t pt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Icon name="FileText" className="h-3 w-3" />
                    {e._count.documentsRH} doc(s)
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-primary">
                    Voir la fiche
                    <Icon name="ChevronRight" className="h-3 w-3" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        💡 Pour ajouter un nouveau collaborateur, va dans Configuration →
        Utilisateurs. Cette page sert à gérer leur dossier RH une fois créés.
      </p>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
