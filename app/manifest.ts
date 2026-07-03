import type { MetadataRoute } from "next";

/**
 * Manifest PWA — rend le CRM installable sur mobile/desktop comme une app.
 * Next expose automatiquement /manifest.webmanifest + <link rel="manifest">.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CRM — Make Your Com",
    short_name: "MakeYourCom",
    description:
      "CRM commercial ACLR Sàrl — prospects, deals, contrats, dossiers et facturation.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0E1936",
    theme_color: "#0E1936",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
