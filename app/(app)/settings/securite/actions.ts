"use server";

/**
 * Server actions pour la double authentification (2FA / TOTP).
 *
 * Flux anti-lockout :
 *  1. startTotpEnrollment → génère un secret (stocké chiffré), 2FA PAS encore
 *     active. Retourne le QR + le secret en clair (à scanner).
 *  2. confirmTotpEnrollment(code) → vérifie un 1er code AVANT d'activer ;
 *     active la 2FA et retourne 8 codes de secours (affichés une seule fois).
 *  3. disableTotp(code) → désactive après vérification (TOTP ou code de secours).
 */
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";

import { audit } from "@/lib/audit";
import { decryptPassword, encryptPassword } from "@/lib/caldav";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  otpauthUri,
  verifyTotp,
} from "@/lib/totp";

/**
 * Change le mot de passe de l'utilisateur connecté.
 * Vérifie l'ancien mot de passe avant d'appliquer le nouveau (bcrypt).
 */
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  const user = await requireUser();
  const current = (input?.currentPassword ?? "").trim();
  const next = (input?.newPassword ?? "").trim();

  if (next.length < 8) {
    return {
      ok: false as const,
      error: "Le nouveau mot de passe doit faire au moins 8 caractères.",
    };
  }
  if (next === current) {
    return {
      ok: false as const,
      error: "Le nouveau mot de passe doit être différent de l'actuel.",
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser) {
    return { ok: false as const, error: "Utilisateur introuvable." };
  }
  const currentOk = await bcrypt.compare(current, dbUser.passwordHash);
  if (!currentOk) {
    return { ok: false as const, error: "Mot de passe actuel incorrect." };
  }

  const passwordHash = await bcrypt.hash(next, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  await audit("password.changed", { userId: user.id });
  return { ok: true as const };
}

export async function startTotpEnrollment() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, totpEnabled: true },
  });
  if (dbUser?.totpEnabled) {
    return { ok: false as const, error: "La 2FA est déjà activée." };
  }
  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecretEnc: encryptPassword(secret) },
  });
  const uri = otpauthUri(secret, dbUser?.email ?? user.email);
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return { ok: true as const, secret, qrDataUrl };
}

export async function confirmTotpEnrollment(code: string) {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpSecretEnc: true, totpEnabled: true },
  });
  if (!dbUser?.totpSecretEnc) {
    return { ok: false as const, error: "Démarre d'abord la configuration." };
  }
  if (dbUser.totpEnabled) {
    return { ok: false as const, error: "La 2FA est déjà activée." };
  }
  let secret: string;
  try {
    secret = decryptPassword(dbUser.totpSecretEnc);
  } catch {
    return { ok: false as const, error: "Secret illisible — recommence." };
  }
  if (!verifyTotp(secret, (code ?? "").trim())) {
    return { ok: false as const, error: "Code invalide. Réessaie." };
  }
  const recovery = generateRecoveryCodes(8);
  const hashes = await Promise.all(recovery.map((c) => bcrypt.hash(c, 10)));
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, totpRecoveryCodes: hashes },
  });
  await audit("2fa.enabled", { userId: user.id });
  revalidatePath("/settings/securite");
  return { ok: true as const, recoveryCodes: recovery };
}

export async function disableTotp(code: string) {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpSecretEnc: true, totpEnabled: true, totpRecoveryCodes: true },
  });
  if (!dbUser?.totpEnabled) {
    return { ok: false as const, error: "La 2FA n'est pas activée." };
  }
  const c = (code ?? "").trim();
  let ok = false;
  if (dbUser.totpSecretEnc) {
    try {
      ok = verifyTotp(decryptPassword(dbUser.totpSecretEnc), c);
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    for (const h of dbUser.totpRecoveryCodes) {
      if (await bcrypt.compare(c, h)) {
        ok = true;
        break;
      }
    }
  }
  if (!ok) {
    return { ok: false as const, error: "Code invalide — désactivation refusée." };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecretEnc: null, totpRecoveryCodes: [] },
  });
  await audit("2fa.disabled", { userId: user.id });
  revalidatePath("/settings/securite");
  return { ok: true as const };
}
