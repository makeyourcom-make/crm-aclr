"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/icon";
import { logoutAction } from "@/lib/auth-actions";
import { getRoleLabel } from "@/lib/labels";

import type { Role } from "@prisma/client";

interface UserMenuProps {
  user: {
    name: string;
    email: string;
    role: Role;
  };
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu({ user }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Menu utilisateur"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="hidden text-left md:block">
          <p className="text-sm font-medium leading-tight">{user.name}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">
            {getRoleLabel(user.role)}
          </p>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm">{user.name}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/*
         * Logout = form action (pas onClick).
         * Le pattern <form action={serverAction}> propage correctement la
         * "redirect-error" levée par signOut() vers le navigateur. Un onClick
         * sur DropdownMenuItem fire-and-forget la promesse et perd le redirect.
         */}
        <form action={logoutAction} className="w-full">
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
          >
            <Icon name="LogOut" className="h-4 w-4" />
            Se déconnecter
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
