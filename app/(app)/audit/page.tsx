import { ChevronLeft, ChevronRight, Filter, RotateCcw, ScrollText } from "lucide-react";

import { EmptyState, SectionCard, StatusPill } from "@/components/arena";
import type { Tone } from "@/components/arena/tones";
import {
  TABLE_CLASS,
  THEAD_CLASS,
  TR_CLASS,
  TableEmptyRow,
  TableScroll,
  Td,
  Th,
} from "@/components/common/arena-table";
import { LABEL_CLASS, SELECT_CLASS } from "@/components/common/form-styles";
import { IconPageHeader } from "@/components/common/icon-page-header";
import { PageShell } from "@/components/common/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Journal d'audit" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

/** Libellé + teinte lisibles par type d'action. */
const ACTION_META: Record<string, { label: string; tone: Tone }> = {
  "login.success": { label: "Connexion réussie", tone: "green" },
  "login.fail": { label: "Échec de connexion", tone: "gold" },
  "login.locked": { label: "Compte verrouillé", tone: "red" },
  "login.2fa_required": { label: "2FA requise", tone: "navy" },
  "login.2fa_fail": { label: "Échec 2FA", tone: "red" },
  "login.2fa_recovery_used": { label: "Code de secours utilisé", tone: "gold" },
  "2fa.enabled": { label: "2FA activée", tone: "green" },
  "2fa.disabled": { label: "2FA désactivée", tone: "gold" },
  "prospect.delete": { label: "Suppression entreprise", tone: "red" },
  "prospects.bulk_reassign": { label: "Réattribution en masse", tone: "blue" },
  "charges.export": { label: "Export des charges", tone: "violet" },
};

function actionMeta(a: string) {
  return ACTION_META[a] ?? { label: a, tone: "navy" as Tone };
}

/** Cellule vide : petit point discret, annoncé « non renseigné ». */
function Empty() {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden="true">·</span>
      <span className="sr-only">Non renseigné</span>
    </span>
  );
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
    <PageShell>
      <IconPageHeader
        icon={ScrollText}
        tone="navy"
        title="Journal d'audit"
        description={`${total} événement(s) tracé(s) : connexions, suppressions, exports, 2FA…`}
      />

      {/* Filtres (GET form) */}
      <form
        method="GET"
        role="search"
        aria-label="Filtrer le journal"
        className="mb-4 flex flex-wrap items-end gap-3"
      >
        <div className="min-w-[160px] flex-1 sm:flex-none">
          <label htmlFor="audit-action" className={LABEL_CLASS}>
            Action
          </label>
          <select
            id="audit-action"
            name="action"
            defaultValue={action ?? ""}
            className={cn(SELECT_CLASS, "sm:w-56")}
          >
            <option value="">Toutes</option>
            {actions.map((a) => (
              <option key={a.action} value={a.action}>
                {actionMeta(a.action).label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px] flex-1 sm:flex-none">
          <label htmlFor="audit-user" className={LABEL_CLASS}>
            Utilisateur
          </label>
          <select
            id="audit-user"
            name="userId"
            defaultValue={userId ?? ""}
            className={cn(SELECT_CLASS, "sm:w-56")}
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
          className={buttonVariants({ variant: "default", size: "lg" })}
        >
          <Filter aria-hidden="true" />
          Filtrer
        </button>
        {(action || userId) && (
          <a
            href="/audit"
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            <RotateCcw aria-hidden="true" />
            Réinitialiser
          </a>
        )}
      </form>

      <SectionCard
        className="overflow-hidden"
        title="Événements"
        description={
          pages > 1
            ? `Page ${pageNum} / ${pages} · ${PAGE_SIZE} par page`
            : `${total} événement(s)`
        }
        icon={ScrollText}
        tone="navy"
        contentClassName="-mx-5 -mb-5 sm:-mx-6 sm:-mb-6"
      >
        <TableScroll label="Journal d'audit">
          <table className={TABLE_CLASS}>
            <thead className={THEAD_CLASS}>
              <tr>
                <Th className="pl-5 sm:pl-6">Date / heure</Th>
                <Th>Utilisateur</Th>
                <Th>Action</Th>
                <Th>Cible</Th>
                <Th>IP</Th>
                <Th className="pr-5 sm:pr-6">Détails</Th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <TableEmptyRow colSpan={6}>
                  <EmptyState
                    icon={ScrollText}
                    tone="navy"
                    title="Aucun événement"
                    description={
                      action || userId
                        ? "Rien ne correspond à ces filtres."
                        : "Le journal se remplira à la prochaine connexion."
                    }
                  />
                </TableEmptyRow>
              ) : (
                logs.map((l) => {
                  const m = actionMeta(l.action);
                  return (
                    <tr key={l.id} className={TR_CLASS}>
                      <Td className="pl-5 text-xs whitespace-nowrap text-muted-foreground tabular-nums sm:pl-6">
                        {l.createdAt.toLocaleString("fr-CH")}
                      </Td>
                      <Td className="font-semibold whitespace-nowrap">
                        {l.user?.name ?? <Empty />}
                      </Td>
                      <Td>
                        <StatusPill tone={m.tone}>{m.label}</StatusPill>
                      </Td>
                      <Td className="text-xs whitespace-nowrap text-muted-foreground">
                        {l.entity ? (
                          `${l.entity}${l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ""}`
                        ) : (
                          <Empty />
                        )}
                      </Td>
                      <Td className="font-mono text-xs text-muted-foreground">
                        {l.ip ?? <Empty />}
                      </Td>
                      <Td className="max-w-[360px] pr-5 font-mono text-[11px] break-all text-muted-foreground sm:pr-6">
                        {l.metadata ? JSON.stringify(l.metadata) : <Empty />}
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableScroll>
      </SectionCard>

      {pages > 1 && (
        <nav
          aria-label="Pagination du journal"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <span className="font-semibold text-muted-foreground">
            Page {pageNum} / {pages}
          </span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <a
                href={qs({ page: String(pageNum - 1) })}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <ChevronLeft aria-hidden="true" />
                Précédent
              </a>
            )}
            {pageNum < pages && (
              <a
                href={qs({ page: String(pageNum + 1) })}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Suivant
                <ChevronRight aria-hidden="true" />
              </a>
            )}
          </div>
        </nav>
      )}
    </PageShell>
  );
}
