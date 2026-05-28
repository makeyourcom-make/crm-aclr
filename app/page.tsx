import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Page d'accueil temporaire (étape 1).
 *
 * Sera remplacée par le vrai dashboard à l'étape 16.
 * Pour l'instant elle sert de "status page" :
 *   - confirme que Next.js tourne
 *   - teste la connexion à la base Postgres
 *   - rappelle où on en est dans les 30 étapes
 */
export default async function HomePage() {
  let dbStatus: { ok: boolean; message: string } = {
    ok: false,
    message: "Pas encore testée.",
  };

  try {
    const res = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    dbStatus = {
      ok: res.length > 0,
      message: "Connexion Postgres OK.",
    };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Erreur de connexion inconnue.";
    dbStatus = {
      ok: false,
      message: msg,
    };
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8 flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-md"
          style={{ backgroundColor: "#1F4E78" }}
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            CRM — Make Your Com
          </h1>
          <p className="text-sm text-muted-foreground">
            ACLR Sàrl — Suisse romande
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
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
              {dbStatus.ok ? "✅" : "⚠️"}
            </span>
            <span>
              <strong>Base de données</strong> —{" "}
              {dbStatus.ok ? (
                <span>connexion Postgres OK.</span>
              ) : (
                <>
                  <span className="text-amber-700">non connectée.</span>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Détail de l&apos;erreur
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                      {dbStatus.message}
                    </pre>
                    <p className="mt-3 text-xs text-muted-foreground">
                      → Crée un projet Neon Postgres sur{" "}
                      <a
                        className="underline"
                        href="https://console.neon.tech"
                        target="_blank"
                        rel="noreferrer"
                      >
                        console.neon.tech
                      </a>{" "}
                      puis colle la chaîne de connexion dans{" "}
                      <code className="rounded bg-muted px-1">.env.local</code>{" "}
                      (variables{" "}
                      <code className="rounded bg-muted px-1">DATABASE_URL</code>{" "}
                      et{" "}
                      <code className="rounded bg-muted px-1">DIRECT_URL</code>
                      ), puis lance{" "}
                      <code className="rounded bg-muted px-1">
                        npm run prisma:migrate
                      </code>
                      .
                    </p>
                  </details>
                </>
              )}
            </span>
          </li>
        </ul>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">État du chantier</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Construction en 30 étapes — actuellement{" "}
          <strong>étape 1/30 (scaffolding)</strong>.
        </p>
        <ol className="space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span>Scaffolding Next.js + Prisma + Docker Compose</span>
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <span>○</span>
            <span>Schéma Prisma + migration + seed</span>
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <span>○</span>
            <span>Authentification NextAuth + middleware</span>
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <span>○</span>
            <span>Layout principal (sidebar + topbar)</span>
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <span>○</span>
            <span>Module Prospects (liste + détail + import CSV)</span>
          </li>
          <li className="text-xs text-muted-foreground pl-5">
            … 25 étapes supplémentaires
          </li>
        </ol>
      </section>
    </main>
  );
}
