/**
 * Helpers serveur pour la gestion de session et des permissions.
 *
 * Utilisation dans les Server Components et Server Actions :
 *
 *   ```ts
 *   import { requireUser, requireAdmin } from "@/lib/session";
 *
 *   export default async function MaPage() {
 *     const user = await requireUser(); // redirige vers /login si pas connecté
 *     return <div>Bonjour {user.name}</div>;
 *   }
 *   ```
 *
 *   ```ts
 *   "use server";
 *   export async function supprimerProduit(id: string) {
 *     await requireAdmin(); // throw 403 si pas admin
 *     await prisma.product.delete({ where: { id } });
 *   }
 *   ```
 *
 * Row-level security :
 *   - canAccessProspect(user, prospect) : true si admin OU assigné
 *   - canAccessDeal(user, deal)         : idem
 *   - canAccessContract(user, contract) : idem
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

import type { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** Cookie « Voir en tant que » : id de l'utilisateur endossé par un admin. */
export const IMPERSONATE_COOKIE = "imp_uid";

/**
 * Retourne l'utilisateur de la session ou null.
 * Ne fait pas de redirection — à utiliser pour les vérifications conditionnelles.
 */
/**
 * Utilisateur RÉELLEMENT connecté (ignore toute impersonation « Voir en tant
 * que »). À utiliser pour les contrôles de sécurité de l'impersonation.
 */
export async function getRealSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email || !session.user.name) {
    return null;
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const real = await getRealSessionUser();
  if (!real) return null;
  // « Voir en tant que » : SEUL un admin peut endosser un autre utilisateur
  // (support : voir son écran). Tout le reste de l'app le voit alors comme cet
  // utilisateur ; le bandeau permet de quitter. Aucun effet pour un non-admin.
  if (real.role === "ADMIN") {
    const impUid = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
    if (impUid && impUid !== real.id) {
      const target = await prisma.user.findUnique({
        where: { id: impUid },
        select: { id: true, email: true, name: true, role: true, isActive: true },
      });
      if (target && target.isActive) {
        return {
          id: target.id,
          email: target.email,
          name: target.name,
          role: target.role,
        };
      }
    }
  }
  return real;
}

/**
 * Si un admin est en train de « voir en tant que » quelqu'un, renvoie le nom
 * réel + l'utilisateur endossé (pour le bandeau). Sinon null.
 */
export async function getImpersonation(): Promise<{
  realName: string;
  asUser: SessionUser;
} | null> {
  const real = await getRealSessionUser();
  if (!real || real.role !== "ADMIN") return null;
  const impUid = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
  if (!impUid || impUid === real.id) return null;
  const target = await prisma.user.findUnique({
    where: { id: impUid },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!target || !target.isActive) return null;
  return {
    realName: real.name,
    asUser: {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
    },
  };
}

/**
 * Exige un utilisateur connecté. Redirige vers /login sinon.
 * Utilisable uniquement dans les Server Components et Server Actions.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Exige un utilisateur admin. Lance une erreur 403 sinon.
 * Le middleware aura déjà bloqué les non-connectés en amont.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new ForbiddenError("Accès admin requis.");
  }
  return user;
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

// ---------------------------------------------------------------------------
// ROW-LEVEL SECURITY
// ---------------------------------------------------------------------------

interface MaybeAssigned {
  assigneAId?: string | null;
}

/**
 * Un commercial ne voit que ses propres prospects. Admin voit tout.
 */
export function canAccessProspect(
  user: SessionUser,
  prospect: MaybeAssigned,
): boolean {
  if (user.role === "ADMIN") return true;
  return prospect.assigneAId === user.id;
}

export function canAccessDeal(
  user: SessionUser,
  deal: MaybeAssigned,
): boolean {
  return canAccessProspect(user, deal);
}

export function canAccessContract(
  user: SessionUser,
  contract: MaybeAssigned,
): boolean {
  return canAccessProspect(user, contract);
}

/**
 * Construit le filtre `where` pour les listes d'entités assignables.
 *
 * @example
 *   const where = scopedWhere(user, { statut: 'CONTACTE' });
 *   // Admin : { statut: 'CONTACTE' }
 *   // Commercial : { statut: 'CONTACTE', assigneAId: user.id }
 */
export function scopedWhere<T extends object>(
  user: SessionUser,
  base: T = {} as T,
): T & { assigneAId?: string } {
  if (user.role === "ADMIN") return base;
  return { ...base, assigneAId: user.id };
}
