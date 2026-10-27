/**
 * Conteneur de page MYC Arena : marges 16 px sur téléphone, 24 px tablette,
 * 32 px desktop (charte §3), largeur maximale selon le type de page.
 * Server-safe.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const WIDTH = {
  full: "",
  wide: "mx-auto w-full max-w-6xl",
  medium: "mx-auto w-full max-w-5xl",
  form: "mx-auto w-full max-w-4xl",
  narrow: "mx-auto w-full max-w-3xl",
  tight: "mx-auto w-full max-w-2xl",
} as const;

export type PageShellWidth = keyof typeof WIDTH;

export function PageShell({
  width = "full",
  className,
  children,
}: {
  width?: PageShellWidth;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7",
        WIDTH[width],
        className,
      )}
    >
      {children}
    </div>
  );
}
