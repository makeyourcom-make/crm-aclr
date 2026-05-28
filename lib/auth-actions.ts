"use server";

/**
 * Server Actions partagées liées à l'auth.
 * Les actions spécifiques au formulaire de login vivent dans app/login/actions.ts.
 */
import { signOut } from "@/auth";

/**
 * Déconnecte l'utilisateur courant et redirige vers /login.
 * Appelable depuis n'importe quel composant client via :
 *   <form action={logoutAction}><button>Se déconnecter</button></form>
 */
export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
