/**
 * Augmente les types de NextAuth pour inclure les champs custom :
 *   - User.role
 *   - User.id (devient string et obligatoire)
 *   - Session.user.role (propagé via JWT)
 *
 * Ces types sont consommés automatiquement par Auth.js — pas besoin
 * de les importer explicitement quelque part.
 */
import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}
