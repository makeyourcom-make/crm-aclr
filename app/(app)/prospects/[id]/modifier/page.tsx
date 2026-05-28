import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { ProspectForm } from "@/components/prospects/prospect-form";
import { prisma } from "@/lib/db";
import {
  ProspectCreateSchema,
  type ProspectCreateInput,
} from "@/lib/schemas/prospect";
import { requireUser, scopedWhere } from "@/lib/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Modifier le prospect" };

export default async function EditProspectPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;

  // Lookup avec scoping (un commercial ne peut pas éditer un prospect non-assigné)
  const prospect = await prisma.prospect.findFirst({
    where: { id, ...scopedWhere(user, {}) },
  });
  if (!prospect) notFound();

  // Pré-remplit le formulaire avec les valeurs actuelles
  const initialValues: Partial<ProspectCreateInput> = {
    raisonSociale: prospect.raisonSociale,
    contactNom: prospect.contactNom ?? undefined,
    contactPrenom: prospect.contactPrenom ?? undefined,
    contactFonction: prospect.contactFonction ?? undefined,
    email: prospect.email ?? undefined,
    telephone: prospect.telephone ?? undefined,
    telephoneMobile: prospect.telephoneMobile ?? undefined,
    adresse: prospect.adresse ?? undefined,
    codePostal: prospect.codePostal ?? undefined,
    ville: prospect.ville ?? undefined,
    canton: prospect.canton ?? undefined,
    pays: prospect.pays,
    siteWeb: prospect.siteWeb ?? undefined,
    linkedIn: prospect.linkedIn ?? undefined,
    facebook: prospect.facebook ?? undefined,
    instagram: prospect.instagram ?? undefined,
    secteur: prospect.secteur ?? undefined,
    effectif: prospect.effectif ?? undefined,
    noga: prospect.noga ?? undefined,
    source: prospect.source ?? undefined,
    statut: prospect.statut,
    assigneAId: prospect.assigneAId ?? undefined,
    notesGenerales: prospect.notesGenerales ?? undefined,
  };

  // Action serveur dédiée à cet ID (closure)
  async function action(input: unknown) {
    "use server";

    const parsed = ProspectCreateSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      return {
        ok: false,
        error: "Formulaire invalide — voir les champs en rouge.",
        fieldErrors,
      };
    }

    const u = await requireUser();
    // Re-vérifier l'accès (le client peut avoir bidouillé l'URL)
    const exists = await prisma.prospect.findFirst({
      where: { id, ...scopedWhere(u, {}) },
      select: { id: true },
    });
    if (!exists) {
      return { ok: false, error: "Prospect introuvable ou inaccessible." };
    }

    try {
      await prisma.prospect.update({
        where: { id },
        data: parsed.data,
      });
    } catch (err) {
      console.error("[update prospect]", err);
      return { ok: false, error: "Erreur lors de la sauvegarde." };
    }

    redirect(`/prospects/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 lg:px-8">
      <PageHeader
        title={`Modifier · ${prospect.raisonSociale}`}
        breadcrumb={
          <Link
            href={`/prospects/${id}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Icon name="ChevronRight" className="h-3 w-3 rotate-180" />
            Retour à la fiche
          </Link>
        }
      />
      <ProspectForm
        initialValues={initialValues}
        action={action}
        submitLabel="Enregistrer les modifications"
      />
    </div>
  );
}
