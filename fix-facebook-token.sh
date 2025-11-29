#!/bin/bash

# Script để fix access token trực tiếp trên server production
# File: fix-facebook-token.sh

echo "🔧 Facebook Access Token Fix Script"
echo "=================================="

FANPAGE_ID="68ebcb48b631002b38117c82"
BACKEND_URL="http://localhost:8090/api"

echo "📋 Bước 1: Kiểm tra token hiện tại"
echo "Fanpage ID: $FANPAGE_ID"

# Check current token status
echo "🔍 Testing current token..."
curl -s -X POST "$BACKEND_URL/fanpages/$FANPAGE_ID/validate-token" \
  -H "Content-Type: application/json" \
  | jq '.'

echo ""
echo "📝 Bước 2: Để cập nhật token mới:"
echo "1. Vào Facebook Developer Console"
echo "2. Chọn app Facebook của bạn"
echo "3. Tools & Support > Access Token Tool"
echo "4. Chọn page 'Hộ Chiếu Toàn Quốc'"
echo "5. Generate User Access Token với quyền: pages_manage_metadata, pages_messaging"
echo "6. Exchange for Long-lived Page Access Token"
echo "7. Copy token mới"
echo ""
echo "📡 Bước 3: Cập nhật token qua API:"
echo "curl -X POST \"$BACKEND_URL/fanpages/$FANPAGE_ID/refresh-token\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"accessToken\": \"NEW_TOKEN_HERE\"}'"
echo ""
echo "🧪 Bước 4: Test sau khi cập nhật:"
echo "curl -X POST \"$BACKEND_URL/fanpages/$FANPAGE_ID/validate-token\""

# Alternative: Direct database update (if needed)
echo ""
echo "🔄 Hoặc update trực tiếp database:"
echo "docker exec -it htxbachgia-shop-backend sh"
echo "# Trong container:"
echo "# Sửa access token trực tiếp trong MongoDB"