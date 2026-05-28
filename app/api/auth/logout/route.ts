/**
 * Endpoint dédié de déconnexion.
 *
 * Pourquoi un endpoint custom plutôt que NextAuth's /api/auth/signout ?
 * Parce que ce dernier affiche une page de confirmation par défaut. On
 * veut un logout en 1 clic.
 *
 * Pourquoi pas un Server Action ?
 * Parce que base-ui's Menu n'a pas un comportement 100% prévisible avec
 * les submit handlers — la redirect-error de signOut() peut se perdre.
 * Un GET sur cette route est navigation directe par le browser : 100%
 * fiable.
 *
 * Accepte GET et POST pour compat maximum (lien anchor OU form submit).
 */
import { redirect } from "next/navigation";

import { signOut } from "@/auth";

async function handleLogout() {
  // redirect: false → signOut détruit la session mais ne throw pas la
  // redirect-error. On gère la redirection nous-mêmes via Next.js redirect().
  await signOut({ redirect: false });
  redirect("/login");
}

export async function GET() {
  await handleLogout();
}

export async function POST() {
  await handleLogout();
}

// Toujours Node runtime (signOut a besoin de bcrypt / Prisma indirectement)
export const runtime = "nodejs";
