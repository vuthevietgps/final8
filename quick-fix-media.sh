#!/bin/bash

echo "=== QUICK FIX FOR MEDIA SERVING ==="

# 1. Test static file directly
echo "1. Testing static file directly:"
docker exec final8new-frontend ls -la /var/www/media/2025/10/
docker exec final8new-frontend cat /var/www/media/2025/10/simple.jpg | wc -c

# 2. Test nginx serving internally
echo "2. Testing nginx internal serving:"
docker exec final8new-frontend wget -qO- http://localhost/media/2025/10/simple.jpg | wc -c

# 3. Check nginx error logs
echo "3. Check nginx error logs:"
docker exec final8new-frontend tail -10 /var/log/nginx/error.log 2>/dev/null || echo "No error logs"

# 4. Apply nginx proxy fix (bypass static serving)
echo "4. Applying nginx proxy fix..."

docker exec final8new-frontend cp /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.backup

cat > /tmp/nginx_fix.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # PROXY MEDIA TO BACKEND (FIX FOR STATIC SERVING ISSUE)
    location /media/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Add CORS headers for media files
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";
    }

    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Handle Angular routing
    location / {
        try_files $uri $uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Error pages
    error_page 404 /index.html;
    error_page 500 502 503 504 /index.html;
}
EOF

# Copy new config into container
docker cp /tmp/nginx_fix.conf final8new-frontend:/etc/nginx/conf.d/default.conf

# Test and reload
echo "5. Testing new nginx config:"
docker exec final8new-frontend nginx -t

if [ $? -eq 0 ]; then
    echo "6. Reloading nginx..."
    docker exec final8new-frontend nginx -s reload
    echo "✅ Nginx reloaded successfully"
    
    echo "7. Testing media access after fix:"
    sleep 2
    curl -I http://localhost:8088/media/2025/10/simple.jpg
    
    echo ""
    echo "✅ MEDIA FIX APPLIED!"
    echo "Now media requests will be proxied to backend instead of served as static files"
    echo "Test by accessing: https://htxbachgia.shop/media/2025/10/simple.jpg"
else
    echo "❌ Nginx config error, restoring backup..."
    docker exec final8new-frontend cp /etc/nginx/conf.d/default.conf.backup /etc/nginx/conf.d/default.conf
    docker exec final8new-frontend nginx -s reload
fi