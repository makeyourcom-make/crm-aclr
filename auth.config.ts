/**
 * Configuration NextAuth EDGE-SAFE.
 *
 * Ne contient ni bcrypt, ni @prisma/client, ni rien qui ne tourne pas en
 * edge runtime (V8 isolates). Ce fichier est importé par le middleware
 * (qui tourne en edge) et par auth.ts (qui tourne en Node).
 *
 * La logique d'authentification réelle (lookup user + bcrypt.compare) vit
 * dans auth.ts seulement.
 */
import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  },
  trustHost: true, // requis derrière reverse-proxy Hetzner (Caddy/Traefik)
  providers: [
    // Vide ici — les providers sont ajoutés dans auth.ts (côté Node).
    // Le middleware n'a pas besoin de connaître les providers, il regarde
    // juste si une session existe.
  ],
  callbacks: {
    /**
     * `authorized` est appelé :
     *   - par le middleware sur CHAQUE requête → route.matcher
     *   - par auth() en server components
     *
     * Logique : tout est privé sauf /login et /api/auth/*.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const isOnLogin = pathname.startsWith("/login");
      const isOnAuthApi = pathname.startsWith("/api/auth");
      const isPublic = isOnLogin || isOnAuthApi;

      if (isPublic) {
        // Si déjà connecté, on rebascule vers le dashboard depuis /login
        if (isLoggedIn && isOnLogin) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      // Toutes les autres routes nécessitent une session
      return isLoggedIn;
    },

    /**
     * Propage l'id et le role de l'utilisateur dans le JWT.
     * Ce callback tourne aussi en edge — on ne fait que des manipulations
     * d'objets en mémoire, jamais d'I/O.
     */
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    /**
     * Reflète id et role dans `session.user` côté client.
     */
    session({ session, token }) {
      // Le type JWT inclut id/role via l'augmentation dans types/next-auth.d.ts.
      // Cast explicite ici car la résolution du module `next-auth/jwt` côté
      // tsc ne picke pas toujours l'augmentation à travers le `satisfies`.
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      if (token.role && session.user) {
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};
