# Multi-stage build: build frontend with Vite, run server with Bun

# Stage 1: build frontend assets
FROM oven/bun:1.4.2 AS builder
WORKDIR /build
COPY package.json bun.lock ./
COPY web ./web
RUN bun install --frozen-lockfile && bun run build

# Stage 2: runtime using Bun
FROM oven/bun:1.4.2
WORKDIR /app
COPY --from=builder /build/dist/. ./dist/
COPY api ./api
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile
EXPOSE 3000
CMD ["bun", "run", "api/server.js"]
