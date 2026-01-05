#!/bin/bash

# Deploy script for htxbachgia.shop using vutheviet/final8new images
# Usage:
#   ./deploy-htxbachgia.sh                 # uses default tag (current tested)
#   ./deploy-htxbachgia.sh version13.0       # positional tag
#   ./deploy-htxbachgia.sh --tag version13.0 # explicit tag
#   ./deploy-htxbachgia.sh --use-latest    # use :latest tags
#
# Notes:
# - The script verifies that the chosen tags exist in the registry before deploying.
# - It prints pulled image digests so you can compare with your Docker Desktop test.

DOMAIN="htxbachgia.shop"
PORT="8090"
CONTAINER_NAME=$(echo $DOMAIN | sed 's/\./-/g')

BACKEND_IMAGE_BASE="vutheviet/final8new"
FRONTEND_IMAGE_BASE="vutheviet/final8new"

# Accept optional tag argument, default to version13.0 (current tested version)
# Also supports flags: --tag/-t <tag>, --use-latest
TAG_IN=""
EXPECT_BACKEND_DIGEST=""
EXPECT_FRONTEND_DIGEST=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tag|-t)
      TAG_IN="$2"; shift 2 ;;
    --use-latest)
      TAG_IN="latest"; shift ;;
    --expect-backend-digest)
      EXPECT_BACKEND_DIGEST="$2"; shift 2 ;;
    --expect-frontend-digest)
      EXPECT_FRONTEND_DIGEST="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [TAG] | --tag <TAG> | --use-latest [--expect-backend-digest <sha256:...>] [--expect-frontend-digest <sha256:...>]"; exit 0 ;;
    *)
      # If positional arg provided and TAG not set yet, treat as tag
      if [ -z "$TAG_IN" ]; then TAG_IN="$1"; fi
      shift ;;
  esac
done

if [ -z "$TAG_IN" ]; then TAG_IN="version13.0"; fi
BACKEND_TAG="$TAG_IN"
FRONTEND_TAG="$TAG_IN"

echo "🏷️  Using image tags: backend=$BACKEND_TAG, frontend=$FRONTEND_TAG"

// Auto-set expected digests from the latest Desktop build & push when not provided
if [ -z "$EXPECT_BACKEND_DIGEST" ] && [ -z "$EXPECT_FRONTEND_DIGEST" ]; then
  if [ "$TAG_IN" = "version13.0" ]; then
    echo "🔒 No predefined digests for version13.0; please verify manually or pass --expect-* flags"
  elif [ "$TAG_IN" = "version12.0" ]; then
    EXPECT_BACKEND_DIGEST="sha256:4d050bdaa8ad2532537b58c1e8f5030c25f6f52de3e2ca96e4d1fa32caed8e78"
    EXPECT_FRONTEND_DIGEST="sha256:5205aedac00b8f28fa0a612fd91ccae521aa800aa433d275ffc50ee19efc3d81"
    echo "🔒 Auto-set expected digests for version12.0 to:" 
    echo "   backend:  $EXPECT_BACKEND_DIGEST"
    echo "   frontend: $EXPECT_FRONTEND_DIGEST"
  elif [ "$TAG_IN" = "version11.0" ]; then
    EXPECT_BACKEND_DIGEST="sha256:4ad9a0a842080574149576bde1168792daaba34a6093be716c364471f0ec7d1b"
    EXPECT_FRONTEND_DIGEST="sha256:45d19b4d2a1318740cbc803ae32b1303524db1e9e25a71edba1d8a2e8546da5a"
    echo "🔒 Auto-set expected digests for version11.0 to:" 
    echo "   backend:  $EXPECT_BACKEND_DIGEST"
    echo "   frontend: $EXPECT_FRONTEND_DIGEST"
  elif [ "$TAG_IN" = "version10.0" ]; then
    EXPECT_BACKEND_DIGEST="sha256:64f7799b54cb86f29252cd21f45ec2633dc31e94c0836468478bc2d653f54656"
    EXPECT_FRONTEND_DIGEST="sha256:d68197fad82fe17f40c5f25cb83fd4e32cf1f288ee4768044a2c05d98e48518e"
    echo "🔒 Auto-set expected digests for version10.0 to:" 
    echo "   backend:  $EXPECT_BACKEND_DIGEST"
    echo "   frontend: $EXPECT_FRONTEND_DIGEST"
  elif [ "$TAG_IN" = "version9.0" ]; then
    EXPECT_BACKEND_DIGEST="sha256:d74f68eaecfb93567ad1957619d3482795ced8f0cb8453cc47129c3b54c1de01"
    EXPECT_FRONTEND_DIGEST="sha256:0d0f4a434a8a43375bb7d2a3373657d5dab23bd33779adc0403819f8658bc2e5"
    echo "🔒 Auto-set expected digests for version9.0 to:" 
    echo "   backend:  $EXPECT_BACKEND_DIGEST"
    echo "   frontend: $EXPECT_FRONTEND_DIGEST"
  fi
