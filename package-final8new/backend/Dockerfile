# Backend (NestJS) Dockerfile

FROM node:18-alpine AS base
WORKDIR /app

# Install build deps
RUN apk add --no-cache python3 make g++

# Copy manifests first for better caching
COPY package.json package-lock.json* ./
COPY nest-cli.json tsconfig*.json ./

# Install dependencies
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi

# Copy source
COPY ./src ./src
COPY ./GOOGLE_SYNC_SETUP.md ./

# Build
RUN npx nest build

# Runtime image
FROM node:18-alpine AS runtime
WORKDIR /app

# Only copy runtime bits
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --legacy-peer-deps; else npm install --omit=dev --legacy-peer-deps; fi

COPY --from=base /app/dist ./dist
RUN mkdir -p /app/uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
