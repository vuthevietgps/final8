# syntax=docker/dockerfile:1.7
# Backend (NestJS) Dockerfile

FROM node:18-alpine AS base
WORKDIR /app

# Install build deps
RUN apk add --no-cache python3 make g++

# Copy manifests first for better caching
COPY package.json package-lock.json* ./
COPY nest-cli.json tsconfig*.json ./

# Install dependencies with npm cache mount to speed up cold builds
RUN --mount=type=cache,target=/root/.npm \
  if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi

# Copy source
COPY ./src ./src
COPY ./dongbodulieuweb-8de0c9a12896.json ./

# Build using cache mount for ts incremental (if any)
RUN --mount=type=cache,target=/root/.npm \
  npx nest build

# Runtime image
FROM node:18-alpine AS runtime
WORKDIR /app

# Only copy runtime bits
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
  if [ -f package-lock.json ]; then npm ci --omit=dev --legacy-peer-deps; else npm install --omit=dev --legacy-peer-deps; fi

COPY --from=base /app/dist ./dist
COPY --from=base /app/dongbodulieuweb-8de0c9a12896.json ./
RUN mkdir -p /app/uploads

# Tools for healthcheck
RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
