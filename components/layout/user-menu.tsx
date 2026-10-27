"use client";

import Link from "next/link";

import { PlayerAvatar, toneForRole } from "@/components/arena/player-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/icon";
import { initialsOf, type PlayerHeader } from "@/lib/gamification/rules";
import { getRoleLabel } from "@/lib/labels";

import type { Role } from "@prisma/client";

interface UserMenuProps {
  user: {
    name: string;
    email: string;
    role: Role;
  };
  player?: PlayerHeader | null;
}

const ITEM =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-2 text-left text-sm font-medium no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground";

export function UserMenu({ user, player }: UserMenuProps) {
  const initials = player?.initials || initialsOf(user.name);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex shrink-0 items-center gap-2.5 rounded-full p-0.5 transition-colors hover:bg-navy-50 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 xl:rounded-[14px] xl:py-1 xl:pr-3 xl:pl-1"
        // Contient le nom et le rôle affichés dès xl (WCAG 2.5.3).
        aria-label={`${user.name}, ${getRoleLabel(user.role)} · menu utilisateur`}
      >
        <PlayerAvatar initials={initials} tone={toneForRole(user.role)} size={40} />
        <div className="hidden text-left xl:block">
          <p className="text-sm leading-tight font-bold">{user.name}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">
            {getRoleLabel(user.role)}
          </p>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 rounded-[14px] p-1.5">
        {/*
         * base-ui Menu.GroupLabel exige un Menu.Group parent (sinon
         * "MenuGroupContext is missing"). On wrap explicitement.
         */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-1 px-2 py-1.5">
            <span className="text-sm font-bold text-foreground">{user.name}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <Link href="/settings/calendar" className={ITEM}>
          <Icon name="Repeat" className="size-4" />
          Synchroniser l&apos;agenda
        </Link>

        <Link href="/settings/securite" className={ITEM}>
          <Icon name="Settings" className="size-4" />
          Sécurité &amp; 2FA
        </Link>

        <DropdownMenuSeparator />

        {/*
         * Lien <a> classique vers /api/auth/logout (endpoint custom).
         * On évite Server Action + form submit dans la menu base-ui qui
         * peut intercepter le submit. Une navigation browser native est
         * 100% fiable et arrive proprement au backend qui appelle signOut().
         * Surtout PAS de <Link> : son préchargement automatique appellerait
         * l'endpoint et déconnecterait l'utilisateur.
         */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/auth/logout" className={ITEM}>
          <Icon name="LogOut" className="size-4" />
          Se déconnecter
        </a>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
