import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { cn } from "@/lib/utils";

/**
 * Polices Make Your Com (auto-hébergées par next/font, aucune requête vers
 * Google côté navigateur) :
 *   - Plus Jakarta Sans → texte courant / UI  (`--font-sans`, classe font-sans)
 *   - Bricolage Grotesque → titres et gros chiffres (`--font-display`,
 *     classe font-display). Axe optique `opsz` inclus comme dans la maquette.
 * Le mapping vers les tokens Tailwind est fait dans app/globals.css.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "CRM · Make Your Com",
    template: "%s · CRM Make Your Com",
  },
  description:
    "CRM commercial ACLR Sàrl - gestion des prospects, deals, contrats et commissions.",
  applicationName: "CRM Make Your Com",
  authors: [{ name: "ACLR Sàrl" }],
  robots: { index: false, follow: false }, // app interne, jamais indexée
  // PWA installable sur iOS : icône (app/apple-icon.png auto), titre, barre
  // d'état navy pour coller au thème.
  appleWebApp: {
    capable: true,
    title: "MakeYourCom",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0E1936",
  // Le contenu s'étend sous l'encoche / la barre home (mode app) ; on gère les
  // marges de sécurité via env(safe-area-inset-*) dans les composants concernés.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={cn(
        "h-full antialiased",
        jakarta.variable,
        bricolage.variable,
        "font-sans",
      )}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
