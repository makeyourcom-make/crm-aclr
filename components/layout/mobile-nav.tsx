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

import type { Role } from "@prisma/client";

export function MobileNav({
  role,
  badges,
}: {
  role: Role;
  badges?: { emails?: number };
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted md:hidden"
        aria-label="Ouvrir le menu de navigation"
      >
        <Icon name="Menu" className="h-5 w-5" />
        {/* Pastille rouge sur le bouton burger si emails non lus */}
        {badges?.emails && badges.emails > 0 ? (
          <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-600 ring-2 ring-background" />
        ) : null}
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Menu de navigation</SheetTitle>
        </SheetHeader>
        <Sidebar role={role} onNavigate={() => setOpen(false)} badges={badges} />
      </SheetContent>
    </Sheet>
  );
}
