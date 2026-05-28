"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/icon";
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
        {/*
         * base-ui Menu.GroupLabel exige un Menu.Group parent (sinon
         * "MenuGroupContext is missing"). On wrap explicitement.
         */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm">{user.name}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/*
         * Lien <a> classique vers /api/auth/logout (endpoint custom).
         * On évite Server Action + form submit dans la menu base-ui qui
         * peut intercepter le submit. Une navigation browser native est
         * 100% fiable et arrive proprement au backend qui appelle signOut().
         */}
        <a
          href="/api/auth/logout"
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
        >
          <Icon name="LogOut" className="h-4 w-4" />
          Se déconnecter
        </a>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
