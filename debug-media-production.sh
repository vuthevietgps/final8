#!/bin/bash
# Script để debug và fix lỗi media trên production server

echo "=== MEDIA DEBUG & FIX SCRIPT ==="
echo "Kiểm tra và sửa lỗi khi click vào link ảnh bị chuyển về /users"
echo

# 1. Kiểm tra containers đang chạy
echo "1. Kiểm tra containers đang chạy:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo

# 2. Kiểm tra cấu trúc thư mục media
echo "2. Kiểm tra thư mục media trên host:"
ls -la ./media/ 2>/dev/null || echo "Thư mục ./media không tồn tại"
echo

# 3. Kiểm tra thư mục media trong backend container
echo "3. Kiểm tra thư mục media trong backend container:"
docker exec final8new-backend ls -la /app/uploads/media/ 2>/dev/null || echo "Không thể truy cập backend container"
echo

# 4. Kiểm tra thư mục media trong frontend container
echo "4. Kiểm tra thư mục media trong frontend container:"
docker exec final8new-frontend ls -la /var/www/media/ 2>/dev/null || echo "Không thể truy cập frontend container"
echo

# 5. Kiểm tra nginx config trong frontend container
echo "5. Kiểm tra nginx config:"
docker exec final8new-frontend cat /etc/nginx/conf.d/default.conf | grep -A 5 -B 2 "location /media"
echo

# 6. Test backend API
echo "6. Test backend API endpoint:"
docker exec final8new-backend wget -qO- http://localhost:3000/api/media | head -200
echo

# 7. Test static file serving từ backend
echo "7. Test static file serving từ backend:"
docker exec final8new-backend ls /app/uploads/media/2025/10/ 2>/dev/null | head -3
if [ $? -eq 0 ]; then
    SAMPLE_FILE=$(docker exec final8new-backend ls /app/uploads/media/2025/10/ | head -1)
    if [ -n "$SAMPLE_FILE" ]; then
        echo "Testing file: $SAMPLE_FILE"
        docker exec final8new-backend wget -qO- "http://localhost:3000/media/2025/10/$SAMPLE_FILE" | wc -c
    fi
fi
echo

# 8. Test nginx serving từ frontend
echo "8. Test nginx static serving:"
docker exec final8new-frontend ls /var/www/media/2025/10/ 2>/dev/null | head -3
if [ $? -eq 0 ]; then
    SAMPLE_FILE=$(docker exec final8new-frontend ls /var/www/media/2025/10/ | head -1)
    if [ -n "$SAMPLE_FILE" ]; then
        echo "Testing nginx file: $SAMPLE_FILE"
        docker exec final8new-frontend wget -qO- "http://localhost/media/2025/10/$SAMPLE_FILE" | wc -c
    fi
fi
echo

# 9. Kiểm tra logs
echo "9. Kiểm tra logs (5 dòng cuối):"
echo "Backend logs:"
docker logs final8new-backend --tail 5
echo
echo "Frontend logs:"
docker logs final8new-frontend --tail 5
echo

echo "=== DIAGNOSTIC COMPLETE ==="