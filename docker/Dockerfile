FROM node:22-alpine AS base

# ─── Dependencies ───
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --prefer-offline --no-audit --progress=false
# Ensure esbuild binary is installed for the container platform
RUN npx esbuild --version > /dev/null

# ─── Builder ───
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js build
RUN --mount=type=cache,target=/app/.next/cache \
    export NEXT_PUBLIC_APP_VERSION=$(node -p "require('./package.json').version") && npm run build

# Bundle ws-relay + migrate (uses deps node_modules already present)
RUN npx esbuild scripts/ws-relay.ts \
      --bundle --platform=node --target=node22 --outfile=scripts/ws-relay.js \
 && npx esbuild scripts/migrate.ts \
      --bundle --platform=node --target=node22 --outfile=scripts/migrate.js

# Bundle MCP server (source is in mcp/ subdir, deps from root node_modules)
RUN npx esbuild mcp/src/server.ts \
      --bundle --platform=node --format=esm --outfile=mcp/dist/server.js \
      --banner:js='import{createRequire}from"module";const require=createRequire(import.meta.url);'

# ─── Runner ───
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Bundled scripts (no node_modules needed)
COPY --from=builder /app/scripts/ws-relay.js ./scripts/ws-relay.js
COPY --from=builder /app/scripts/migrate.js ./scripts/migrate.js

# Next.js standalone (brings its own minimal node_modules)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# MCP server (single bundled file, no node_modules)
COPY --from=builder /app/mcp/dist ./mcp/dist

# Migration files
COPY docker/migrations ./docker/migrations

# Built-in workflow seeds
COPY docker/seed-workflows ./docker/seed-workflows

USER nextjs

EXPOSE 3000 3001

CMD ["sh", "-c", "node scripts/migrate.js && node server.js"]
