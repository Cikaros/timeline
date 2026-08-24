# Multi-stage build: build frontend with Vite, run server with Bun

# Stage 1: build frontend assets
FROM oven/bun:latest AS builder
WORKDIR /build
COPY package.json ./
COPY web ./web
RUN bun i && cd web && bun run build

# Stage 2: runtime using Bun
FROM oven/bun:latest
WORKDIR /app
COPY --from=builder /build/web/dist/. ./
COPY api ./api
COPY package.json ./
RUN bun i --production
EXPOSE 3000
CMD ["bun", "run", "api/server.js"]