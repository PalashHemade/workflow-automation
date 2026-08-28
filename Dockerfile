# ─────────────────────────────────────────────────────────────
# Multi-stage Dockerfile for Next.js 14 + Prisma 6
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ────────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy dependency files first for better Docker caching
COPY package.json package-lock.json ./

# Copy Prisma schema before npm install because postinstall may run prisma generate
COPY prisma ./prisma/

# Install ALL dependencies, including the Prisma CLI
RUN npm ci


# ── Stage 2: Build the application ───────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy installed dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the application
COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client explicitly
RUN ./node_modules/.bin/prisma generate

# Build Next.js
RUN npm run build


# ── Stage 3: Bundle Prisma CLI with full dependency tree ─────
# Prisma 6.x CLI has transitive deps (effect, @prisma/config, etc.)
# that change between versions. Instead of cherry-picking packages
# (which breaks when Prisma adds new deps), we let npm resolve the
# full dependency tree automatically.
FROM node:20-alpine AS prisma-deps

RUN apk add --no-cache libc6-compat openssl

WORKDIR /prisma-cli

# Read the exact installed Prisma version and do a clean install
COPY --from=deps /app/node_modules/prisma/package.json /tmp/prisma-ref.json

RUN PRISMA_VER=$(node -e "console.log(require('/tmp/prisma-ref.json').version)") && \
    echo "{\"dependencies\":{\"prisma\":\"${PRISMA_VER}\"}}" > package.json && \
    npm install && \
    rm -f /tmp/prisma-ref.json


# ── Stage 4: Production runner ───────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# 1. Copy Prisma CLI + all transitive deps (creates node_modules base)
COPY --from=prisma-deps --chown=nextjs:nodejs /prisma-cli/node_modules ./node_modules

# 2. Copy Next.js standalone server (merges its minimal node_modules on top)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 3. Copy static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 4. Copy public files
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 5. Copy Prisma schema (needed for migrate deploy)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# 6. Copy Prisma generated client
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Use the non-root user
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations using the locally installed Prisma 6 CLI, then start Next.js
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node server.js"]