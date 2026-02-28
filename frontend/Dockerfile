# syntax=docker/dockerfile:1.7
##############
# Build stage #
##############
FROM node:20-alpine AS builder
WORKDIR /app

# Install build deps for node-gyp if any package needs it
RUN apk add --no-cache python3 make g++

# Copy manifests and install deps (cacheable)
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
  if [ -f package-lock.json ]; then npm ci --legacy-peer-deps --no-audit --no-fund; else npm install --legacy-peer-deps --no-audit --no-fund; fi

# Copy source
COPY . .

# Build Angular app (production)
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/app/.angular/cache \
  npm run build -- --configuration production

###############
# Runtime NGINX #
###############
FROM nginx:alpine

# Copy built Angular app from builder
# Angular v20 outputs to dist/<project>/browser by default
COPY --from=builder /app/dist/management-frontend/browser /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1001 -S nginx_group \
 && adduser -S nginx_user -u 1001 -G nginx_group \
 && chown -R nginx_user:nginx_group /usr/share/nginx/html \
 && chown -R nginx_user:nginx_group /etc/nginx/conf.d

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
