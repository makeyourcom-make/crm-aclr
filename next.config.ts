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
          // CSP — politique COMPLÈTE en mode BLOQUANT (anti-XSS).
          // - script/style : 'unsafe-inline'/'unsafe-eval' requis par Next ;
          //   blob: pour ses workers/chunks dynamiques.
          // - img/font/connect : 'self' + https/data (logos clients, polices).
          // - frame-src 'self' : aperçu email (iframe srcdoc) ; + docs.google.com
          //   pour l'aperçu intégré du document de suivi projets (lecture seule).
          // - object-src 'none', base-uri, form-action, frame-ancestors : strict.
          // report-uri conservé → toute violation résiduelle reste visible.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https:",
              "connect-src 'self' https: blob: data:",
              "frame-src 'self' https://docs.google.com",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "report-uri /api/csp-report",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Packages serveur exclus du bundling Next (PDF à fonts natives + driver
  // serverless Neon : `ws` a des deps natives optionnelles à ne pas bundler).
  serverExternalPackages: [
    "pdfkit",
    "swissqrbill",
    "@react-pdf/renderer",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "ws",
  ],

  // Reverse proxy (Caddy/Traefik) terminera le TLS, on doit accepter le X-Forwarded-Host
  // Ce flag sera utile en prod Hetzner
  experimental: {
    // Activer la full-text search côté Prisma sans warning
    serverActions: {
      bodySizeLimit: "10mb", // import CSV de prospects (les fichiers volumineux comme
      // les contrats signés scannés vont directement à Vercel Blob, pas via une action).
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
