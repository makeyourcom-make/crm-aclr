/**
 * Suppression du compte Social "MakeYourCom" / FACEBOOK (resp. Arthur Chazelle).
 *
 * Le profil Facebook d'Arthur est fermé : la liste ne sert plus à rien. Les
 * autres comptes (Instagram MakeYourCom + Passeport Beauté, LinkedIn Arthur +
 * Sophie) sont conservés.
 *
 * La suppression CASCADE sur social_prospects → on dump d'abord le compte et
 * ses prospects dans scripts/_social-facebook-arthur-backup.json (restaurable).
 */
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const account = await prisma.socialAccount.findFirst({
    where: { nom: "MakeYourCom", reseau: "FACEBOOK" },
    include: { prospects: true, responsable: { select: { name: true } } },
  });

  if (!account) {
    console.log("Compte introuvable — déjà supprimé ? Rien à faire.");
    return;
  }
  if (account.responsable.name !== "Arthur Chazelle") {
    throw new Error(`Responsable inattendu : ${account.responsable.name} — abandon.`);
  }

  const path = "scripts/_social-facebook-arthur-backup.json";
  writeFileSync(path, JSON.stringify(account, null, 2), "utf8");
  console.log(`Sauvegarde : ${path} (${account.prospects.length} prospects)`);

  const deleted = await prisma.socialAccount.delete({ where: { id: account.id } });
  console.log(`Compte supprimé ✓ — ${deleted.reseau} / ${deleted.nom} (id ${deleted.id})`);

  const reste = await prisma.socialAccount.findMany({
    select: { nom: true, reseau: true },
    orderBy: [{ reseau: "asc" }, { nom: "asc" }],
  });
  console.log("Comptes restants :");
  for (const a of reste) console.log(`   - ${a.reseau} / ${a.nom}`);
  console.log(`Prospects sociaux restants : ${await prisma.socialProspect.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
