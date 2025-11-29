#!/bin/bash

# Script để deploy code mới và test token
echo "🚀 Deploying new code với debug endpoints..."

# Build và push image mới
echo "📦 Building and pushing new image..."
cd /path/to/project
docker build -t vutheviet/final8new:backend-debug backend/
docker push vutheviet/final8new:backend-debug

# Deploy trên server
echo "🔄 Updating deployment..."
# Assuming you're on the server
docker pull vutheviet/final8new:backend-debug
docker tag vutheviet/final8new:backend-debug vutheviet/final8new:backend-version6.1

# Restart containers
cd /opt/websites/sites/htxbachgia-shop
docker-compose restart backend

echo "⏳ Waiting for backend to start..."
sleep 30

# Test debug endpoint
echo "🧪 Testing debug endpoint..."
FANPAGE_ID="68ebcb48b631002b38117c82"

curl -X POST "https://htxbachgia.shop/api/fanpages/debug/$FANPAGE_ID/validate-token" \
  -H "Content-Type: application/json" \
  | jq '.'

echo ""
echo "📋 Instructions để fix token:"
echo "1. Lấy token mới từ Facebook Developer Console"
echo "2. Chạy lệnh sau để update:"
echo ""
echo "curl -X POST \"https://htxbachgia.shop/api/fanpages/debug/$FANPAGE_ID/refresh-token\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"accessToken\": \"NEW_TOKEN_HERE\"}'"