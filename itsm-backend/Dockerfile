# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (layer cache)
COPY package*.json ./

# Install ALL deps (including devDeps needed for nest build)
RUN npm ci

# Copy source
COPY . .

# Compile TypeScript → dist/
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy package manifests
COPY package*.json ./

# Install production deps only and make healthcheck tools available
RUN npm ci --omit=dev && npm cache clean --force && apk add --no-cache wget

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

EXPOSE 4000

# Run migrations then start the server
CMD ["sh", "-c", "npm run migration:run:prod && node dist/main"]
