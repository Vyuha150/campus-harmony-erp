# Campus Harmony ERP — backend
#
# There was NO backend deployment configuration: `vercel.json` deployed only the
# frontend, and three conflicting port assumptions coexisted (server.ts 5000,
# ecosystem.config.cjs 8725, CORS hardcoded to 8080). The API had no defined
# production host at all.
#
# Multi-stage so the runtime image carries no compiler, no dev dependencies and
# no source-only tooling.

# ─── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /app

# bcrypt compiles a native addon; these are build-only and never reach runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS build

WORKDIR /app
COPY . .

# Generate the Prisma client into node_modules. DATABASE_URL is required by the
# config module at import time but is NOT used for generation — a placeholder is
# correct here and never reaches the running container.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

# ─── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /app

# postgresql-client provides pg_dump / pg_restore / psql, which the backup
# service (src/lib/backup.ts) shells out to. Without it, backups silently
# cannot run — the exact failure this project already had once.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates postgresql-client tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# ecosystem.config.cjs set NODE_ENV=development in what was presented as the
# deployment config. Production must be production: it enables HSTS, forces
# HTTPS-only CORS, and makes the seed script refuse to run.

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY package.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts ./scripts
COPY src ./src
COPY tsconfig.json ./

# Run as a non-root user. The base image ships `node` (uid 1000).
RUN mkdir -p /app/uploads /app/backups && chown -R node:node /app
USER node

EXPOSE 5000

# tini reaps zombies and forwards signals, so the graceful-shutdown handler in
# server.ts (SIGTERM → close server → disconnect Prisma) actually fires.
ENTRYPOINT ["/usr/bin/tini", "--"]

# Container-level health check. Uses /api/ready, which verifies DATABASE
# CONNECTIVITY — unlike /api/health, which only proves the process is up. An
# orchestrator must not route traffic to an instance whose database is gone.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start"]
