# Stage 1: Build the Angular application
FROM node:20-alpine as build

WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

# Copy the rest of the application files
COPY frontend/. .

# Build the application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy the build output to the Nginx html directory
COPY --from=build /app/dist/management-frontend/browser /usr/share/nginx/html

# Copy the nginx.conf
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80
