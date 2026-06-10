import Link from "next/link";

import { ProfileForm } from "@/components/parametres/profile-form";
import { SettingsForm } from "@/components/parametres/settings-form";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const user = await requireUser();
  const [setting, userFull] = await Promise.all([
    prisma.setting.findFirst(),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        email: true,
        iban: true,
        telephone: true,
        adresse: true,
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-6 lg:px-8">
      <PageHeader
        title="Paramètres"
        description={
          user.role === "ADMIN"
            ? "Profil personnel + coordonnées ACLR Sàrl + paramètres financiers par défaut."
            : "Mon profil personnel (nom, IBAN, coords)."
        }
      />

      {userFull && (
        <div className="mb-10">
          <ProfileForm user={userFull} />
        </div>
      )}

      <Link
        href="/parametres/signatures"
        className="mb-10 flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40"
      >
        <Icon name="Mail" className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Signatures email</p>
          <p className="text-xs text-muted-foreground">
            Crée et personnalise tes signatures, ajoutées automatiquement à
            tes emails.
          </p>
        </div>
        <Icon name="ChevronRight" className="h-4 w-4 text-muted-foreground" />
      </Link>

      {user.role === "ADMIN" && (
        <>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Paramètres ACLR Sàrl (admin)
          </h2>
          <SettingsForm setting={setting} />
        </>
      )}
    </div>
  );
}
