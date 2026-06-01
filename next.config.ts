import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone : pour le build Docker (image finale ~150 Mo au lieu de >1 Go)
  output: "standalone",

  // Packages serveur exclus du bundling Next (génèrent des PDF avec fonts natives)
  serverExternalPackages: ["pdfkit", "swissqrbill", "@react-pdf/renderer"],

  // Reverse proxy (Caddy/Traefik) terminera le TLS, on doit accepter le X-Forwarded-Host
  // Ce flag sera utile en prod Hetzner
  experimental: {
    // Activer la full-text search côté Prisma sans warning
    serverActions: {
      bodySizeLimit: "10mb", // pour l'import CSV de prospects
    },
  },
};

export default nextConfig;
