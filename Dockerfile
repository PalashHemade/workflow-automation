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


# ── Stage 3: Production runner ───────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy Next.js standalone server
COPY --from=builder /app/.next/standalone ./

# Copy static files
COPY --from=builder /app/.next/static ./.next/static

# Copy public files
COPY --from=builder /app/public ./public

# Install Prisma CLI with ALL transitive dependencies directly in the runner.
# Prisma 6.x has a deep dep tree (effect, @prisma/config, @prisma/engines, etc.)
# that changes between versions. Running npm install here lets npm resolve the
# full tree automatically — no fragile cherry-picking.
COPY --from=deps /app/node_modules/prisma/package.json /tmp/prisma-ref.json
RUN PRISMA_VER=$(node -e "console.log(require('/tmp/prisma-ref.json').version)") && \
    npm install --no-save "prisma@${PRISMA_VER}" && \
    rm -f /tmp/prisma-ref.json && \
    rm -rf /root/.npm

# Copy Prisma schema (needed for migrate deploy)
COPY --from=builder /app/prisma ./prisma

# Copy Prisma generated client and runtime from the build stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Fix ownership for the non-root user
RUN chown -R nextjs:nodejs /app

ENV NODE_ENV=production

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations using the locally installed Prisma 6 CLI, then start Next.js
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node server.js"]