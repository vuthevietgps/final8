# Quy trình phát triển và triển khai

Tài liệu tóm tắt giúp bạn tiếp tục phát triển tính năng trên máy local và triển khai lên server một cách ổn định, lặp lại được.

## 1) Phát triển trên máy local
- Backend (NestJS):
  - Lần đầu: `npm i` trong thư mục `backend`
  - Chạy dev: `npm run start:dev`
  - Health: http://localhost:3000/health (nếu chạy trực tiếp) hoặc http://localhost:3001/health (khi chạy qua Docker compose local)
- Frontend (Angular):
  - Lần đầu: `npm i` trong `frontend`
  - Chạy dev: `npm start`
  - Lưu ý: Ở bản build/prod, frontend gọi API qua `environment.apiUrl = '/api'`; Nginx trong container sẽ proxy `/api` → `backend:3000`.
- Docker thử local:
  - `docker compose up -d --build`
  - Truy cập: Frontend http://localhost:8080; Backend http://localhost:3001 (health `/health`)

## 2) Đóng gói để deploy
- Dùng PowerShell script: `scripts/make-deploy-zip.ps1`
  - Tạo thư mục `package-final8new`, loại bỏ `node_modules`, `dist`, `uploads`
  - Chép file compose và credential JSON (Method 1) nếu có
  - ĐÃ chuẩn hóa để bao gồm: `docker-compose.server.full.yml`
  - Kết quả: file `final8-new.zip` ở thư mục gốc repo

## 3) Triển khai trên server (khuyến nghị)
- Tại thư mục triển khai, ví dụ `/opt/websites/sites/final8new`:
  1) Upload `final8-new.zip` và giải nén
  2) Chạy:
     - `docker compose -p final8new -f docker-compose.server.full.yml up -d --build`
- Đặc điểm `docker-compose.server.full.yml`:
  - Frontend publish cổng 8088
  - Backend không publish ra host (chỉ nội bộ mạng Docker) → an toàn hơn
  - Có healthcheck, restart policy và giới hạn log (json-file: max-size 10m, max-file 5)
- Cloudflare Tunnel (đã cấu hình):
  - `htxbachgia.shop`, `www`, `api` → `http://127.0.0.1:8088`
  - `landing` → `http_status:404`

## 4) Kiểm tra sau deploy
- Container: `docker ps` (frontend map 8088:80; backend nội bộ)
- Ứng dụng:
  - Mở https://htxbachgia.shop
  - DevTools → Network: các request `/api/*` trả 200
  - Health: `curl -sS https://htxbachgia.shop/api/health`

## 5) Làm sạch server định kỳ (an toàn)
- Docker prune (không ảnh hưởng container đang chạy):
  - `docker image prune -f`
  - `docker container prune -f`
  - `docker network prune -f`
  - `docker builder prune -af`
  - `docker volume prune -f`
- System logs:
  - `sudo journalctl --vacuum-time=14d`
  - `sudo journalctl --vacuum-size=200M`
- Log Docker: đã giới hạn trong compose; có thể đặt mặc định ở `/etc/docker/daemon.json`

## 6) Rollback nhanh
- Lưu bản zip ổn định trước đó
- Khi cần: giải nén lại bản ổn định → `docker compose -p final8new -f docker-compose.server.full.yml up -d`

## 7) Ghi nhớ bảo mật
- Không mở port host cho backend trên server
- Mount credential JSON dạng read-only
- CORS đã bật trong NestJS; frontend prod gọi qua `/api`
