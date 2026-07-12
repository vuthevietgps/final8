# Stage 1: Build the NestJS application
FROM node:20-alpine as build

WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
COPY backend/package.json backend/package-lock.json ./
RUN npm install

# Copy the rest of the application files
COPY backend/. .

# Build the application
RUN npm run build

# Stage 2: Production environment
FROM node:20-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY backend/package.json backend/package-lock.json ./
# Install production dependencies
RUN npm install --omit=dev

# Copy the built application from the build stage
COPY --from=build /app/dist ./dist
COPY docs/ai-ads-v2/contracts ./docs/ai-ads-v2/contracts

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["node", "dist/main"]
