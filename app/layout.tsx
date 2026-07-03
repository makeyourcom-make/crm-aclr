import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CRM — Make Your Com",
    template: "%s · CRM Make Your Com",
  },
  description:
    "CRM commercial ACLR Sàrl — gestion des prospects, deals, contrats et commissions.",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={cn("h-full antialiased", inter.variable, "font-sans")}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
