"use client";

/**
 * Pagination de la liste Entreprises (mêmes fonctions que la
 * pagination commune : taille de page 50 → 1000 ou « Tout », pages
 * numérotées, précédente / suivante), liée aux paramètres d'URL.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { formatInt } from "@/components/arena";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [50, 100, 200, 500, 1000];
const MAX_ALL = 2000; // garde-fou navigateur pour "Tout afficher"

interface ProspectsPaginationProps {
  current: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

export function ProspectsPagination({
  current,
  totalPages,
  total,
  pageSize,
}: ProspectsPaginationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const changePageSize = (val: string) => {
    const size = val === "all" ? Math.min(Math.max(total, 50), MAX_ALL) : Number(val);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("pageSize", String(size));
    sp.delete("page");
    router.push(`${pathname}?${sp.toString()}`);
  };
  const selectValue = PAGE_SIZES.includes(pageSize) ? String(pageSize) : "all";

  const buildHref = (page: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (page === 1) sp.delete("page");
    else sp.set("page", String(page));
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const start = (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);
  const pages = computePagesToDisplay(current, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] font-semibold text-muted-foreground">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          {total === 0 ? (
            "Aucun résultat"
          ) : (
            <>
              Fiches <strong className="text-foreground">{formatInt(start)}</strong> à{" "}
              <strong className="text-foreground">{formatInt(end)}</strong> sur{" "}
              <strong className="text-foreground">{formatInt(total)}</strong>
            </>
          )}
        </span>
        <label className="flex items-center gap-1.5">
          Par page
          <select
            value={selectValue}
            onChange={(e) => changePageSize(e.target.value)}
            className="h-9 rounded-[10px] border border-border-strong bg-card px-2 text-[13px] font-semibold text-foreground"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="all">Tout</option>
          </select>
        </label>
      </div>

      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center gap-1" aria-label="Pagination">
          <PageLink
            href={buildHref(Math.max(1, current - 1))}
            disabled={current === 1}
            label="Page précédente"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </PageLink>

          {pages.map((p, i) =>
            p === "ellipsis" ? (
              <span key={`e${i}`} className="px-1 text-muted-foreground" aria-hidden="true">
                ...
              </span>
            ) : (
              <PageLink
                key={p}
                href={buildHref(p)}
                active={p === current}
                label={`Page ${p}`}
              >
                {p}
              </PageLink>
            ),
          )}

          <PageLink
            href={buildHref(Math.min(totalPages, current + 1))}
            disabled={current === totalPages}
            label="Page suivante"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({
  href,
  active,
  disabled,
  label,
  children,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const cls = cn(
    "inline-flex size-9 items-center justify-center rounded-[10px] border text-[13px] font-bold tabular-nums transition-colors",
    active
      ? "border-navy-700 bg-navy-700 text-white"
      : "border-border-strong bg-card text-foreground hover:bg-navy-50",
    disabled && "border-border bg-ground text-subtle",
  );
  if (disabled) {
    return (
      <span className={cls} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cls}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

/**
 * Décide quelles pages afficher autour de la page courante.
 * @example computePagesToDisplay(5, 20) → [1, 'ellipsis', 4, 5, 6, 'ellipsis', 20]
 */
function computePagesToDisplay(
  current: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: Array<number | "ellipsis"> = [1];
  if (current > 3) pages.push("ellipsis");
  for (let p = Math.max(2, current - 1); p <= Math.min(totalPages - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < totalPages - 2) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}
