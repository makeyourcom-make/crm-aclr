import Link from "next/link";
import { notFound } from "next/navigation";

import { ImpersonateButton } from "@/components/collaborateurs/impersonate-button";
import { EmployeeDocuments } from "@/components/rh/employee-documents";
import { EmployeeForm } from "@/components/rh/employee-form";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { formatCHF } from "@/lib/format";
import { getEmployeeById } from "@/lib/queries/hr";
import { getRealSessionUser, requireAdmin } from "@/lib/session";

export const metadata = { title: "Fiche collaborateur" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeFichePage({ params }: PageProps) {
  await requireAdmin();
  const real = await getRealSessionUser();
  const { id } = await params;
  const employee = await getEmployeeById(id);
  if (!employee) notFound();

  // « Voir en tant que » : proposé pour tout collaborateur actif, sauf soi-même.
  const peutEndosser =
    employee.isActive && real != null && real.id !== employee.id;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title={employee.name}
        description={employee.email + " · " + employee.role}
        actions={
          peutEndosser ? (
            <ImpersonateButton
              userId={employee.id}
              userName={employee.name}
            />
          ) : undefined
        }
        breadcrumb={
          <Link
            href="/rh"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour aux collaborateurs
          </Link>
        }
      />

      {/* KPIs activité */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Prospects assignés
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {employee._count.prospectsAssignes}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Deals en cours
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {employee._count.dealsAssignes}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Contrats signés
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">
              {employee._count.contratsAssignes}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <EmployeeForm
            initial={{
              id: employee.id,
              name: employee.name,
              email: employee.email,
              role: employee.role,
              isActive: employee.isActive,
              telephone: employee.telephone,
              adresse: employee.adresse,
              iban: employee.iban,
              dateNaissance: employee.dateNaissance,
              numeroAVS: employee.numeroAVS,
              contactUrgenceNom: employee.contactUrgenceNom,
              contactUrgenceTel: employee.contactUrgenceTel,
              typeContrat: employee.typeContrat,
              dateEntree: employee.dateEntree,
              dateSortie: employee.dateSortie,
              pourcentageActivite: employee.pourcentageActivite,
              salaireBase:
                employee.salaireBase != null
                  ? Number(employee.salaireBase)
                  : null,
              garantieMensuelle: Number(employee.garantieMensuelle),
              forfaitFrais: Number(employee.forfaitFrais),
              tauxCommissionSignature: Number(
                employee.tauxCommissionSignature,
              ),
              tauxCommissionRenouvellement: Number(
                employee.tauxCommissionRenouvellement,
              ),
              notesRH: employee.notesRH,
            }}
          />
        </div>

        <div className="space-y-6">
          <EmployeeDocuments
            userId={employee.id}
            documents={employee.documentsRH.map((d) => ({
              id: d.id,
              type: d.type,
              titre: d.titre,
              fileUrl: d.fileUrl,
              fileSize: d.fileSize,
              createdAt: d.createdAt,
            }))}
          />
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        💡 Salaire = max(commissions du mois, garantie) + forfait frais. Pour
        un employé non-commercial, seul le salaire de base s&apos;applique.
        Salaire indicatif :{" "}
        <strong>
          {formatCHF(
            Math.max(
              Number(employee.salaireBase ?? 0),
              Number(employee.garantieMensuelle),
            ) + Number(employee.forfaitFrais),
          )}
        </strong>{" "}
        / mois (hors performance commerciale).
      </p>
    </div>
  );
}