fi

echo "🚀 Complete deployment for $DOMAIN on port $PORT..."
if [ "$TAG_IN" = "version13.0" ]; then
  echo "📝 Changes in this deployment (v13.0):"
  echo "  - Bump UI badge to version13.0"
  echo "  - Build/Deploy: images rebuilt --no-cache and tagged :backend-version13.0, :frontend-version13.0"
elif [ "$TAG_IN" = "version12.0" ]; then
  echo "📝 Changes in this deployment (v12.0):"
  echo "  - Bump UI badge to version12.0"
  echo "  - Build/Deploy: images rebuilt --no-cache and tagged :backend-version12.0, :frontend-version12.0"
elif [ "$TAG_IN" = "version11.0" ]; then
  echo "📝 Changes in this deployment (v11.0):"
  echo "  - Auto-control Quảng cáo: tách khỏi fanpage, dùng token theo Tài khoản quảng cáo (hard pause qua Graph API)"
  echo "  - Token tools: kiểm tra token với ad account và lưu adAccountId/name khi hợp lệ"
  echo "  - Đồng bộ chi phí: endpoint đồng bộ theo danh sách tài khoản quảng cáo, tuỳ chọn dọn dẹp"
  echo "  - UI: xoá hoàn toàn AI/Khuyến mại khỏi Nhóm QC; đổi nút thành ‘Đồng bộ từ Tài khoản quảng cáo’; badge version11.0"
  echo "  - Build/Deploy: images rebuilt --no-cache và đẩy lên :backend-version11.0, :frontend-version11.0"
elif [ "$TAG_IN" = "version10.0" ]; then
  echo "📝 Changes in this deployment (v10.0):"
  echo "  - UI: cập nhật badge version10.0 và sửa thu gọn sidebar mở rộng nội dung"
  echo "  - Chat: giao diện 3 cột (danh sách – hội thoại – đơn hàng), tô màu trạng thái danh sách"
  echo "  - Order Update: sửa đếm kết quả (no-op → skipped), cập nhật chuẩn tracking có số 0 đầu"
  echo "  - Auth: bỏ bắt buộc IP đăng nhập (có thể bật lại bằng AUTH_ENABLE_IP_RESTRICTION=true)"
  echo "  - Build: docker images rebuilt with --no-cache and pushed as :version10.0"
else
  echo "📝 Changes in this deployment (v9.0):"
  echo "  - UI: badge version9.0"
  echo "  - Improved Excel-based order updates (leading zeros, status merge)"
  echo "  - Docker images rebuilt with --no-cache and pushed as :version9.0"
  echo "  - Keep previous features: media serving hardening, chat media picker, Excel import dedup"
fi
echo ""

# 0. Backup existing data before any changes
echo "💾 Creating backup of existing data..."
BACKUP_DIR="/opt/backups/htxbachgia-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"

# Get current working directory as deployment base
DEPLOY_BASE=$(pwd)
echo "📁 Using deployment base: $DEPLOY_BASE"

# Backup media files if they exist
if [ -d "${DEPLOY_BASE}/${CONTAINER_NAME}/media" ]; then
    echo "  📁 Backing up media files..."
    sudo tar -czf "$BACKUP_DIR/media-backup.tar.gz" -C "${DEPLOY_BASE}/${CONTAINER_NAME}" media/ 2>/dev/null || true
fi

