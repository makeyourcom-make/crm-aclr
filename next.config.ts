import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone : pour le build Docker (image finale ~150 Mo au lieu de >1 Go)
  output: "standalone",

  // Ne pas révéler la techno serveur (retire l'en-tête X-Powered-By: Next.js).
  poweredByHeader: false,

  // En-têtes de sécurité appliqués à TOUTES les réponses.
  // (CSP volontairement laissée pour une passe dédiée — elle nécessite des
  //  nonces côté Next et un test applicatif pour ne rien casser.)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Force HTTPS pendant 2 ans (navigateur refuse le HTTP ensuite).
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Anti-clickjacking : le CRM ne doit jamais être affiché en iframe.
          { key: "X-Frame-Options", value: "DENY" },
          // Empêche le navigateur de "deviner" un type MIME (anti drive-by).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Ne fuite pas l'URL complète vers les sites tiers.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Désactive les API puissantes non utilisées par le CRM.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },

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
