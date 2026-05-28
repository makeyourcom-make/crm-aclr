import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { logoutAction } from "@/lib/auth-actions";
import { getRoleLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

/**
 * Page d'accueil temporaire (étape 1 → 3).
 *
 * Protégée par le middleware : redirige vers /login si non connecté.
 * Sera remplacée par le vrai dashboard à l'étape 16.
 */
export default async function HomePage() {
  // Garde-fou serveur (le middleware a déjà filtré, mais ceinture + bretelles)
  const user = await requireUser();

  let dbStatus: { ok: boolean; message: string } = {
    ok: false,
    message: "",
  };

  try {
    const userCount = await prisma.user.count();
    const prospectCount = await prisma.prospect.count();
    const contractCount = await prisma.contract.count();
    dbStatus = {
      ok: true,
      message: `${userCount} utilisateur·s, ${prospectCount} prospect·s, ${contractCount} contrat·s`,
    };
  } catch (err) {
    dbStatus = {
      ok: false,
      message:
        err instanceof Error ? err.message : "Erreur de connexion inconnue.",
    };
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {/* En-tête + déconnexion */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-md"
            style={{ backgroundColor: "#1F4E78" }}
            aria-hidden
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              CRM — Make Your Com
            </h1>
            <p className="text-sm text-slate-500">ACLR Sàrl</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{getRoleLabel(user.role)}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>

      {/* État système */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">État du système</h2>
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5">
              ✅
            </span>
            <span>
              <strong>Next.js</strong> — l&apos;application répond.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5">
              ✅
            </span>
            <span>
              <strong>Authentification</strong> — session active pour{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                {user.email}
              </code>
              .
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5">
              {dbStatus.ok ? "✅" : "⚠️"}
            </span>
            <span>
              <strong>Base de données</strong> —{" "}
              {dbStatus.ok ? (
                <span>connexion OK ({dbStatus.message})</span>
              ) : (
                <span className="text-amber-700">{dbStatus.message}</span>
              )}
            </span>
          </li>
        </ul>
      </section>

      {/* Progression */}
      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">État du chantier</h2>
        <p className="text-sm text-slate-500 mb-4">
          Construction en 30 étapes — actuellement{" "}
          <strong>étape 3/30 (authentification)</strong>.
        </p>
        <ol className="space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span>
            <span>Scaffolding Next.js + Prisma + Docker Compose</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span>
            <span>Schéma Prisma + migration + seed</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span>
            <span>Authentification NextAuth + middleware</span>
          </li>
          <li className="flex items-center gap-2 text-slate-400">
            <span>○</span>
            <span>Layout principal (sidebar + topbar)</span>
          </li>
          <li className="flex items-center gap-2 text-slate-400">
            <span>○</span>
            <span>Module Prospects (liste + détail + import CSV)</span>
          </li>
          <li className="text-xs text-slate-400 pl-5">
            … 25 étapes supplémentaires
          </li>
        </ol>
      </section>
    </main>
  );
}
