import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

/**
 * Backfill du contenu HTML/text pour les emails entrants déjà en DB
 * qui n'ont pas le body (créés avant qu'on récupère le contenu via API).
 *
 * Stratégie :
 *  1. Liste tous les emails inbound via Resend API
 *  2. Match avec ceux en DB par messageId (RFC 5322)
 *  3. Pour chaque match, GET le contenu et update la DB
 */
async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY manquant");
    process.exit(1);
  }

  // 1. Récupère tous les emails entrants sans contenu
  const dbEmails = await p.email.findMany({
    where: {
      direction: "ENTRANT",
      OR: [{ contenuHtml: "" }, { contenuTexte: "" }],
    },
    select: {
      id: true,
      expediteurEmail: true,
      objet: true,
      messageId: true,
    },
  });
  console.log(`📥 ${dbEmails.length} email(s) à backfiller en DB`);

  // 2. Liste tous les emails reçus via Resend API
  const listRes = await fetch("https://api.resend.com/emails/receiving", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!listRes.ok) {
    console.error("Erreur Resend list:", await listRes.text());
    process.exit(1);
  }
  const listData = (await listRes.json()) as {
    data: Array<{ id: string; message_id: string; subject: string; from: string }>;
  };
  console.log(`📦 ${listData.data.length} email(s) côté Resend`);

  // 3. Pour chaque DB email, trouve l'ID Resend correspondant via messageId
  let success = 0;
  let failed = 0;

  for (const dbEmail of dbEmails) {
    const match = listData.data.find((r) => r.message_id === dbEmail.messageId);
    if (!match) {
      console.warn(`✗ Pas de match pour ${dbEmail.objet} (messageId=${dbEmail.messageId})`);
      failed++;
      continue;
    }

    // GET le contenu complet
    const detailRes = await fetch(
      `https://api.resend.com/emails/receiving/${match.id}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!detailRes.ok) {
      console.warn(`✗ Erreur fetch ${match.id}: ${detailRes.status}`);
      failed++;
      continue;
    }
    const detail = (await detailRes.json()) as {
      html?: string;
      text?: string;
    };

    const html = detail.html ?? "";
    const text = detail.text ?? (html ? html.replace(/<[^>]+>/g, "").slice(0, 5000) : "");

    await p.email.update({
      where: { id: dbEmail.id },
      data: { contenuHtml: html, contenuTexte: text },
    });
    console.log(`✓ ${dbEmail.objet} (html: ${html.length}b, text: ${text.length}b)`);
    success++;
  }

  await p.$disconnect();
  console.log(`\n=== ✓ ${success} backfilled | ✗ ${failed} échec ===`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
