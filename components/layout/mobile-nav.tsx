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

export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted md:hidden"
        aria-label="Ouvrir le menu de navigation"
      >
        <Icon name="Menu" className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Menu de navigation</SheetTitle>
        </SheetHeader>
        <Sidebar role={role} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
