# Stage 1: Build the NestJS application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

# Copy the rest of the application files
COPY backend/tsconfig*.json backend/nest-cli.json ./
COPY backend/src ./src

# Build the application
RUN npm run build

# Stage 2: Production environment
FROM node:20-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY backend/package.json backend/package-lock.json ./
# Install production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy the built application from the build stage
COPY --from=build /app/dist ./dist
COPY docs/ai-ads-v2/contracts ./docs/ai-ads-v2/contracts

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["node", "dist/main"]
