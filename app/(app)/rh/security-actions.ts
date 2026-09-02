"use server";

/**
 * Actions de sécurité RH (admin) : réinitialisation du mot de passe d'un
 * collaborateur. Le mot de passe temporaire est ENVOYÉ à l'email de
 * récupération externe du collaborateur (jamais sur son adresse @makeyourcom.ch
 * qui arrive dans le CRM) ET affiché à l'admin pour qu'il puisse le transmettre.
 */
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { requireAdmin } from "@/lib/session";

function genTemp(prenom: string): string {
  const base = (prenom || "MYC").replace(/[^A-Za-z]/g, "").slice(0, 10) || "MYC";
  return `${base}-${randomInt(100000, 999999)}!`;
}

export async function resetUserPassword(userId: string): Promise<
  | { ok: true; tempPassword: string; emailedTo: string | null }
  | { ok: false; error: string }
> {
  const admin = await requireAdmin();
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailRecuperation: true, isActive: true },
  });
  if (!target) return { ok: false, error: "Collaborateur introuvable." };

  const temp = genTemp(target.name.split(" ")[0] ?? "");
  const passwordHash = await bcrypt.hash(temp, 10);
  await prisma.user.update({
    where: { id: target.id },
    data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
  });
  await audit("password.reset.admin", {
    userId: admin.id,
    entity: "User",
    entityId: target.id,
  });

  // Envoi à l'email de récupération externe (si défini).
  let emailedTo: string | null = null;
  if (target.emailRecuperation) {
    const url = "https://crm.makeyourcom.ch/login";
    const html = `
      <div style="font-family:system-ui,Arial,sans-serif;max-width:520px;color:#0E1936">
        <h2 style="margin:0 0 8px">Accès CRM MakeYourCom</h2>
        <p>Ton mot de passe a été réinitialisé. Voici tes identifiants (mot de passe temporaire).</p>
        <table style="border-collapse:collapse;margin:12px 0">
          <tr><td style="padding:4px 12px 4px 0;color:#64748b">Lien</td><td><a href="${url}">${url}</a></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b">Email</td><td>${target.email}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b">Mot de passe temporaire</td><td><b>${temp}</b></td></tr>
        </table>
        <p style="color:#334155">Une fois connecté·e, va dans <b>Paramètres &rarr; Sécurité</b> pour définir ton propre mot de passe.</p>
      </div>`;
    const text = `Accès CRM MakeYourCom\n\nTon mot de passe a été réinitialisé.\nLien: ${url}\nEmail: ${target.email}\nMot de passe temporaire: ${temp}\n\nEnsuite: Paramètres > Sécurité pour définir ton mot de passe.`;
    const res = await sendMail({
      from: "contact@makeyourcom.ch",
      fromName: "MakeYourCom CRM",
      to: target.emailRecuperation,
      subject: "Réinitialisation de ton accès CRM",
      html,
      text,
      replyTo: "contact@makeyourcom.ch",
    });
    if (res.ok && !res.dryRun) emailedTo = target.emailRecuperation;
  }

  return { ok: true, tempPassword: temp, emailedTo };
}