# Backup backend uploads if they exist
if [ -d "${DEPLOY_BASE}/${CONTAINER_NAME}/backend/uploads" ]; then
    echo "  📁 Backing up backend uploads..."
    sudo tar -czf "$BACKUP_DIR/backend-uploads-backup.tar.gz" -C "${DEPLOY_BASE}/${CONTAINER_NAME}" backend/uploads/ 2>/dev/null || true
fi

# Backup current docker-compose.yml if exists
if [ -d "${DEPLOY_BASE}/${CONTAINER_NAME}" ] && [ -f "${DEPLOY_BASE}/${CONTAINER_NAME}/docker-compose.yml" ]; then
    echo "  📄 Backing up docker-compose.yml..."
    sudo cp "${DEPLOY_BASE}/${CONTAINER_NAME}/docker-compose.yml" "$BACKUP_DIR/docker-compose-backup.yml"
fi

# Export current running containers as images for rollback
if sudo docker ps -q --filter "name=${CONTAINER_NAME}-backend" | grep -q .; then
    echo "  🐳 Backing up current backend container..."
    sudo docker commit ${CONTAINER_NAME}-backend htxbachgia-backup-backend:$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
fi

if sudo docker ps -q --filter "name=${CONTAINER_NAME}-frontend" | grep -q .; then
    echo "  🐳 Backing up current frontend container..."
    sudo docker commit ${CONTAINER_NAME}-frontend htxbachgia-backup-frontend:$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
fi

echo "✅ Backup completed: $BACKUP_DIR"

# 0.5. Pre-flight: verify chosen tags exist in registry
echo "🔎 Verifying images exist in registry..."
if ! sudo docker manifest inspect ${BACKEND_IMAGE_BASE}:backend-${BACKEND_TAG} >/dev/null 2>&1; then
  echo "❌ Backend image tag not found: ${BACKEND_IMAGE_BASE}:backend-${BACKEND_TAG}"
  echo "   Please push this tag from Docker Desktop or use --tag with an available tag."
  exit 1
fi
if ! sudo docker manifest inspect ${FRONTEND_IMAGE_BASE}:frontend-${FRONTEND_TAG} >/dev/null 2>&1; then
  echo "❌ Frontend image tag not found: ${FRONTEND_IMAGE_BASE}:frontend-${FRONTEND_TAG}"
  echo "   Please push this tag from Docker Desktop or use --tag with an available tag."
  exit 1
fi
echo "✅ Tags found in registry"

# 1. Stop and remove existing containers gracefully
echo "🛑 Stopping existing containers gracefully..."
if [ -d "${DEPLOY_BASE}/${CONTAINER_NAME}" ]; then
    cd "${DEPLOY_BASE}/${CONTAINER_NAME}" 2>/dev/null || true
    
    # Try docker-compose down first if compose file exists
    if [ -f "docker-compose.yml" ]; then
        echo "  📋 Using docker-compose to stop services..."
        if command -v docker-compose >/dev/null 2>&1; then
            sudo timeout 60 docker-compose down --timeout 30 || sudo docker-compose kill
        elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
            sudo timeout 60 docker compose down --timeout 30 || sudo docker compose kill
        fi
    fi
fi

# Force stop any remaining containers
echo "🧹 Cleaning up existing containers and (old) images..."
sudo docker stop ${CONTAINER_NAME}-frontend ${CONTAINER_NAME}-backend 2>/dev/null || true
sudo docker stop htxbachgia-shop-frontend htxbachgia-shop-backend 2>/dev/null || true
sudo docker rm -f ${CONTAINER_NAME}-frontend ${CONTAINER_NAME}-backend 2>/dev/null || true
sudo docker rm -f htxbachgia-shop-frontend htxbachgia-shop-backend 2>/dev/null || true

# Remove old erpfinal8 images if any
sudo docker rmi -f $(sudo docker images 'vutheviet/erpfinal8' -q) 2>/dev/null || true

# Clean old backup images (keep only last 3)
echo "  🗑️ Cleaning old backup images (keeping last 3)..."
sudo docker images htxbachgia-backup-* --format "{{.Repository}}:{{.Tag}}" | sort -r | tail -n +7 | xargs -r sudo docker rmi -f 2>/dev/null || true

