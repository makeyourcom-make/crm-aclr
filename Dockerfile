# =============================================================================
# Dockerfile multi-stage — CRM ACLR Sàrl
# =============================================================================
# Build optimisé pour Next.js 16 en standalone, image finale ~150 Mo.
# Trois stages : deps, builder, runner.
# =============================================================================

# ---- Stage 1 : Installation des dépendances ----
FROM node:24-alpine AS deps
WORKDIR /app

# Dépendances système requises par Prisma et certains binaires
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund


# ---- Stage 2 : Build de l'application ----
FROM node:24-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Génération du client Prisma + build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build


# ---- Stage 3 : Image finale (runner) ----
FROM node:24-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl tini tzdata && \
    cp /usr/share/zoneinfo/Europe/Zurich /etc/localtime && \
    echo "Europe/Zurich" > /etc/timezone

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Europe/Zurich

# User non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Output standalone Next.js (cf next.config.ts → output: 'standalone')
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma client + schema (requis pour prisma migrate deploy au boot)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Stockage local
RUN mkdir -p /app/storage && chown -R nextjs:nodejs /app/storage

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# tini = init PID 1 propre, gère les signaux SIGTERM correctement
ENTRYPOINT ["/sbin/tini", "--"]

# Au démarrage : applique les migrations Prisma puis lance Next.js
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
