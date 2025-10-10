#!/bin/bash

echo "==============================================="
echo "MEDIA DEBUG & FIX SCRIPT - Production Server"
echo "==============================================="
echo "Date: $(date)"
echo "Server: $(hostname)"
echo "User: $(whoami)"
echo "PWD: $(pwd)"
echo

# Function to print section headers
print_section() {
    echo
    echo "==================== $1 ===================="
}

# Function to run command with error handling
run_cmd() {
    echo "➤ $1"
    eval "$1" 2>&1 || echo "⚠ Command failed with exit code $?"
    echo
}

print_section "STEP 1: CHECK CURRENT STATUS"

run_cmd "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

run_cmd "ls -la ./"

run_cmd "ls -la ./media/ 2>/dev/null || echo 'Directory ./media does not exist'"

run_cmd "du -sh ./media/ 2>/dev/null || echo 'Cannot get media directory size'"

run_cmd "netstat -tulpn | grep ':8088' || echo 'Port 8088 not listening'"

print_section "STEP 2: CHECK CONTAINERS INTERNAL"

run_cmd "docker exec final8new-backend pwd"

run_cmd "docker exec final8new-backend ls -la /app/uploads/"

run_cmd "docker exec final8new-backend ls -la /app/uploads/media/ 2>/dev/null || echo 'Backend media dir not found'"

run_cmd "docker exec final8new-backend find /app/uploads/media/ -name '*.jpg' -o -name '*.png' -o -name '*.jpeg' | head -5 2>/dev/null || echo 'No image files found in backend'"

run_cmd "docker exec final8new-frontend ls -la /var/www/"

run_cmd "docker exec final8new-frontend ls -la /var/www/media/ 2>/dev/null || echo 'Frontend media dir not found'"

run_cmd "docker exec final8new-frontend find /var/www/media/ -name '*.jpg' -o -name '*.png' -o -name '*.jpeg' | head -5 2>/dev/null || echo 'No image files found in frontend'"

print_section "STEP 3: CHECK API ENDPOINTS"

run_cmd "docker exec final8new-backend curl -s http://localhost:3000/health || echo 'Backend health check failed'"

run_cmd "docker exec final8new-backend curl -s 'http://localhost:3000/api/media?limit=3' | head -200"

print_section "STEP 4: CHECK NGINX CONFIG"

run_cmd "docker exec final8new-frontend nginx -t"

run_cmd "docker exec final8new-frontend cat /etc/nginx/conf.d/default.conf | grep -A 15 -B 5 'location /media'"

print_section "STEP 5: TEST STATIC FILE SERVING"

# Get a sample file from database
SAMPLE_URL=$(docker exec final8new-backend curl -s 'http://localhost:3000/api/media?limit=1' 2>/dev/null | grep -o '"/media/[^"]*"' | head -1 | tr -d '"')

if [ -n "$SAMPLE_URL" ]; then
    echo "Sample URL from database: $SAMPLE_URL"
    
    run_cmd "docker exec final8new-backend curl -I http://localhost:3000$SAMPLE_URL"
    
    run_cmd "docker exec final8new-frontend curl -I http://localhost$SAMPLE_URL"
else
    echo "No sample URL found in database"
fi

print_section "STEP 6: CHECK LOGS"

run_cmd "docker logs final8new-backend --tail 10"

run_cmd "docker logs final8new-frontend --tail 10"

print_section "STEP 7: APPLY FIXES"

echo "Creating media directory structure..."
run_cmd "mkdir -p ./media/2025/10 ./media/2025/11 ./media/2025/12"

echo "Setting permissions..."
run_cmd "chown -R 1000:1000 ./media/ 2>/dev/null || sudo chown -R 1000:1000 ./media/"
run_cmd "chmod -R 755 ./media/"

echo "Restarting containers..."
run_cmd "docker compose -p final8local -f docker-compose.server.full.yml down"

echo "Waiting 3 seconds..."
sleep 3

run_cmd "docker compose -p final8local -f docker-compose.server.full.yml up -d"

echo "Waiting 20 seconds for containers to start..."
sleep 20

print_section "STEP 8: VERIFY FIXES"

run_cmd "docker ps --format 'table {{.Names}}\t{{.Status}}'"

run_cmd "timeout 30 bash -c 'until docker exec final8new-backend curl -s http://localhost:3000/health >/dev/null 2>&1; do echo \"Waiting for backend...\"; sleep 2; done' && echo 'Backend is ready'"

run_cmd "timeout 30 bash -c 'until docker exec final8new-frontend curl -s http://localhost >/dev/null 2>&1; do echo \"Waiting for frontend...\"; sleep 2; done' && echo 'Frontend is ready'"

run_cmd "docker exec final8new-frontend nginx -s reload"

print_section "STEP 9: FINAL TEST"

run_cmd "docker exec final8new-backend curl -s 'http://localhost:3000/api/media?limit=1' | head -100"

# Test external access if possible
EXTERNAL_URL="http://$(hostname -I | awk '{print $1}'):8088"
run_cmd "curl -I $EXTERNAL_URL/api/media 2>/dev/null || echo 'External access test failed (normal if firewall blocks)'"

print_section "ALTERNATIVE FIX - NGINX PROXY"

echo "If static serving still fails, applying nginx proxy config..."

cat > /tmp/nginx_media_proxy.txt << 'EOF'
    # Proxy media requests to backend
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
EOF

run_cmd "cat /tmp/nginx_media_proxy.txt"

echo "To apply this fix, run:"
echo "docker exec final8new-frontend cp /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.backup"
echo "Then manually edit the nginx config to replace the static media location with the proxy config above"

print_section "COMPLETE"

echo "==============================================="
echo "DIAGNOSTIC AND FIX COMPLETE"
echo "==============================================="
echo "Summary:"
echo "1. Check if media directories exist and have correct permissions"
echo "2. Verify containers are running and healthy" 
echo "3. Test API endpoints and static file serving"
echo "4. Applied fixes: created directories, set permissions, restarted containers"
echo "5. If still failing, consider nginx proxy alternative"
echo
echo "Next steps:"
echo "1. Copy this output and send back for analysis"
echo "2. Test accessing your domain:8088/media to see if it works"
echo "3. Try clicking on an image in the media manager"
echo
echo "==============================================="