# Remove old networks if exists
sudo docker network rm ${CONTAINER_NAME}_default ${CONTAINER_NAME}_app-network htxbachgia-shop_default htxbachgia-shop_app-network 2>/dev/null || true

# 2. Prepare deployment directory
echo "📁 Preparing deployment directory..."
cd "$DEPLOY_BASE"

# Preserve media files before removing directory
TEMP_MEDIA="/tmp/htxbachgia-media-$(date +%Y%m%d-%H%M%S)"
if [ -d "${CONTAINER_NAME}/media" ] && [ "$(ls -A ${CONTAINER_NAME}/media 2>/dev/null)" ]; then
    echo "  💾 Temporarily preserving media files..."
    sudo mv "${CONTAINER_NAME}/media" "$TEMP_MEDIA" || true
fi

TEMP_UPLOADS="/tmp/htxbachgia-uploads-$(date +%Y%m%d-%H%M%S)"
if [ -d "${CONTAINER_NAME}/backend/uploads" ] && [ "$(ls -A ${CONTAINER_NAME}/backend/uploads 2>/dev/null)" ]; then
    echo "  💾 Temporarily preserving upload files..."
    sudo mv "${CONTAINER_NAME}/backend/uploads" "$TEMP_UPLOADS" || true
fi

# Remove and recreate directory
sudo rm -rf $CONTAINER_NAME
sudo mkdir -p $CONTAINER_NAME
cd $CONTAINER_NAME

