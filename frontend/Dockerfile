# syntax=docker/dockerfile:1
#
# Multi-stage build: docker-compose.yml builds the `development` target.
# `builder`/`production` are kept in the same file for production parity —
# same base image, same lockfile install, only the final stage differs.

ARG NODE_VERSION=24.18.0

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
# Needed by several native Next.js/Node dependencies on musl (Alpine) libc
RUN apk add --no-cache libc6-compat

# -----------------------------------------------------------------------------
# deps — installed once from the lockfile, reused by dev and build stages
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# -----------------------------------------------------------------------------
# development — this is the target docker-compose.yml builds. Source is
# bind-mounted at runtime; node_modules/.next live in named volumes (see
# compose file) so the container's Linux-compiled modules never collide with
# a host's macOS/Windows node_modules.
# -----------------------------------------------------------------------------
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# builder — production build. Requires `output: 'standalone'` in
# next.config.js/ts so `.next/standalone` exists for the production stage.
# -----------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -----------------------------------------------------------------------------
# production — minimal runtime: only the standalone server + static assets,
# running as an unprivileged user.
# -----------------------------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]