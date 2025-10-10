#!/bin/bash
# Script để fix lỗi media trên production server

echo "=== MEDIA FIX SCRIPT ==="
echo "Sửa lỗi media serving trên production"
echo

# 1. Tạo thư mục media nếu chưa có
echo "1. Tạo thư mục media structure:"
mkdir -p ./media/2025/10
mkdir -p ./media/2025/11
mkdir -p ./media/2025/12
chown -R 1000:1000 ./media/
chmod -R 755 ./media/
echo "✓ Created and set permissions for media directories"

# 2. Restart containers để apply volume mounts
echo "2. Restart containers:"
docker compose -p final8local -f docker-compose.server.full.yml down
sleep 3
docker compose -p final8local -f docker-compose.server.full.yml up -d --build
echo "✓ Containers restarted"

# 3. Đợi containers khởi động
echo "3. Waiting for containers to start..."
sleep 15

# 4. Kiểm tra backend health
echo "4. Checking backend health:"
timeout 30 bash -c 'until docker exec final8new-backend wget -qO- http://localhost:3000/health; do sleep 2; done'
if [ $? -eq 0 ]; then
    echo "✓ Backend is healthy"
else
    echo "⚠ Backend health check timeout"
fi

# 5. Kiểm tra frontend health
echo "5. Checking frontend health:"
timeout 30 bash -c 'until docker exec final8new-frontend wget -qO- http://localhost/; do sleep 2; done' > /dev/null
if [ $? -eq 0 ]; then
    echo "✓ Frontend is healthy"
else
    echo "⚠ Frontend health check timeout"
fi

# 6. Test media endpoint
echo "6. Testing media API:"
MEDIA_TEST=$(docker exec final8new-backend wget -qO- http://localhost:3000/api/media)
if echo "$MEDIA_TEST" | grep -q "items"; then
    echo "✓ Media API working"
else
    echo "⚠ Media API may have issues"
fi

# 7. Verify nginx config
echo "7. Verifying nginx config:"
docker exec final8new-frontend nginx -t
if [ $? -eq 0 ]; then
    echo "✓ Nginx config is valid"
    docker exec final8new-frontend nginx -s reload
    echo "✓ Nginx reloaded"
else
    echo "⚠ Nginx config has errors"
fi

echo "=== FIX COMPLETE ==="
echo "Bây giờ hãy test lại bằng cách:"
echo "1. Truy cập http://your-domain:8088/media"
echo "2. Click vào một ảnh để kiểm tra"