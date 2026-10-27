/**
 * Lien de retour (fil d'Ariane) des pages de détail : flèche + libellé,
 * cible tactile 36 px. Server-safe.
 */
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex min-h-9 items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-bold text-muted-foreground transition-colors hover:bg-navy-50 hover:text-foreground"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}
