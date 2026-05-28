import { ProfileForm } from "@/components/parametres/profile-form";
import { SettingsForm } from "@/components/parametres/settings-form";
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
