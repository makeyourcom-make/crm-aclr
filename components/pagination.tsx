"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

interface PaginationProps {
  current: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

/**
 * Pagination liée aux query params de l'URL. Met à jour le param `page`
 * sans casser les autres filtres en place.
 */
export function Pagination({
  current,
  totalPages,
  total,
  pageSize,
}: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildHref = (page: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (page === 1) sp.delete("page");
    else sp.set("page", String(page));
    return `${pathname}?${sp.toString()}`;
  };

  const start = (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);

  // Construit la liste des pages à afficher (avec ellipsis si beaucoup)
  const pages = computePagesToDisplay(current, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-muted-foreground">
      <span>
        {total === 0 ? (
          "Aucun résultat"
        ) : (
          <>
            <strong className="text-foreground">{start}</strong>–
            <strong className="text-foreground">{end}</strong> sur{" "}
            <strong className="text-foreground">{total}</strong>
          </>
        )}
      </span>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <PaginationLink
            href={buildHref(Math.max(1, current - 1))}
            disabled={current === 1}
          >
            ←
          </PaginationLink>

          {pages.map((p, i) =>
            p === "ellipsis" ? (
              <span
                key={`e${i}`}
                className="px-1.5 text-muted-foreground"
                aria-hidden
              >
                …
              </span>
            ) : (
              <PaginationLink
                key={p}
                href={buildHref(p)}
                active={p === current}
              >
                {p}
              </PaginationLink>
            ),
          )}

          <PaginationLink
            href={buildHref(Math.min(totalPages, current + 1))}
            disabled={current === totalPages}
          >
            →
          </PaginationLink>
        </nav>
      )}
    </div>
  );
}

function PaginationLink({
  href,
  active,
  disabled,
  children,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const cls = cn(
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors",
    active
      ? "bg-primary text-primary-foreground"
      : "hover:bg-muted",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) {
    return <span className={cls}>{children}</span>;
  }
  return (
    <Link href={href} className={cls}>
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
