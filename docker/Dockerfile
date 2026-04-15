FROM node:22-alpine AS base

# ─── Dependencies ───
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts --prefer-offline --no-audit --progress=false

# ─── Builder ───
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Inject version from package.json into Next.js build (NEXT_PUBLIC_* is inlined at build time)
RUN --mount=type=cache,target=/app/.next/cache \
    export NEXT_PUBLIC_APP_VERSION=$(node -p "require('./package.json').version") && npm run build

# ─── MCP Builder ───
FROM base AS mcp-builder
WORKDIR /app/mcp
COPY mcp/package.json mcp/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts --prefer-offline --no-audit --progress=false
COPY mcp/ .
RUN npx tsc

# ─── Runner ───
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# WS Relay + Migrate — bundle FIRST (needs full node_modules for pg/ws packages)
# Must happen before standalone copy so rm -rf node_modules doesn't break Next.js
COPY --from=deps /app/node_modules ./node_modules
COPY scripts/ws-relay.ts ./scripts/ws-relay.ts
COPY scripts/migrate.ts ./scripts/migrate.ts
COPY src/lib/db ./src/lib/db
RUN npx -y esbuild scripts/ws-relay.ts \
      --bundle \
      --platform=node \
      --target=node22 \
      --outfile=scripts/ws-relay.js \
  && npx esbuild scripts/migrate.ts \
      --bundle \
      --platform=node \
      --target=node22 \
      --outfile=scripts/migrate.js \
  && rm -rf ./node_modules

# Next.js standalone (brings its own minimal node_modules)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# MCP server
COPY --from=mcp-builder /app/mcp/dist ./mcp/dist
COPY --from=mcp-builder /app/mcp/node_modules ./mcp/node_modules

# Migration files (runner is already bundled above as scripts/migrate.js)
COPY docker/migrations ./docker/migrations

# Built-in workflow seeds (loaded on first setup)
COPY docker/seed-workflows ./docker/seed-workflows

USER nextjs

EXPOSE 3000 3001

CMD ["sh", "-c", "node scripts/migrate.js && node server.js"]
