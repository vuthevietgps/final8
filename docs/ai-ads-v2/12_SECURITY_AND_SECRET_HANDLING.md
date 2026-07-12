# 12 — Security & Secret Handling

## 1. Nguyên tắc

Không đưa secret thật vào:

```text
- ChatGPT Web
- Codex prompt
- Markdown docs
- Git
- Log
- API response
- Screenshot chia sẻ công khai
```

Secret gồm:

```text
GOOGLE_ADS_CLIENT_SECRET
GOOGLE_ADS_REFRESH_TOKEN
GOOGLE_ADS_DEVELOPER_TOKEN
ERP_INTERNAL_API_KEY
JWT_SECRET
API_TOKEN_SECRET
```

## 2. `.env.example`

```env
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_ADS_API_VERSION=v24

API_TOKEN_SECRET=
ERP_INTERNAL_API_KEY=

AI_MARKETING_REQUIRE_APPROVAL=true
AI_MARKETING_DRY_RUN=true
AI_MARKETING_PROVIDER_EXECUTION_ENABLED=false
GOOGLE_ADS_PRODUCTION_ENABLED=false
```

## 3. Hardening bắt buộc

```text
1. Không lưu plaintext token.
2. Chỉ lưu encrypted token.
3. API response luôn mask secret.
4. Production fail startup nếu thiếu API_TOKEN_SECRET.
5. Không dùng fallback DEV_TOKEN_SECRET ở production.
6. Tách RBAC credential read/write.
7. Log không chứa Authorization header hoặc token.
```

## 4. Khi secret đã lộ

Nếu client secret/developer token đã xuất hiện trong ảnh hoặc chat:

```text
1. Recreate/reset secret trong Google Cloud Console.
2. Cập nhật secret mới trong .env/secret manager/ERP settings.
3. Xóa secret cũ khỏi DB nếu đã lưu.
4. Rotate refresh token nếu cần.
5. Kiểm tra log/Git history.
```

## 5. Mặc định môi trường an toàn

Giai đoạn MVP:

```env
AI_MARKETING_DRY_RUN=true
GOOGLE_ADS_PRODUCTION_ENABLED=false
AI_MARKETING_REQUIRE_APPROVAL=true
```

Chỉ bật live khi:

```text
- Credential đã kiểm tra.
- Developer token đủ quyền.
- Account đúng VND/timezone.
- RBAC đúng.
- validateOnly chạy ổn.
- Người dùng hiểu action cần execute.
```
