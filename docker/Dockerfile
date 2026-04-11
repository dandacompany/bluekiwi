FROM node:22-alpine AS base

# ─── Dependencies ───
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ─── Builder ───
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── MCP Builder ───
FROM base AS mcp-builder
WORKDIR /app/mcp
COPY mcp/package.json mcp/package-lock.json ./
RUN npm ci --ignore-scripts
COPY mcp/ .
RUN npx tsc

# ─── Runner ───
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# MCP server
COPY --from=mcp-builder /app/mcp/dist ./mcp/dist
COPY --from=mcp-builder /app/mcp/node_modules ./mcp/node_modules

# WS Relay — bundle into a single self-contained JS (includes ws package)
COPY --from=deps /app/node_modules ./node_modules
COPY scripts/ws-relay.ts ./scripts/ws-relay.ts
RUN npx -y esbuild scripts/ws-relay.ts \
      --bundle \
      --platform=node \
      --target=node22 \
      --outfile=scripts/ws-relay.js \
  && rm -rf ./node_modules

USER nextjs

EXPOSE 3000 3001

CMD ["node", "server.js"]
