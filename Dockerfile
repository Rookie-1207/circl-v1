# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Enable corepack so pnpm is available
RUN corepack enable pnpm

# Copy workspace manifests first so Docker caches the install layer
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json                ./lib/db/
COPY lib/api-zod/package.json           ./lib/api-zod/
COPY lib/api-client-react/package.json  ./lib/api-client-react/
COPY lib/api-spec/package.json          ./lib/api-spec/

RUN pnpm install --frozen-lockfile

# Copy source and build the bundle
COPY . .
RUN pnpm --filter @workspace/api-server run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# The esbuild bundle is self-contained; only the dist/ directory is needed.
# Pino worker files (pino-worker.mjs etc.) are co-located in dist/ by
# esbuild-plugin-pino, so no separate node_modules copy is required.
COPY --from=builder /app/artifacts/api-server/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/healthz || exit 1

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
