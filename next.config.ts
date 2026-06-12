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
      // Domaines autorisés à appeler les Server Actions. Sans ça, derrière un
      // domaine personnalisé / reverse-proxy, Next rejette les POST d'actions
      // (vérification Origin vs Host) → recherche, click-to-call, etc. échouent.
      allowedOrigins: [
        "crm.makeyourcom.ch",
        "*.vercel.app",
        "localhost:3000",
      ],
    },
    // Tree-shaking auto des libs lourdes : gain ~30-50% sur le bundle client.
    // Critique pour lucide-react (~500KB sans), Radix (~200KB sans), recharts.
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-popover",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-switch",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-label",
      "@radix-ui/react-slot",
      "recharts",
      "zod",
      "sonner",
    ],
  },
};

export default nextConfig;
