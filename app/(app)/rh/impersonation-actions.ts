"use server";

/**
 * « Voir en tant que » — un ADMIN peut endosser un collaborateur pour voir son
 * écran (support). Implémenté via un cookie `imp_uid` respecté par
 * getSessionUser (uniquement si l'utilisateur réel est admin). Le bandeau en
 * haut de l'app permet de quitter à tout moment.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getRealSessionUser, IMPERSONATE_COOKIE } from "@/lib/session";

export async function impersonateUser(
  userId: string,
): Promise<{ ok: false; error: string } | never> {
  // Contrôle sur l'utilisateur RÉEL (pas l'endossé) : seul un admin peut lancer.
  const real = await getRealSessionUser();
  if (!real || real.role !== "ADMIN") {
    return { ok: false, error: "Réservé à l'administrateur." };
  }
  if (userId === real.id) {
    return { ok: false, error: "Tu es déjà toi-même." };
  }
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });
  if (!target || !target.isActive) {
    return { ok: false, error: "Collaborateur introuvable ou inactif." };
  }

  (await cookies()).set(IMPERSONATE_COOKIE, target.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
  });
  await audit("user.impersonate.start", {
    userId: real.id,
    entity: "User",
    entityId: target.id,
  });
  redirect("/");
}

export async function stopImpersonating(): Promise<never> {
  // Anodin : retirer le cookie ne fait que rendre l'admin à lui-même.
  const real = await getRealSessionUser();
  (await cookies()).delete(IMPERSONATE_COOKIE);
  if (real) {
    await audit("user.impersonate.stop", {
      userId: real.id,
      entity: "User",
      entityId: real.id,
    });
  }
  redirect("/");
}
