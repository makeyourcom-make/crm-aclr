import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1F4E78",
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
        {children}
      </body>
    </html>
  );
}
