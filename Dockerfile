# politicas — container image (route (a) from docs/deploy/vercel.md).
# Long-lived `next start`-equivalent (standalone server.js) + PGlite store on a
# persistent volume. The image contains NO data: the 1.6 GB .pglite store lives
# on the volume and PGLITE_PATH points at its mount (default /data/pglite).
# Full runbook: docs/deploy/container.md.
#
# Node 24 everywhere — matches CI (.github/workflows/ci.yml pins node-version: 24;
# Node 24 = npm 11, the same major that generated package-lock.json).

# ── 1. deps — full node_modules for the build ────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── 2. build — next build (Turbopack) with standalone output ────────────────
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are inlined at BUILD time (docs/deploy/vercel.md §2). They are
# not secrets (public by design) but they must be present HERE, not at runtime:
#   docker build --build-arg NEXT_PUBLIC_SENTRY_DSN=… --build-arg NEXT_PUBLIC_APP_ENV=production
# Fly: [build.args] in fly.toml or `fly deploy --build-arg …`. Changing either
# requires a rebuild, exactly like on Vercel.
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG NEXT_PUBLIC_APP_ENV=production
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV \
    NEXT_TELEMETRY_DISABLED=1

# Optional Sentry source-map upload: pass SENTRY_ORG / SENTRY_PROJECT /
# SENTRY_AUTH_TOKEN as build secrets if wanted; absent → upload silently
# skipped, build still passes (same contract as CI/Vercel).

RUN npm run build

# ── 3. runtime — standalone server + static assets, nothing else ────────────
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    # The store lives on the persistent volume mounted at /data — NEVER in the
    # image. PGlite is single-connection: exactly ONE instance may serve one
    # data dir (fly.toml enforces single-machine).
    PGLITE_PATH=/data/pglite

# Run as the non-root user the base image ships. /data is the volume mount
# point; created here so a local `docker run -v` mount inherits sane ownership.
RUN mkdir -p /data && chown node:node /data /app
USER node

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
