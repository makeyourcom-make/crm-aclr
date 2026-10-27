"use client";

import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Icon } from "@/components/icon";
import { Sidebar } from "@/components/layout/sidebar";
import type { PlayerHeader } from "@/lib/gamification/rules";

import type { Role } from "@prisma/client";

/** Classes du tiroir mobile qui accueille la sidebar navy. */
export const DRAWER_CLASSES =
  "gap-0 border-r-0 bg-sidebar p-0 text-sidebar-foreground data-[side=left]:w-[min(85vw,19rem)]";

export function MobileNav({
  role,
  badges,
  player,
}: {
  role: Role;
  badges?: { emails?: number };
  player?: PlayerHeader | null;
}) {
  const [open, setOpen] = useState(false);
  const unread = badges?.emails ?? 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="relative flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-border bg-card text-foreground shadow-[0_1px_2px_rgba(14,25,54,0.04)] transition-colors hover:border-border-strong md:hidden"
        aria-label={
          unread > 0
            ? `Ouvrir le menu de navigation (${unread} email${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""})`
            : "Ouvrir le menu de navigation"
        }
      >
        <Icon name="Menu" className="size-5" />
        {/* Pastille coral sur le bouton burger si emails non lus */}
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 size-2.5 rounded-full border-2 border-card bg-coral-500"
          />
        ) : null}
      </SheetTrigger>
      <SheetContent side="left" showCloseButton={false} className={DRAWER_CLASSES}>
        <SheetHeader className="sr-only">
          <SheetTitle>Menu de navigation</SheetTitle>
        </SheetHeader>
        <Sidebar
          role={role}
          onNavigate={() => setOpen(false)}
          onClose={() => setOpen(false)}
          badges={badges}
          player={player}
        />
      </SheetContent>
    </Sheet>
  );
}
