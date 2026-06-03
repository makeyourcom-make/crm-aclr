import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const emails = await p.email.findMany({
    where: { direction: "ENTRANT" },
    select: {
      id: true,
      expediteurEmail: true,
      objet: true,
      contenuHtml: true,
      contenuTexte: true,
    },
    orderBy: { envoyeLe: "desc" },
  });
  for (const e of emails) {
    console.log(`\n=== ${e.expediteurEmail} | ${e.objet} ===`);
    console.log(`HTML length: ${e.contenuHtml?.length ?? 0}`);
    console.log(`Texte length: ${e.contenuTexte?.length ?? 0}`);
    console.log(`HTML preview: ${(e.contenuHtml ?? "").slice(0, 200)}`);
    console.log(`Texte preview: ${(e.contenuTexte ?? "").slice(0, 200)}`);
  }
  await p.$disconnect();
})();
