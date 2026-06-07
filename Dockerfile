# ─── Stage 1: Install dependencies ──────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only manifests first — layer is cached until package files change
COPY package*.json ./
RUN npm ci --only=production

# ─── Stage 2: Run tests ───────────────────────────────────────────────────────
FROM node:20-alpine AS test

WORKDIR /app

COPY package*.json ./
RUN npm ci                   # includes devDependencies for Jest/Supertest

COPY src/ ./src/
COPY tests/ ./tests/

RUN npm test

# ─── Stage 3: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy production deps from Stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy source (no tests, no devDeps)
COPY src/ ./src/
COPY package.json ./

# Switch to non-root user
USER appuser

EXPOSE 3000

# Graceful startup via tini (Alpine ships it as /sbin/tini is not needed; use node directly)
CMD ["node", "src/server.js"]
