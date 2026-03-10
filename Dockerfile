# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_PROGRESS=false
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

FROM base AS deps
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev --no-audit --no-fund --progress=false

FROM base AS builder
ENV NODE_OPTIONS=--max-old-space-size=512
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN npm run db:generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && npm run start -- --hostname 0.0.0.0 --port ${PORT:-3000}"]