# 3. Create docker-compose.yml
echo "📝 Creating docker-compose.yml..."
sudo tee docker-compose.yml > /dev/null <<EOF
services:
  backend:
    image: ${BACKEND_IMAGE_BASE}:backend-${BACKEND_TAG}
    container_name: ${CONTAINER_NAME}-backend
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - BACKEND_ROOT=/app
      - MEDIA_DIR=/app/uploads/media
      - MEDIA_PUBLIC_BASE=/media
      - PUBLIC_ORIGIN=https://${DOMAIN}
      - FB_SENDING_ENABLED=1
      - CHAT_WEBHOOK_DEBUG=1
    volumes:
      - ./backend/uploads:/app/uploads
      - ./media:/app/uploads/media
    expose:
      - "3000"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 20s
    networks:
      - app-network

  frontend:
    image: ${FRONTEND_IMAGE_BASE}:frontend-${FRONTEND_TAG}
    container_name: ${CONTAINER_NAME}-frontend
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    volumes:
      - ./media:/var/www/media:ro
    ports:
      - "${PORT}:80"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${CONTAINER_NAME}.rule=Host(\`${DOMAIN}\`) || Host(\`www.${DOMAIN}\`)"
      - "traefik.http.routers.${CONTAINER_NAME}.entrypoints=websecure"
      - "traefik.http.services.${CONTAINER_NAME}.loadbalancer.server.port=80"
      - "traefik.http.routers.${CONTAINER_NAME}-http.rule=Host(\`${DOMAIN}\`) || Host(\`www.${DOMAIN}\`)"
      - "traefik.http.routers.${CONTAINER_NAME}-http.entrypoints=web"
      - "traefik.http.routers.${CONTAINER_NAME}-http.middlewares=redirect-to-https"
      - "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"
    networks:
      - app-network
      - traefik-network

networks:
  app-network:
    driver: bridge
  traefik-network:
    external: true
EOF

# 4. Create directories and restore preserved files
sudo mkdir -p backend/uploads media

# Restore preserved media files
if [ -d "$TEMP_MEDIA" ]; then
    echo "  📁 Restoring preserved media files..."
    sudo cp -r "$TEMP_MEDIA"/* media/ 2>/dev/null || true
    sudo rm -rf "$TEMP_MEDIA"
fi

# Restore preserved upload files
if [ -d "$TEMP_UPLOADS" ]; then
    echo "  📁 Restoring preserved upload files..."
    sudo cp -r "$TEMP_UPLOADS"/* backend/uploads/ 2>/dev/null || true
    sudo rm -rf "$TEMP_UPLOADS"
fi

sudo chown -R www-data:www-data .

# 5. Pull fresh images with retry mechanism
echo "📥 Pulling images with retry..."
for i in {1..3}; do
    echo "  🔄 Pull attempt $i/3..."
    if sudo docker pull ${BACKEND_IMAGE_BASE}:backend-${BACKEND_TAG} && sudo docker pull ${FRONTEND_IMAGE_BASE}:frontend-${FRONTEND_TAG}; then
  echo "  ✅ Images pulled successfully"
        break
    else
        echo "  ❌ Pull failed, retrying in 10 seconds..."
        sleep 10
    fi
    if [ $i -eq 3 ]; then
        echo "  ⚠️ Failed to pull images after 3 attempts. Continuing with existing images if available..."
    fi
done

# Show image digests to compare with Docker Desktop
echo "🔐 Image digests (for verification against Docker Desktop):"
BACKEND_DIGEST_FULL=$(sudo docker inspect --format='{{index .RepoDigests 0}}' ${BACKEND_IMAGE_BASE}:backend-${BACKEND_TAG} 2>/dev/null || true)
FRONTEND_DIGEST_FULL=$(sudo docker inspect --format='{{index .RepoDigests 0}}' ${FRONTEND_IMAGE_BASE}:frontend-${FRONTEND_TAG} 2>/dev/null || true)
echo "backend -> ${BACKEND_DIGEST_FULL}"
echo "frontend -> ${FRONTEND_DIGEST_FULL}"

# Extract sha256 from full digest (repo@sha256:abcd...)
BACKEND_SHA=$(echo "$BACKEND_DIGEST_FULL" | awk -F'@' '{print $2}' | tr -d '\n')
FRONTEND_SHA=$(echo "$FRONTEND_DIGEST_FULL" | awk -F'@' '{print $2}' | tr -d '\n')

if [ -n "$EXPECT_BACKEND_DIGEST" ]; then
  if [ "$BACKEND_SHA" != "$EXPECT_BACKEND_DIGEST" ] && [ "$BACKEND_DIGEST_FULL" != "$EXPECT_BACKEND_DIGEST" ]; then
    echo "❌ Backend digest mismatch!"
    echo "   Expected: $EXPECT_BACKEND_DIGEST"
    echo "   Actual:   ${BACKEND_DIGEST_FULL}"
    exit 1
  else
    echo "✅ Backend digest matches expected."
  fi
fi

if [ -n "$EXPECT_FRONTEND_DIGEST" ]; then
  if [ "$FRONTEND_SHA" != "$EXPECT_FRONTEND_DIGEST" ] && [ "$FRONTEND_DIGEST_FULL" != "$EXPECT_FRONTEND_DIGEST" ]; then
    echo "❌ Frontend digest mismatch!"
    echo "   Expected: $EXPECT_FRONTEND_DIGEST"
    echo "   Actual:   ${FRONTEND_DIGEST_FULL}"
    exit 1
  else
    echo "✅ Frontend digest matches expected."
  fi
fi

# 6. Start containers (backend first, wait healthy, then frontend)
echo "🚀 Starting containers (backend first)..."
USE_COMPOSE_V2=false
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  USE_COMPOSE_V2=true
elif command -v docker-compose >/dev/null 2>&1; then
  USE_COMPOSE_V2=false
else
  echo "❌ Neither docker compose (v2) nor docker-compose found!"; exit 1
fi

if [ "$USE_COMPOSE_V2" = true ]; then
  echo "  📋 Using docker compose (v2)..."
  sudo docker compose up -d backend
else
  echo "  📋 Using docker-compose (legacy)..."
  sudo docker-compose up -d backend
fi

# Wait for backend to be healthy to avoid frontend dependency failure
echo "⏳ Waiting for backend health (up to 3 minutes)..."
ATTEMPTS=36
SLEEP_SEC=5
HEALTH="starting"
for i in $(seq 1 $ATTEMPTS); do
  HEALTH=$(sudo docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' ${CONTAINER_NAME}-backend 2>/dev/null || echo "unknown")
  echo "   Attempt $i/$ATTEMPTS: backend health = $HEALTH"
  if [ "$HEALTH" = "healthy" ]; then
    echo "✅ Backend is healthy"; break
  fi
  if [ "$HEALTH" = "unhealthy" ] && [ $i -gt 6 ]; then
    echo "❌ Backend reported unhealthy. Showing last 120 log lines:";
    sudo docker logs ${CONTAINER_NAME}-backend --tail 120 || true
  fi
  sleep $SLEEP_SEC
done

if [ "$HEALTH" != "healthy" ]; then
  echo "❌ Backend did not become healthy in time. Aborting before starting frontend."
  exit 1
fi

echo "🚀 Starting frontend..."
if [ "$USE_COMPOSE_V2" = true ]; then
  sudo docker compose up -d frontend
else
  sudo docker-compose up -d frontend
fi

# Check if containers actually started
echo "📊 Checking container status..."
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E "${CONTAINER_NAME}-(frontend|backend)" || echo "⚠️ No containers found running!"

# Show logs if containers failed
if ! sudo docker ps | grep -q "${CONTAINER_NAME}-backend"; then
  echo "❌ Backend container not running. Recent logs:"
  sudo docker logs ${CONTAINER_NAME}-backend --tail 10 2>/dev/null || echo "No backend logs available"
fi

if ! sudo docker ps | grep -q "${CONTAINER_NAME}-frontend"; then
  echo "❌ Frontend container not running. Recent logs:"
  sudo docker logs ${CONTAINER_NAME}-frontend --tail 10 2>/dev/null || echo "No frontend logs available"
fi

# 7. Clean Cloudflare tunnel config completely (if cloudflared config exists)
if [ -f /etc/cloudflared/config.yml ]; then
  echo "📝 Cleaning ALL tunnel entries for $DOMAIN..."
  # Create backup first
  sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.backup.$(date +%Y%m%d_%H%M%S)

  # Remove ALL entries for this domain (including duplicates)
  sudo sed -i "/- hostname: $DOMAIN$/,+5d" /etc/cloudflared/config.yml 2>/dev/null || true
  sudo sed -i "/- hostname: www\.$DOMAIN$/,+5d" /etc/cloudflared/config.yml 2>/dev/null || true
  sudo sed -i "/- hostname: api\.$DOMAIN$/,+5d" /etc/cloudflared/config.yml 2>/dev/null || true
  sudo sed -i "/- hostname: landing\.$DOMAIN$/,+5d" /etc/cloudflared/config.yml 2>/dev/null || true

  # Run multiple times to catch all duplicates
  sudo sed -i "/- hostname: $DOMAIN$/,+5d" /etc/cloudflared/config.yml 2>/dev/null || true
  sudo sed -i "/- hostname: www\.$DOMAIN$/,+5d" /etc/cloudflared/config.yml 2>/dev/null || true

  echo "📝 Adding clean tunnel config for $DOMAIN on port $PORT..."
  sudo sed -i "/- service: http_status:404/i\\
  - hostname: $DOMAIN\\
    service: http://127.0.0.1:$PORT\\
    originRequest:\\
      noTLSVerify: true\\
      connectTimeout: 30s\\
      tlsTimeout: 30s\\
  - hostname: www.$DOMAIN\\
    service: http://127.0.0.1:$PORT\\
    originRequest:\\
      noTLSVerify: true\\
      connectTimeout: 30s\\
      tlsTimeout: 30s" /etc/cloudflared/config.yml 2>/dev/null || true
else
  echo "⚠️ cloudflared config '/etc/cloudflared/config.yml' not found; skipping tunnel cleanup."
fi

# 8. Restart tunnel properly (only if config exists)
if [ -f /etc/cloudflared/config.yml ]; then
  echo "🔄 Restarting Cloudflare tunnel..."
  sudo systemctl stop cloudflared || true
  sleep 5
  sudo systemctl start cloudflared || true
  sleep 10

  # Verify tunnel is running and check config
  if sudo systemctl is-active --quiet cloudflared; then
      echo "✅ Cloudflare tunnel restarted successfully"
      echo "📝 Verifying tunnel config..."
      sudo grep -A 5 "hostname: $DOMAIN" /etc/cloudflared/config.yml || echo "Config verification failed"
  else
      echo "❌ Warning: Cloudflare tunnel may not be running properly"
      sudo systemctl status cloudflared --no-pager -l || true
  fi
else
  echo "⏭️ Skipping Cloudflare tunnel restart (config not found)."
fi

# 9. Wait for containers to be fully ready
echo "⏳ Waiting for containers to be healthy..."
for i in {1..30}; do
    if sudo docker ps | grep -q "${CONTAINER_NAME}-backend.*healthy" && sudo docker ps | grep -q "${CONTAINER_NAME}-frontend.*Up"; then
        echo "✅ Containers are ready!"
        break
    fi
    echo "   Waiting... ($i/30)"
    sleep 2
done

# 10. Test local and domain
echo "🧪 Testing local connection..."
LOCAL_TEST=$(curl -I http://localhost:$PORT 2>/dev/null | head -n 1)
if [[ $LOCAL_TEST == *"200"* ]]; then
    echo "✅ Local connection OK: $LOCAL_TEST"
else
    echo "❌ Local connection failed: $LOCAL_TEST"
fi

echo ""
echo "🧪 Waiting for tunnel to propagate..."
sleep 20

echo "🧪 Testing domain connection..."
for i in {1..5}; do
    DOMAIN_TEST=$(curl -I https://$DOMAIN 2>/dev/null | head -n 1)
    if [[ $DOMAIN_TEST == *"200"* ]] || [[ $DOMAIN_TEST == *"301"* ]] || [[ $DOMAIN_TEST == *"302"* ]]; then
        echo "✅ Domain is accessible: $DOMAIN_TEST"
        break
    else
        echo "⏳ Attempt $i/5: $DOMAIN_TEST"
        if [ $i -eq 5 ]; then
            echo "⚠️  Domain may need more time. Try: curl -I https://$DOMAIN"
        else
            sleep 10
        fi
    fi
done

echo ""
echo "✅ Deploy completed!"
echo "📍 Containers: ${CONTAINER_NAME}-backend, ${CONTAINER_NAME}-frontend"
echo "🌐 Domain: https://$DOMAIN"
echo "🔌 Port: $PORT"
echo "📊 Status:"
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E "${CONTAINER_NAME}-(frontend|backend)" || true
echo ""
echo "📦 Backup Information:"
echo "   Backup location: $BACKUP_DIR"
echo "   Available backup images: $(sudo docker images htxbachgia-backup-* --format '{{.Repository}}:{{.Tag}}' | head -2 | tr '\n' ' ')"
echo ""
echo "🔄 Rollback Commands (if needed):"
echo "   # Stop current deployment"
echo "   cd ${DEPLOY_BASE}/${CONTAINER_NAME} && sudo docker-compose down"
echo ""
echo "   # Restore from backup"
echo "   sudo cp $BACKUP_DIR/docker-compose-backup.yml ./docker-compose.yml"
echo "   sudo tar -xzf $BACKUP_DIR/media-backup.tar.gz 2>/dev/null || true"
echo "   sudo tar -xzf $BACKUP_DIR/backend-uploads-backup.tar.gz 2>/dev/null || true"
echo "   sudo docker-compose up -d"
echo ""
echo "📋 Deployment Summary:"
echo "✅ Backend Image: ${BACKEND_IMAGE_BASE}:backend-${BACKEND_TAG}"
echo "✅ Frontend Image: ${FRONTEND_IMAGE_BASE}:frontend-${FRONTEND_TAG}"
echo "🌐 Domain: https://$DOMAIN"
echo "🔌 Local Port: http://localhost:$PORT"
echo ""
echo "🚀 Quick Commands:"
echo "  # Check logs: sudo docker logs ${CONTAINER_NAME}-backend --tail 20"
echo "  # Restart: cd ${DEPLOY_BASE}/${CONTAINER_NAME} && sudo docker compose restart"  
echo "  # Update: ./deploy-htxbachgia.sh latest"
echo ""
echo "📋 Next steps (if new deployment):"
echo "1. Add $DOMAIN to Cloudflare Dashboard (if not done)"
echo "2. Create CNAME records:"
echo "   @ → 13835f7d-46a0-48f7-bb67-333f39ee33d1.cfargotunnel.com"
echo "   www → 13835f7d-46a0-48f7-bb67-333f39ee33d1.cfargotunnel.com"
echo "3. Test: curl -I https://$DOMAIN"