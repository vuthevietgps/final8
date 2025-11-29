# Mã nguồn: Dọn dẹp và chuẩn hoá

Tài liệu này mô tả các bước dọn dẹp đã thực hiện và các mục đề xuất dọn dẹp thêm.

## Đã thực hiện

1. Loại trừ các script/dev/test khỏi build NestJS (không xóa file):
   - Cập nhật `backend/tsconfig.build.json` để `exclude` các file/thư mục:
     - `src/backfill-order-phone.ts`
     - `src/check-conversations.ts`
     - `src/create-demo-conversation.ts`
     - `src/create-demo-users.ts`
     - `src/debug-token.ts`
     - `src/fix-token.ts`
     - `src/test-text-processing.js`
     - `src/summary4/**`
     - `src/summary5/**`
     - `src/test-order2/**`

   Mục tiêu: rút ngắn thời gian build, giảm rủi ro runtime, nhưng vẫn giữ script để tái sử dụng khi cần.

2. Thêm ignore files cho formatting/lint:
   - `.prettierignore`
   - `.eslintignore`
   
   Bỏ qua các thư mục build/nhị phân/tạm: `node_modules`, `dist`, `uploads`, `media`, `data`, v.v.

## Đề xuất tiếp theo (tuỳ chọn)

- Di chuyển các script dev (hiện ở `backend/src/*.ts`) sang `backend/scripts/dev/` và thêm hướng dẫn chạy bằng `ts-node`.
- Bật ESLint + Prettier cho dự án (nếu muốn đồng bộ style):
  - Thêm cấu hình ESLint/Prettier cơ bản, quy ước code style thống nhất.
- Xem xét xóa hẳn các thư mục POC cũ nếu chắc chắn không dùng:
  - `backend/src/summary4/`, `backend/src/summary5/`, `backend/src/test-order2/`
- Thêm GitHub Action kiểm tra build/lint nhanh để đảm bảo PR sạch.

## Cách chạy script dev (gợi ý)

Ví dụ với `ts-node` (tuỳ chọn, nếu cài):

```powershell
cd backend
# chạy thử một script (ví dụ):
# npx ts-node src/check-conversations.ts
```

> Lưu ý: các script có thể phụ thuộc ENV/token. Nên tạo `.env` riêng cho môi trường dev và đọc biến qua `process.env`.
