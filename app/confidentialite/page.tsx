/**
 * Page PUBLIQUE de politique de confidentialité (exclue du proxy).
 * Sert notamment pour la validation OAuth Google (URL requise pour publier
 * l'app dans Google Auth Platform).
 */
export const metadata = { title: "Politique de confidentialité — Make Your Com" };
export const dynamic = "force-static";

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-slate-800">
      <h1 className="text-2xl font-semibold tracking-tight">
        Politique de confidentialité
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Make Your Com — CRM d&apos;ACLR Sàrl · Route de la Jorette 66, 1899
        Torgon, Suisse · contact@makeyourcom.ch
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Dernière mise à jour : 15 septembre 2026
      </p>

      <Section title="1. Qui sommes-nous">
        Le CRM Make Your Com est un outil interne de gestion commerciale édité
        et exploité par ACLR Sàrl. Il est accessible uniquement aux
        collaborateurs autorisés, sur authentification.
      </Section>

      <Section title="2. Données que nous traitons">
        Le CRM traite des données professionnelles nécessaires à l&apos;activité
        commerciale : coordonnées de prospects et clients, activités (appels,
        rendez-vous, e-mails), contrats, factures et données de collaborateurs.
        Ces données sont saisies par les utilisateurs autorisés.
      </Section>

      <Section title="3. Accès à Google Agenda (Google Calendar API)">
        Lorsqu&apos;un utilisateur choisit de connecter son compte Google, le
        CRM demande l&apos;autorisation d&apos;accéder à son agenda Google
        (scope <em>Google Calendar</em>) dans le seul but de{" "}
        <strong>synchroniser les rendez-vous</strong> entre le CRM et Google
        Agenda, dans les deux sens (lecture et écriture d&apos;événements du
        compte connecté uniquement).
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            Nous n&apos;accédons qu&apos;aux événements d&apos;agenda de
            l&apos;utilisateur ayant explicitement connecté son compte.
          </li>
          <li>
            Le jeton d&apos;accès (refresh token) est stocké de manière{" "}
            <strong>chiffrée</strong> et n&apos;est utilisé que pour la
            synchronisation.
          </li>
          <li>
            Ces données Google ne sont <strong>jamais vendues</strong>, ni
            partagées avec des tiers, ni utilisées à des fins publicitaires ou
            de profilage.
          </li>
          <li>
            L&apos;utilisateur peut <strong>révoquer l&apos;accès</strong> à
            tout moment depuis la page « Synchroniser l&apos;agenda » du CRM, ou
            depuis les paramètres de sécurité de son compte Google.
          </li>
        </ul>
        <p className="mt-3">
          L&apos;utilisation et le transfert des informations reçues des API
          Google respectent la{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-blue-600 underline"
            target="_blank"
            rel="noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , y compris ses exigences d&apos;usage limité (Limited Use).
        </p>
      </Section>

      <Section title="4. Hébergement et sécurité">
        Les données sont hébergées sur une infrastructure européenne (base de
        données PostgreSQL gérée, région Union européenne). L&apos;accès est
        protégé par authentification, mots de passe hachés et, en option,
        double authentification. Les secrets (jetons, mots de passe
        d&apos;application) sont chiffrés.
      </Section>

      <Section title="5. Conservation et suppression">
        Les données sont conservées le temps nécessaire à l&apos;activité
        commerciale et aux obligations légales. Un utilisateur peut demander la
        déconnexion de son compte Google, qui supprime le jeton associé côté
        CRM.
      </Section>

      <Section title="6. Contact">
        Pour toute question relative à vos données :{" "}
        <a href="mailto:contact@makeyourcom.ch" className="text-blue-600 underline">
          contact@makeyourcom.ch
        </a>
        .
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}
