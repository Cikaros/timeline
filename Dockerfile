# Multi-stage build: build frontend with Node, run server with Bun

# Stage 1: build frontend assets with node (Vite)
FROM oven/bun:latest AS builder
WORKDIR /build
# copy package.json and install deps for building
COPY package.json package-lock.json* ./
# copy source and build
COPY . .
RUN bun i &&bun run build

# Stage 2: runtime using Bun (official image)
FROM oven/bun:latest
WORKDIR /app
# copy built frontend output (dist) into app root
COPY --from=builder /build/dist/. ./
# copy backend server and shared modules
COPY --from=builder /build/server.js ./
COPY --from=builder /build/shared ./shared
# Copy any other non-built assets that server might serve directly from project root
# (if you have public/ or other static files placed outside dist, add them here)

# expose port used by Bun server
EXPOSE 3000

# Use Bun to run the server (server.js uses Bun.serve)
CMD ["bun", "run", "server.js"]
