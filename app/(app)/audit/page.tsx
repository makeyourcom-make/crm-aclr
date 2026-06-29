import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Journal d'audit" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

/** Libellé + couleur lisibles par type d'action. */
const ACTION_META: Record<string, { label: string; cls: string }> = {
  "login.success": { label: "Connexion réussie", cls: "bg-emerald-100 text-emerald-700" },
  "login.fail": { label: "Échec de connexion", cls: "bg-amber-100 text-amber-700" },
  "login.locked": { label: "Compte verrouillé", cls: "bg-red-100 text-red-700" },
  "login.2fa_required": { label: "2FA requise", cls: "bg-slate-100 text-slate-600" },
  "login.2fa_fail": { label: "Échec 2FA", cls: "bg-red-100 text-red-700" },
  "login.2fa_recovery_used": { label: "Code de secours utilisé", cls: "bg-amber-100 text-amber-700" },
  "2fa.enabled": { label: "2FA activée", cls: "bg-emerald-100 text-emerald-700" },
  "2fa.disabled": { label: "2FA désactivée", cls: "bg-amber-100 text-amber-700" },
  "prospect.delete": { label: "Suppression entreprise", cls: "bg-red-100 text-red-700" },
  "prospects.bulk_reassign": { label: "Réattribution en masse", cls: "bg-blue-100 text-blue-700" },
  "charges.export": { label: "Export des charges", cls: "bg-purple-100 text-purple-700" },
};

function actionMeta(a: string) {
  return ACTION_META[a] ?? { label: a, cls: "bg-slate-100 text-slate-600" };
}

interface PageProps {
  searchParams: Promise<{ action?: string; userId?: string; page?: string }>;
}

export default async function AuditPage({ searchParams }: PageProps) {
  await requireAdmin();
  const { action, userId, page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);

  const where = {
    ...(action ? { action } : {}),
    ...(userId ? { userId } : {}),
  };

  const [logs, total, users, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  const pages = Math.ceil(total / PAGE_SIZE);
  const qs = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { action, userId, page: String(pageNum), ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    return `/audit?${sp.toString()}`;
  };

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <PageHeader
        title="Journal d'audit"
        description={`${total} événement(s) tracé(s) — connexions, suppressions, exports, 2FA…`}
      />

      {/* Filtres (GET form) */}
      <form method="GET" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Action</label>
          <select
            name="action"
            defaultValue={action ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
          >
            <option value="">Toutes</option>
            {actions.map((a) => (
              <option key={a.action} value={a.action}>
                {actionMeta(a.action).label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Utilisateur</label>
          <select
            name="userId"
            defaultValue={userId ?? ""}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
          >
            <option value="">Tous</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filtrer
        </button>
        {(action || userId) && (
          <a href="/audit" className="h-9 px-2 text-sm text-muted-foreground hover:underline">
            Réinitialiser
          </a>
        )}
      </form>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <Th>Date / heure</Th>
              <Th>Utilisateur</Th>
              <Th>Action</Th>
              <Th>Cible</Th>
              <Th>IP</Th>
              <Th>Détails</Th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                  Aucun événement.
                </td>
              </tr>
            ) : (
              logs.map((l) => {
                const m = actionMeta(l.action);
                return (
                  <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-xs text-muted-foreground">
                      {l.createdAt.toLocaleString("fr-CH")}
                    </td>
                    <td className="px-3 py-2">{l.user?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>
                        {m.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {l.entity ? `${l.entity}${l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ""}` : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {l.ip ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {l.metadata ? JSON.stringify(l.metadata) : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {pageNum} / {pages}
          </span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <a href={qs({ page: String(pageNum - 1) })} className="rounded-md border border-border px-3 py-1 hover:bg-muted">
                ← Précédent
              </a>
            )}
            {pageNum < pages && (
              <a href={qs({ page: String(pageNum + 1) })} className="rounded-md border border-border px-3 py-1 hover:bg-muted">
                Suivant →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}
