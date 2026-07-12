# Kế hoạch Test Backend ERP `htxbachgia.shop`

**Ngày rà soát:** 14/04/2026  
**Phạm vi:** Backend NestJS tại `backend/`  
**Mục tiêu:** xây dựng kế hoạch test backend chi tiết, ưu tiên các luồng lan tỏa E2E giữa đơn hàng, quảng cáo, công nợ, quỹ, cashflow, payroll, media và vận hành.

**Chỉ mục QA hiện hành:** xem [README.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/README.md)

## 1. Tóm tắt sau khi rà soát dự án

### 1.1 Kiến trúc và đặc tính ảnh hưởng trực tiếp tới test

- Backend dùng NestJS, MongoDB, JWT auth, RBAC theo `role`, permission guard và thêm `FeatureGateGuard` theo gói `starter/professional/enterprise`.
- Toàn bộ API dùng prefix `/api`, ngoại trừ `/health`.
- Global `ValidationPipe` đang bật `whitelist`, `forbidNonWhitelisted`, `transform`.
- Có xử lý bất đồng bộ và lan tỏa nghiệp vụ qua scheduler, event emitter, cache Redis hoặc in-memory fallback.
- Có endpoint public và endpoint tích hợp ngoài: `auth/login`, `health`, `media`, `webhook/messenger`, `advertising-cost-public`, sync token, Facebook/Google/TikTok fetch.
- Có nhiều luồng backend không chỉ CRUD mà còn recalculation, aggregate report, payment batch, capital allocation, owner fund, labor statement, return flow, auto-scale ads, order update từ Excel.

### 1.2 Hiện trạng asset test trong repo

- Repo đã có nhiều script PowerShell kiểm thử API/module:
  - `test-all-modules.ps1` la entrypoint local QA mac dinh, goi `tests/backend/runners/run-backend-module-regression-local.ps1`, roi wrapper nay moi delegate vao `tests/backend/runners/run-backend-module-regression.ps1`
  - Các module suite active hiện nằm dưới `tests/backend/suites/modules/`
- Repo có thêm các script E2E chuyên sâu nhưng chưa được master runner gọi hết:
  - Active E2E hiện nằm dưới `tests/backend/suites/e2e-flows/`
  - Scenario sâu hiện nằm dưới `tests/backend/suites/business-scenarios/`
  - Các suite cũ bị bao phủ được chuyển sang `tests/backend/legacy/superseded/`
- Hiện **không có** `backend/test/` và cũng **không có** `backend/test/jest-e2e.json`, dù `backend/package.json` vẫn có script `npm run test:e2e`.

### 1.3 Rủi ro QA hiện tại

- Baseline kết quả test đang không đồng nhất:
  - `AGENTS.md` hien chi giu command tham chieu, khong con la nguon ghi ket qua assertion.
  - `tests/backend/legacy/docs/TEST-PLAN-20260223.md` ghi `321 PASS / 0 FAIL`.
  - `tests/backend/legacy/artifacts/test-all-modules-results-20260306.json` ghi `241 PASS / 37 FAIL` trên 12 module.
- Master runner chưa gom hết các suite E2E mới, nên trạng thái regression tổng thể dễ bị đánh giá sai.
- Một số luồng quan trọng phụ thuộc dữ liệu nền và tích hợp ngoài, nếu không seed/stub rõ ràng sẽ sinh false positive hoặc false negative.
- Do repo đang dùng nhiều test PowerShell trực tiếp vào API thật, tính ổn định CI còn phụ thuộc môi trường, seed data và trạng thái DB hiện hữu.

## 2. Mục tiêu chất lượng cần bảo vệ

### 2.1 Mục tiêu chức năng

- Đảm bảo endpoint trả đúng contract, status code, validation và quyền truy cập.
- Đảm bảo luồng nghiệp vụ xuyên module chạy đúng từ đầu đến cuối.
- Đảm bảo số liệu tài chính, lợi nhuận, công nợ, quỹ và alert được cập nhật đúng sau các thao tác nghiệp vụ.

### 2.2 Mục tiêu lan tỏa E2E

- Một thay đổi ở đơn hàng phải lan đúng sang công nợ, payment batch, báo cáo lợi nhuận, financial control, funds và capital allocation.
- Một thay đổi ở ad group hoặc advertising cost phải lan đúng sang ad-group report, KPI, alerts, budget allocation và đề xuất scale.
- Một thay đổi ở payroll, owner fund, loan hoặc other cost phải phản ánh đúng vào cashflow/funds/dashboard/alerts.
- Một thay đổi ở delivery/return phải phản ánh đúng vào return report, tỷ lệ hoàn, lợi nhuận và cảnh báo.

### 2.3 Mục tiêu phi chức năng

- Chống double-pay, chống race condition ở batch payment.
- Chống truy cập trái phép, sai role, sai permission, sai gói dịch vụ.
- Chống path traversal ở media serve.
- Chịu được lỗi tích hợp ngoài mà không làm hỏng dữ liệu lõi.
- Có khả năng quan sát được khi lỗi qua log, response và health endpoint.

## 3. Phạm vi test

### 3.1 In scope

- Toàn bộ backend API dưới `backend/src/**`.
- Auth, user, customer, product, product-category, quote, supplier-quote.
- Ad account, ad group, advertising cost, ad-group-profit-report, ad-report, ads-alerts, employee KPI.
- Test order, pending order, payment batch, return request, return report, delivery/production/order status.
- Finance, funds, capital allocation, budget allocation, cashflow control, owner fund, loan management.
- Supplier payable, agent payable/receivable, purchase order, inventory.
- Labor cost, labor statement, salary config, session log, other cost.
- Media, fanpage, openai-config, api-token, chat-message, webhook messenger.
- Ops-action, emergency-action, plan info, order-update, google-sync deprecated endpoints, health endpoints.

### 3.2 Out of scope của tài liệu này

- UI/UX frontend Angular.
- Kiểm thử hiệu năng frontend.
- UAT nghiệp vụ do người dùng nghiệp vụ xác nhận trên giao diện.
- Kiểm thử bảo mật chuyên sâu kiểu pentest black-box toàn hệ thống.

## 4. Chiến lược test backend đề xuất

### 4.1 Test tầng 1: Smoke API

Mục tiêu là trả lời nhanh câu hỏi: backend có sống, auth có hoạt động, route public/protected có đúng, DB có sẵn không.

Chạy trên:

- Mỗi pull request vào backend.
- Mỗi deploy staging.
- Sau deploy production bằng bộ smoke an toàn.

Bao gồm:

- `/health`, `/health/db`
- `POST /api/auth/login`
- `GET /api/auth/profile` với token hợp lệ
- 1 route protected đại diện như `/api/test-order2`
- 1 route finance đại diện như `/api/financial-control/dashboard`
- 1 route public như `/api/webhook/messenger` hoặc `/api/advertising-cost-public/yesterday-spent`

### 4.2 Test tầng 2: Module/API regression

Mục tiêu là xác nhận từng module hoạt động đúng ở mức CRUD, filter, validation, permission, basic business rule.

Nên tái sử dụng và chuẩn hóa các script PowerShell hiện có thành:

- Bộ test chạy độc lập theo domain.
- Có seed/cleanup rõ ràng.
- Ghi JSON summary duy nhất.

### 4.3 Test tầng 3: Cross-module E2E

Đây là trọng tâm của kế hoạch này. Các suite phải kiểm tra:

- Luồng nghiệp vụ đầy đủ.
- Sự thay đổi số liệu sau mỗi bước.
- Tính đúng của event/cache refresh.
- Tính nhất quán giữa các module tiêu thụ cùng một nguồn dữ liệu.

### 4.4 Test tầng 4: Negative, security, resilience

- Validation sai schema.
- Missing field, extra field, ObjectId sai.
- Sai quyền, sai role, sai plan.
- Duplicate request, retry request, concurrent request.
- Upload file sai MIME, quá kích thước, link media xấu, webhook token sai.
- Tích hợp ngoài lỗi timeout hoặc credential lỗi.

### 4.5 Test tầng 5: Non-functional lightweight

- Response time cho endpoint nặng.
- Idempotency của webhook/payment.
- Tính ổn định khi cache bật/tắt.
- Tính đúng khi `forceRefresh=true`.

## 5. Môi trường test và dữ liệu test

### 5.1 Môi trường bắt buộc

- `test-all-modules.ps1` local default nay tu build backend va start mot backend QA dedicated tren port free; khong con bat buoc phai co san service tren `http://localhost:3000`.
- Neu `BACKEND_BASE_URL` da duoc export truoc do, local bootstrap wrapper se delegate thang vao canonical runner va khong tu start backend rieng.
- MongoDB test riêng, không dùng chung DB production.
- Neu chay canonical runner hoac suite direct tren backend da duoc bootstrapped san, phai control ro `BACKEND_BASE_URL` va `BACKEND_HEALTH_URL`.
- Neu chay canonical runner tren backend external, shell chay runner phai biet media root do backend dang dung:
  - local same-shell flow: chi can export `MEDIA_DIR`, runner se alias sang `DB06_MEDIA_DIR` cho DB-06.
  - neu direct chay `module.db-seed-cleanup.ps1` hoac backend nam o shell/container khac thi phai export explicit `DB06_MEDIA_DIR`, hoac cung cap `BACKEND_RUNTIME_MANIFEST` co field `db06MediaDir` ma runner nhin thay duoc.
- Nếu có Redis thì test cả 2 mode:
  - có `REDIS_URL`
  - không có `REDIS_URL` để rơi về memory cache
- Dùng `NODE_ENV=test` hoặc một profile staging riêng cho QA.

### 5.2 Biến môi trường cần kiểm soát

- `MONGODB_URI`
  - local bootstrap wrapper reuse shell `MONGODB_URI` neu da co; neu khong thi tu sinh DB local timestamped tren `127.0.0.1:27017`
- `JWT_SECRET`
- `PORT`
- `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`
- `AUTH_RBAC_BASE_URL`, `AUTH_HARDENING_BASE_URL`
- `BACKEND_RUNTIME_MANIFEST`
  - runtime manifest cho external backend khac shell/container; co the mang `backendBaseUrl`, `backendHealthUrl`, `auth*BaseUrl`, `mongodbUri`, `db06MediaDir`
- `CORS_ORIGINS`
- `PLAN_TYPE`
- `ALLOW_DANGEROUS_SEED`
- `AUTH_ENABLE_IP_RESTRICTION`
- `ENFORCE_AD_ACCOUNT_TIMEZONE`
- `FB_SENDING_ENABLED`
- `MESSAGE_TAG`
- `MESSENGER_VERIFY_TOKEN` hoặc `FB_VERIFY_TOKEN`
- `MEDIA_DIR`, `MEDIA_PUBLIC_BASE`, `PUBLIC_ORIGIN`, `APP_PUBLIC_ORIGIN`
- `DB06_MEDIA_DIR` cho DB-06 khi direct suite chay voi `BACKEND_BASE_URL` external; canonical runner chi auto-alias bien nay tu `MEDIA_DIR` trong local same-shell flow
- `BACKEND_RUNTIME_MANIFEST` khi external backend nam o shell/container khac va runner can doc machine-readable contract thay vi nhan tay tung env
- `FB_ADS_ACCESS_TOKEN`, `GOOGLE_ADS_*`, `TIKTOK_*` nếu test tích hợp thật

### 5.3 Bộ dữ liệu nền nên chuẩn hóa

- 1 director chuẩn để điều phối toàn bộ test.
- 1 manager.
- 1 employee.
- 1 internal agent và 1 external agent.
- 1 internal supplier và 1 external supplier.
- 1 product category.
- 2 product.
- 1 fanpage.
- 1 ad account.
- 1 ad group hợp lệ có `fanpageId`, `agentId`, `adAccountId`.
- Bộ status chuẩn: delivery, production, order.
- 1 salary config.
- 1 funding source.
- 1 owner.

### 5.4 Dữ liệu fixture cần có

- File Excel hợp lệ cho `order-update`.
- File Excel lỗi format.
- File media ảnh hợp lệ và file giả mạo MIME.
- Payload webhook messenger mẫu.
- Bộ advertising cost mẫu theo ngày.
- Bộ order mẫu theo nhiều trạng thái.

### 5.5 Chính sách seed và cleanup

- Mỗi suite phải tạo dữ liệu riêng bằng timestamp hoặc UUID.
- Cleanup phải xóa dữ liệu test nếu endpoint hỗ trợ.
- Với luồng không thể cleanup hoàn toàn, phải dùng DB test cô lập.
- Không chạy seed nguy hiểm trên shared staging nếu `ALLOW_DANGEROUS_SEED` chưa được kiểm soát.

## 6. Ma trận ưu tiên test

| Mức ưu tiên | Ý nghĩa | Ví dụ |
|---|---|---|
| P0 | Gãy là chặn release | Auth, health, order-to-cashflow, payment batch atomic, financial-control dashboard |
| P1 | Quan trọng cao | Ads cost -> KPI/alerts/report, payroll -> funds, owner fund -> finance, pending order approve |
| P2 | Quan trọng vừa | Media cleanup, webhook verify, purchase -> inventory, return report, plan gate |
| P3 | Bổ sung | Deprecated endpoints, exploratory, so sánh số liệu legacy |

## 7. Danh sách suite backend nên duy trì

| Suite ID | Domain | Mức | Trạng thái mong muốn |
|---|---|---|---|
| S01 | Smoke, health, auth cơ bản | P0 | Chạy mọi PR/deploy |
| S02 | Auth, RBAC, permission, plan gate | P0 | Tự động |
| S03 | Master data: users, customer, product, category, statuses | P1 | Tự động |
| S04 | Ads foundation: fanpage, api-token, ad-account, ad-group, advertising-cost | P0 | Tự động |
| S05 | Orders, pending orders, payment batch, reports | P0 | Tự động |
| S06 | Finance deep, funds, capital allocation, cashflow control | P0 | Tự động |
| S07 | Owner fund, loan, withdrawal, fund account | P1 | Tự động |
| S08 | Payroll, labor, session-log, other-cost, salary-config | P1 | Tự động |
| S09 | Supply chain, quotes, supplier payable, agent payable/receivable | P1 | Tự động |
| S10 | Return, delivery status, return report | P1 | Tự động |
| S11 | Media, product image, chat, messenger webhook | P1 | Tự động |
| S12 | Inventory, purchase orders, order-update, ops/emergency | P2 | Tự động |
| S13 | Public endpoints, deprecated endpoints, resilience | P2 | Tự động |
| S14 | Performance smoke và concurrency | P1 | Nightly / pre-release |

Ghi chu active cho S02:

- `module.auth-rbac.ps1` giu vai tro auth/RBAC baseline.
- `module.auth-hardening.ps1` da duoc kich hoat de bao phu `register`, token lifecycle, query-token va IP restriction.
- Round targeted auth rerun ngay `2026-04-19` da verify them:
  - dedicated `3100` auth instance quote env theo kieu `set "NAME=value"` de tranh whitespace drift
  - suite cleanup dung PID node listener thay vi chi stop wrapper `cmd.exe`
  - `module.auth-rbac.ps1` cho phep override `AUTH_RBAC_BASE_URL` khi local `3000` dang bi process khac giu

Ghi chu active cho S13:

- `e2e.public-contracts-resilience.ps1` da duoc kich hoat de bao phu `BE-SMOKE-03`, `BE-MEDIA-03`, `BE-CHAT-03`, `BE-PUB-01`, `BE-PUB-02`, `BE-PUB-03`, `BE-PUB-04`.
- Activation round ngay `2026-04-19 03:24:15 +07` da pass `61 PASS / 0 FAIL` tren isolated public-contract backends.
- Round nay dong 2 bug san pham:
  - `backend/src/chat-message/chat-message.controller.ts`: image send routes gio cung ap dung gate 24h truoc khi persist outbound.
  - `backend/src/media/media.controller.ts`: explicit `/api/media/serve/:year/:month/:filename` route giu contract public alias, encoded traversal rejection, va DB fallback.

## 8. Bộ tình huống test backend chi tiết

## 8.1 S01 - Smoke và public/protected baseline

### `BE-SMOKE-01` Health và DB connectivity

- Mục tiêu: xác nhận service sống và MongoDB phản hồi.
- Bước thực hiện:
  1. `GET /health`
  2. `GET /health/db`
- Kỳ vọng:
  1. `/health` trả `status=ok`.
  2. `/health/db` trả state DB hợp lệ và không throw exception.

### `BE-SMOKE-02` Prefix `/api` và protected route

- Mục tiêu: xác nhận routing chuẩn.
- Bước thực hiện:
  1. Gọi `GET /api/test-order2` không token.
  2. Gọi `GET /test-order2` không prefix.
- Kỳ vọng:
  1. Route protected trả `401` hoặc `403`.
  2. Route không prefix không được map nhầm.

### `BE-SMOKE-03` Public endpoints

- Mục tiêu: xác nhận endpoint public không bị guard chặn sai.
- Bước thực hiện:
  1. `POST /api/auth/login`
  2. `GET /api/webhook/messenger?...`
  3. `GET /api/advertising-cost-public/yesterday-spent`
  4. `GET /api/media/<path hợp lệ>`
- Kỳ vọng:
  1. Endpoint public truy cập được không cần JWT.
  2. Endpoint protected khác vẫn bắt auth như bình thường.
- Trang thai hien tai: `active_automated` qua `e2e.public-contracts-resilience.ps1`.
- Verified round `2026-04-19 03:24:15 +07`: `61 PASS / 0 FAIL`, public `/health`, `/api/health/db`, webhook, `advertising-cost-public`, media aliases, va protected `/api/media` auth boundary deu xanh.

## 8.2 S02 - Auth, RBAC, permission, plan gate

### `BE-AUTH-01` Login -> profile -> validate-token -> logout

- Mục tiêu: xác nhận vòng đời JWT chuẩn.
- Bước thực hiện:
  1. Login bằng tài khoản director.
  2. Gọi `GET /api/auth/profile`.
  3. Gọi `POST /api/auth/validate-token`.
  4. Gọi `POST /api/auth/logout`.
  5. Kiểm tra `GET /api/session-logs/me`.
- Kỳ vọng:
  1. Login trả token và `user.id`.
  2. Profile đúng `role`, `fullName`, email.
  3. Logout ghi nhận session log đúng.

### `BE-AUTH-02` Ma trận role và permission

- Mục tiêu: xác nhận role thực sự map đúng tới permission.
- Bước thực hiện:
  1. Login lần lượt các role: director, manager, employee, internal/external agent, internal/external supplier, investor, lender nếu có.
  2. Gọi các route đại diện: `users`, `test-order2`, `financial-control/dashboard`, `quotes`, `media`, `finance`, `chat-messages`.
- Kỳ vọng:
  1. Director truy cập đầy đủ route lõi.
  2. Manager chỉ vào đúng nhóm ads/reports/chat.
  3. Employee chỉ vào `orders-test2`, `order-update`, `chat-messages`.
  4. Agent/supplier không vào nhầm finance/admin.

### `BE-AUTH-03` Plan gate theo `PLAN_TYPE`

- Mục tiêu: xác nhận `FeatureGateGuard` chặn module đúng theo gói.
- Bước thực hiện:
  1. Chạy env với `PLAN_TYPE=starter`, login director.
  2. Gọi route module starter như `/api/products`.
  3. Gọi route module professional như `/api/test-order2`, `/api/purchase-orders`, `/api/ads-alerts`.
  4. Chạy lại với `PLAN_TYPE=professional` và `enterprise`.
- Kỳ vọng:
  1. Module ngoài gói bị chặn bằng `403`.
  2. `GET /api/plan/info` phản ánh đúng plan, `maxUsers`, `modules`.

### `BE-AUTH-04` Negative auth

- Bước thực hiện:
  1. Login sai password.
  2. Login email không tồn tại.
  3. Gọi protected route với token rác.
  4. Gửi extra field ngoài DTO.
- Kỳ vọng:
  1. Reject đúng status code.
  2. Extra field bị chặn nhờ `forbidNonWhitelisted`.

## 8.3 S03 - Master data và cấu hình nền

### `BE-MASTER-01` User CRUD và trạng thái active/inactive

- Kiểm tra create, list, get, update, deactivate, reactivate, delete.
- Xác nhận email trùng bị chặn.
- Xác nhận user bị deactivate không login được hoặc không còn quyền sử dụng theo rule hệ thống.

### `BE-MASTER-02` Customer, product category, product

- Tạo category.
- Tạo product đúng category.
- Kiểm tra list, stats, by-category, delete.
- Kiểm tra behavior khi category bị xóa nhưng product còn tham chiếu.

### `BE-MASTER-03` Delivery status, production status, order status

- Kiểm tra CRUD status.
- Kiểm tra danh sách `active`, `final`, `payment-trigger`, `return`.
- Kiểm tra `seed` chỉ chạy khi `ALLOW_DANGEROUS_SEED=true`.

## 8.4 S04 - Ads foundation và reporting

### `BE-ADS-01` Fanpage -> API token -> Ad account -> Ad group

- Mục tiêu: xác nhận chuỗi phụ thuộc ads foundation.
- Bước thực hiện:
  1. Tạo fanpage.
  2. Tạo/sync API token.
  3. Tạo ad account.
  4. Tạo ad group với `fanpageId`, `adAccountId`, `agentId`, `productId`.
  5. Gọi `lookup`, `webhook-lookup`, `sync/status`.
- Kỳ vọng:
  1. Không tạo được ad group nếu thiếu `fanpageId`.
  2. Lookup và webhook mapping trả đúng entity.

### `BE-ADS-02` Advertising cost -> report -> KPI -> alerts

- Bước thực hiện:
  1. Tạo nhiều bản ghi advertising cost theo ngày và platform.
  2. Gọi summary, daily-summary, by-adgroup, conversation-cost.
  3. Chạy `ads-alerts/check`.
  4. Gọi employee KPI meta/stats.
- Kỳ vọng:
  1. Cost lên đúng ad group.
  2. KPI và alert thay đổi theo dữ liệu cost/doanh thu.

### `BE-ADS-03` Ad-group profit report và tối ưu chi tiêu

- Bước thực hiện:
  1. Tạo order gắn ad group.
  2. Tạo cost cùng ngày.
  3. Trigger recalc cost nếu cần.
  4. Gọi `ad-group-profit-report/performance`, `optimal-spend`, `summary`, `snapshots`.
- Kỳ vọng:
  1. Profit theo ad group tính đúng.
  2. Snapshot phản ánh dữ liệu mới nhất.

### `BE-ADS-04` Auto-scale và ripple update

- Mục tiêu: bảo vệ các luồng có tính lan tỏa cao nhất.
- Bước thực hiện:
  1. Tạo ad group test.
  2. Bơm order và advertising cost nhiều ngày.
  3. Gọi `budget-allocation/auto` hoặc `preview`.
  4. Gọi `finance/ad-groups/:id/recommendation` và `manual-scale`.
  5. Gọi lại dashboard/alerts/ad-group report.
- Kỳ vọng:
  1. Quyết định scale dựa trên cashflow + ROI + return rate.
  2. Không có scale vượt rule cap khi hệ thống đang warning/danger/critical.

## 8.5 S05 - Orders, pending order, payment batch, profit propagation

### `BE-ORD-01` Pending order -> approve -> order chính thức

- Mục tiêu: xác nhận luồng tạo đơn nháp sang đơn chính thức.
- Bước thực hiện:
  1. Tạo pending order có `adGroupId`.
  2. Approve pending order.
  3. Gọi lại `test-order2/:id`, pending order list và các report liên quan.
- Kỳ vọng:
  1. Pending order chuyển trạng thái hợp lệ.
  2. Order chính thức được tạo đúng mapping supplier/agent/product/adGroup.

### `BE-ORD-02` Order lifecycle và recalculation

- Bước thực hiện:
  1. Tạo order.
  2. Update `productionStatus`, `orderStatus`, `deliveryStatus`.
  3. Gọi `recalculate-profits`, `recalculate-quotes`, `recalculate-all-profits`.
- Kỳ vọng:
  1. `grossProfit`, `netProfit`, quote áp dụng đúng theo ngày và trạng thái.
  2. Trạng thái không hợp lệ bị chặn.

### `BE-ORD-03` Order -> supplier payable và agent payable/receivable

- Bước thực hiện:
  1. Tạo order hoàn chỉnh có supplier và agent.
  2. Kiểm tra `supplier-payables`, `agent-payables` hoặc `agent-receivables`.
  3. Gọi summary/cashflow/statement.
- Kỳ vọng:
  1. Công nợ tự sinh đúng chiều tiền và đúng đối tượng.
  2. Giá trị khớp với quote và dữ liệu order.

### `BE-ORD-04` Supplier payment batch và agent payment batch atomic

- Mục tiêu: bảo vệ rủi ro double-pay.
- Bước thực hiện:
  1. Tạo payment batch supplier.
  2. Tạo payment batch agent thường.
  3. Chạy đồng thời nhiều request vào `POST /api/test-order2/agent-payment-batch/atomic`.
- Kỳ vọng:
  1. Chỉ một request thành công nếu cùng bộ order.
  2. Order và batch history không bị duplicate.

### `BE-ORD-05` Export/import và báo cáo lợi nhuận

- Bước thực hiện:
  1. Export JSON.
  2. Export CSV.
  3. Import JSON.
  4. Gọi `daily-profit-report`, `product-profit-report`, `ad-report/cost-per-order`.
- Kỳ vọng:
  1. Export không lỗi encoding.
  2. Import không tạo trùng hoặc sai schema.
  3. Số liệu report khớp dữ liệu đã tạo.

## 8.6 S06 - Finance deep, funds, capital allocation, cashflow control

### `BE-FIN-01` Funding source, cashflow, available funds

- Bước thực hiện:
  1. Tạo funding source.
  2. Tạo cashflow in/out.
  3. Gọi `summary`, `available-funds/current`, `available-funds`, `capture`.
- Kỳ vọng:
  1. Available fund tính đúng theo mode.
  2. Snapshot lưu đúng thời điểm và note.

### `BE-FIN-02` Financial control dashboard và force refresh

- Bước thực hiện:
  1. Gọi `dashboard`, `full`, `forecast`, `optimal-ads`.
  2. Chỉnh dữ liệu nền như order/payment/cost.
  3. Gọi lại `dashboard?forceRefresh=true`.
- Kỳ vọng:
  1. Số liệu mới phản ánh ngay khi `forceRefresh=true`.
  2. `module-health` và `actions` trả hợp lý.

### `BE-FIN-03` Funds controller và công thức CFO

- Bước thực hiện:
  1. Gọi `funds/overview`, `committed-cash`, `ads`, `survival-buffer`, `owner`, `formulas`.
  2. Đối chiếu công thức:
     - FreeCash
     - SurvivalFloor
     - AvailableAfterSurvival
     - AdsBudgetApproved
     - OwnerWithdrawable
- Kỳ vọng:
  1. Các quỹ cộng/trừ nhất quán.
  2. Không phát sinh số âm ngoài rule cho phép.

### `BE-FIN-04` Capital allocation và budget allocation

- Bước thực hiện:
  1. Tạo policy capital allocation.
  2. Gọi `compute`, `snapshots`, `snapshots/latest`, `reinvestment-budget`.
  3. Gọi `budget-allocation/status`, `preview`, `auto`.
- Kỳ vọng:
  1. Policy active được áp dụng đúng.
  2. Allocation phản ánh health hệ thống và dữ liệu ad group.

### `BE-FIN-05` Cashflow control sub-controllers

- Bước thực hiện:
  1. Gọi `cashflow/dashboard/summary`.
  2. Gọi `cashflow/ads/decision`.
  3. Gọi `cashflow/alerts`.
  4. Gọi `cashflow/funds/status`.
  5. Gọi `cashflow/profit/summary`.
- Kỳ vọng:
  1. Tất cả cùng đọc ra cùng trạng thái risk level.
  2. Không mâu thuẫn giữa dashboard, alert và decision.

## 8.7 S07 - Owner fund và loan management

### `BE-OWN-01` Owner CRUD, transactions, statistics

- Kiểm tra tạo/chỉnh sửa/xóa owner.
- Kiểm tra transaction history theo owner.
- Kiểm tra system statistics và fund summary.

### `BE-OWN-02` Withdrawal lifecycle

- Bước thực hiện:
  1. Tạo withdrawal.
  2. Approve.
  3. Complete.
  4. Chạy thêm nhánh reject và cancel.
- Kỳ vọng:
  1. Chuyển trạng thái hợp lệ từng bước.
  2. Không complete khi chưa approve.
  3. `approvedBy` được lưu đúng.

### `BE-OWN-03` Fund account transfer và owner withdraw

- Bước thực hiện:
  1. `transfer-in`
  2. `transfer-out`
  3. `withdraw`
  4. `PATCH /fund-account`
- Kỳ vọng:
  1. Balance owner fund và bank balance thay đổi đúng chiều.
  2. Không cho rút quá số dư theo rule.

### `BE-OWN-04` Loan disbursement -> repayment -> dashboard

- Bước thực hiện:
  1. Tạo loan contract.
  2. Disburse một hoặc nhiều lần.
  3. Tạo repayment schedule.
  4. Mark repayment paid.
  5. Gọi `loans/summary`, `repayments/upcoming`, `loan-contracts/summary/cashflow`.
- Kỳ vọng:
  1. Tiền giải ngân làm tăng bank balance hoặc available cash tương ứng.
  2. Payment cập nhật outstanding, due, summary và cashflow đúng.

### `BE-OWN-05` Historical withdrawal ledger reconcile

- Buoc thuc hien:
  1. Seed owner-fund historical rows co the thieu ledger/history parity.
  2. Chay dry-run reconcile.
  3. Chay apply reconcile.
  4. Chay re-apply / verify de dam bao idempotence.
- Ky vong:
  1. Dry-run noi ro anomaly count va missing amount.
  2. Apply chi them dung so ledger rows con thieu.
  3. Re-apply khong tao duplicate va verify quay ve `0` anomaly.

### `BE-OWN-06` Owner-fund mixed BSON normalization va delete guard

- Buoc thuc hien:
  1. Seed mixed string/ObjectId refs tren `withdrawals.ownerId`, `withdrawals.approvedBy`, `fund_transactions.ownerId`, `fund_transactions.createdBy`.
  2. Chay dry-run normalize.
  3. Chay apply normalize va verify re-apply.
  4. Thu `DELETE /owner-fund/owners/:id` khi owner con financial history.
- Ky vong:
  1. Dry-run thong ke dung candidate/blocker counts.
  2. Apply chi convert canonical ObjectId strings sang BSON `ObjectId`, khong tac dong row khac.
  3. Re-apply idempotent, verify khong con convertible refs.
  4. Delete-owner voi financial history tra `400` va owner van con doc duoc.

### `BE-OWN-07` Orphan owner identity audit

- Buoc thuc hien:
  1. Chay read-only orphan audit tren `withdrawals.ownerId` va `fund_transactions.ownerId`.
  2. So sanh distinct owner refs voi collection `owners`.
  3. Luu sample orphan docs, sample owner ids, va document counts.
  4. Neu snapshot chi gom cac orphan cluster exact-match da duoc allowlist trong cleanup helper thi chay cleanup dry-run de phan loai `eligible` / `blocked` / `unknown` cluster va thong ke candidate docs.
  5. Chi duoc chay cleanup `--apply` khi dry-run tra `0` `blockedClusters` va `0` `unknownClusters`.
  6. Sau apply, phai rerun audit theo thu tu tuan tu va chay re-apply idempotence check.
- Ky vong:
  1. Audit chi doc du lieu, khong tu restore owner va khong rebind lich su.
  2. Neu con orphan refs thi danh `FAILED_PRODUCT`/data debt ro rang, khong danh gia xanh gia.
  3. Cleanup helper chi duoc xoa exact known orphan fixture families tu audit snapshot; helper nay khong duoc dung de phat minh owner placeholder hay generic owner-restore.
  4. Neu co bat ky `blocked`/`unknown` cluster nao thi lane phai dung lai o trang thai `BLOCKED`/manual review.
  5. Sau khi apply thanh cong, audit verify phai ve `0` orphan refs va re-apply phai la no-op.

## 8.8 S08 - Payroll, labor, session-log, other cost

### `BE-PAY-01` Session logs -> labor cost -> labor statement -> payment

- Mục tiêu: test luồng payroll E2E thật sự.
- Bước thực hiện:
  1. Tạo employee test.
  2. Seed hoặc tạo session logs.
  3. Generate labor costs từ sessions.
  4. Tạo labor statement.
  5. Update KPI cho statement.
  6. Confirm statement.
  7. Post payment.
- Kỳ vọng:
  1. Statement chuyển `draft -> confirmed -> closed`.
  2. Sau full payment không còn unpaid payroll alert.
  3. Funds/cashflow phản ánh chi lương.

### `BE-PAY-02` Salary config và other cost lan sang finance

- Bước thực hiện:
  1. Upsert salary config.
  2. Tạo other cost.
  3. Confirm/mark paid other cost.
  4. Gọi funds overview, cashflow alert.
- Kỳ vọng:
  1. Công thức tính lương áp đúng.
  2. Other cost xuất hiện ở cash out và ảnh hưởng dashboard.

## 8.9 S09 - Supply chain, quotes, payable/receivable, purchase

### `BE-SUP-01` Agent quote và supplier quote

- Bước thực hiện:
  1. Tạo quote cho agent và supplier cùng product.
  2. Gọi latest, effective, history, by-agent, by-supplier.
  3. Tạo order ở ngày khác nhau để kiểm tra chọn quote theo hiệu lực.
- Kỳ vọng:
  1. Quote effective áp đúng ngày.
  2. Report và payable dựa đúng quote đang hiệu lực.

### `BE-SUP-02` Supplier payable, statement, payment summary

- Bước thực hiện:
  1. Tạo payable hoặc để order auto-create.
  2. Tạo statement.
  3. Add payment.
  4. Close.
  5. Reopen.
  6. Export CSV/PDF nếu có.
- Kỳ vọng:
  1. Statement total, paid, unpaid nhất quán.
  2. Không close statement lỗi trạng thái.

### `BE-SUP-03` Agent payable/receivable summary và cashflow

- Bước thực hiện:
  1. Upsert statement.
  2. Add payment.
  3. Close/reopen.
  4. Gọi `summary`, `summary/cashflow`, `summary/payment`.
- Kỳ vọng:
  1. Dữ liệu agent payable/receivable không lệch so với order source.

### `BE-SUP-04` Purchase order -> receive -> inventory -> price history

- Bước thực hiện:
  1. Tạo purchase order.
  2. Receive hàng nhiều lần nếu hệ thống cho phép.
  3. Kiểm tra `inventory/summary`, `inventory/:productId/transactions`.
  4. Gọi `purchase-orders/price-history`.
- Kỳ vọng:
  1. Tồn kho tăng đúng.
  2. Transaction log đúng loại nhập kho.
  3. Giá nhập được đưa vào price history.
  4. Active suite: `tests/backend/suites/modules/extended/module.purchase-inventory.ps1`
  5. Activation verified `2026-04-24 16:48:58 +07`: `FAILED_PRODUCT + FAILED_HARNESS -> FIXED_PRODUCT -> FIXED_HARNESS -> PASSED`
  6. Final rerun result: `84 PASS / 0 FAIL`
  7. Trace: `tests/backend/artifacts/results/qa-purchase-inventory-activation-summary-20260424-164858.md`

## 8.10 S10 - Return, delivery status, reports

### `BE-RET-01` Delivery status return/payment trigger

- Bước thực hiện:
  1. Dùng order có delivery status thường.
  2. Chuyển sang status thuộc `payment-trigger`.
  3. Chuyển sang status thuộc `return`.
  4. Gọi `stats/summary`.
- Kỳ vọng:
  1. Trigger payment và return được xác định đúng theo status config.
  2. Báo cáo thống kê cập nhật đúng.

### `BE-RET-02` Return request -> resolve -> return report

- Bước thực hiện:
  1. Tạo return request.
  2. Resolve bằng `items[].decision`.
  3. Gọi `return-report/ad-group` và `return-report/product`.
- Kỳ vọng:
  1. Resolve chỉ chấp nhận schema đúng.
  2. Tỷ lệ hoàn, số liệu report và tác động lợi nhuận được cập nhật.

## 8.11 S11 - Media, product image, chat, webhook

### `BE-MEDIA-01` Upload/import media và liên kết sản phẩm

- Bước thực hiện:
  1. Upload file ảnh hợp lệ có `alt`.
  2. Import bằng URL.
  3. Liên kết với product.
  4. Gọi `product-report`, `validate-product-images`, `cleanup-orphaned`.
- Kỳ vọng:
  1. Không chấp nhận thiếu `alt`.
  2. URL phục vụ file đúng prefix public.
  3. Cleanup không xóa nhầm media còn dùng.

### `BE-MEDIA-02` Public serve và chống path traversal

- Bước thực hiện:
  1. Gọi URL file hợp lệ.
  2. Gọi URL path traversal như `../`.
  3. Gọi file không tồn tại.
- Kỳ vọng:
  1. File hợp lệ trả đúng content-type.
  2. Path traversal bị chặn `403`.
  3. File thiếu trả `404`.

### `BE-CHAT-01` Conversation flow và manual operations

- Bước thực hiện:
  1. Seed fanpage + api token + chat message.
  2. Gọi list conversations.
  3. Gọi detail conversation.
  4. Toggle auto-ai.
  5. Resolve conversation.
  6. Gọi extract-order.
- Kỳ vọng:
  1. Conversation state cập nhật đúng.
  2. Extract order draft không làm hỏng conversation gốc.

### `BE-CHAT-02` Messenger webhook verify và receive

- Bước thực hiện:
  1. Verify với token đúng.
  2. Verify với token sai.
  3. POST payload message mẫu.
  4. Gửi lại cùng payload để test duplicate.
- Kỳ vọng:
  1. Verify đúng trả challenge.
  2. POST nhận message phải ACK nhanh `200`.
  3. Duplicate không tạo side effect sai.

## 8.12 S12 - Order update, ops, emergency, deprecated/system endpoints

### `BE-OPS-01` Excel order update

- Bước thực hiện:
  1. `POST /api/order-update/preview` với file hợp lệ.
  2. `POST /api/order-update/check-status`.
  3. `POST /api/order-update/excel`.
  4. Lặp lại với file sai MIME và file >10MB.
- Kỳ vọng:
  1. Preview không cập nhật DB.
  2. Check-status trả đúng `updatable/completed/notFound`.
  3. Excel apply chỉ cập nhật order hợp lệ.
  4. File sai bị reject rõ ràng.

### `BE-OPS-02` Emergency actions và ops suggestions

- Bước thực hiện:
  1. `GET /api/emergency-actions?date=...`
  2. `POST /api/emergency-actions/bulk-sync`
  3. `PATCH /api/emergency-actions/:taskId/toggle`
  4. `GET /api/emergency-actions/overdue`
  5. `GET /api/ops-actions/suggestions`
- Kỳ vọng:
  1. Task sync đúng số `upserted/existing/updated/removed/reset`.
  2. Overdue và suggestion phản ánh dữ liệu thực.

### `BE-OPS-03` Deprecated và compatibility endpoint

- Bước thực hiện:
  1. `GET /api/google-sync/cred-check`
  2. `GET /api/google-sync/auth-debug`
- Kỳ vọng:
  1. `cred-check` trả trạng thái deprecated có `replacement`.
  2. Không gây hiểu nhầm là luồng sync chính thức vẫn còn dùng.

## 9. Bộ test negative và security cần bắt buộc có

### 9.1 Validation

- Thiếu field bắt buộc.
- Sai kiểu dữ liệu.
- Gửi field lạ ngoài DTO.
- ObjectId sai format.
- Số âm ở amount, quantity, budget nơi không cho phép.

### 9.2 Auth và authorization

- Thiếu token.
- Token rác.
- Token role thấp gọi route admin/finance.
- User thuộc plan thấp gọi module cao hơn.

### 9.3 Business rule

- Approve lại cùng pending order.
- Complete withdrawal khi chưa approve.
- Pay repayment 2 lần.
- Payment batch cùng order 2 lần.
- Receive purchase vượt quá rule nếu service có ràng buộc.
- Return resolve thiếu `items[].decision`.

### 9.4 File và media

- Upload file không phải Excel vào `order-update`.
- Upload media không có `alt`.
- URL import media hỏng.
- Media serve với path traversal.

### 9.5 External integration resilience

- Facebook/Google/TikTok credential sai.
- API timeout hoặc HTTP 4xx/5xx từ bên ngoài.
- Webhook verify token thiếu ở production.
- Hệ thống vẫn phải log và fail an toàn, không corrupt dữ liệu nội bộ.

## 10. Bộ test concurrency và consistency nên có riêng

### `CON-01` Agent payment atomic

- Chạy đồng thời 5-20 request vào `agent-payment-batch/atomic`.
- Kỳ vọng chỉ 1 request thành công cho cùng tập order.

### `CON-02` Webhook duplicate delivery

- Gửi lặp lại cùng message event.
- Kỳ vọng không nhân đôi conversation/message side effect.

### `CON-03` Recalculate cost và dashboard refresh

- Tạo cost mới, gọi `cron/recalculate-costs`, rồi đọc financial-control/funds/report ngay sau đó.
- Kỳ vọng dữ liệu nhất quán khi `forceRefresh=true`.

### `CON-04` Quote effective change vs existing order

- Thay quote giữa chừng, recalculate quotes cho order cũ/mới.
- Kỳ vọng order dùng quote đúng theo order date, không bị áp quote mới sai thời điểm.

## 11. Bộ test performance smoke

Không cần benchmark nặng ngay từ đầu, nhưng nên có ngưỡng cảnh báo cho staging:

- `GET /health` < 500ms
- `POST /api/auth/login` < 1s
- `GET /api/financial-control/dashboard` < 3s
- `GET /api/test-order2?page=1&limit=20` < 2s
- `GET /api/ad-group-profit-report/performance` < 4s
- `GET /api/funds/overview` < 2s

Nếu vượt ngưỡng liên tiếp, đánh dấu defect performance hoặc cần cache/query optimization.

## 12. Kế hoạch chạy test theo chu kỳ

### 12.1 Mỗi PR backend

- S01 Smoke
- S02 Auth/RBAC/plan gate
- S05 Order P0
- S06 Finance P0
- `CON-01` payment atomic

### 12.2 Nightly trên staging

- Chạy trực tiếp `tests/backend/runners/run-backend-module-regression.ps1` khi staging/external backend da duoc bootstrapped san
- Dung `test-all-modules.ps1` cho local reproduction/default QA path khi can mot backend dedicated khong phu thuoc `localhost:3000`
- Chạy thêm các script E2E chưa có trong master runner:
  - `e2e.order-to-cashflow.ps1`
  - `e2e.ops-payroll.ps1`
  - `e2e.ads-auto-scale.ps1`
- `e2e.order-finance-impact.ps1`

### 12.3 Trước release

- Full regression tất cả suite S01-S14.
- So sánh snapshot số liệu giữa:
  - order report
  - ad-group report
  - supplier/agent payable
  - funds overview
  - financial-control dashboard

### 12.4 Sau deploy production

- Chỉ chạy smoke an toàn:
  - health
  - login
  - profile
  - 1 route report read-only
  - 1 route finance read-only
  - webhook verify read-only

## 13. Entry criteria và exit criteria

### 13.1 Entry criteria

- Backend deploy thành công.
- DB test sạch hoặc đã seed baseline.
- Tài khoản test chuẩn có sẵn.
- Feature flags và env vars được xác nhận.

### 13.2 Exit criteria

- Không còn defect P0/P1 mở.
- Tất cả suite P0 pass.
- Các suite P1 pass hoặc có waiver rõ ràng, được chấp thuận.
- Không còn mismatch số liệu giữa report lõi và nguồn gốc dữ liệu.

## 14. Đề xuất cải thiện sau khi lập kế hoạch

### 14.1 Chuẩn hóa baseline test

- Chọn một nguồn sự thật duy nhất cho kết quả regression.
- Không để `AGENTS.md`, `tests/backend/legacy/docs/TEST-PLAN-20260223.md` và snapshot kết quả mới lệch nhau nếu vẫn còn được dùng làm tham chiếu.
- Ghi rõ ngày chạy, commit hash, môi trường và dataset.

### 14.2 Chuẩn hóa cấu trúc test

- Tách helper chung cho PowerShell.
- Đưa E2E scripts vào một thư mục thống nhất.
- Tạo seed dataset chuẩn bằng script riêng.
- Nếu có thể, bổ sung harness `backend/test/e2e` chuẩn NestJS/Supertest cho smoke và contract test.

### 14.3 Tăng quan sát khi fail

- Mỗi suite nên log:
  - request
  - response status
  - entity id tạo ra
  - snapshot số liệu trước/sau
- Khi fail ở E2E lan tỏa, phải dump thêm:
  - order
  - payable/receivable
  - funds overview
  - financial-control dashboard
  - ad-group report liên quan

## 15. Kết luận QA

Backend này không còn ở mức CRUD đơn lẻ; đây là hệ thống ERP có logic lan tỏa giữa nhiều domain. Vì vậy tiêu chí pass không thể chỉ là “endpoint trả 200”, mà phải là:

- đúng quyền
- đúng dữ liệu
- đúng phép tính
- đúng hiệu ứng phụ
- đúng tính nhất quán sau khi dữ liệu lan sang finance, alert, report và dashboard

Tài liệu này nên được dùng làm chuẩn để:

- gom lại toàn bộ test PowerShell đang có
- bổ sung các gap chưa được master runner bao phủ
- thiết kế regression backend trước mỗi đợt release
- giảm rủi ro sai số liệu tài chính, double-pay, sai quote, sai plan gate và sai cashflow decision
## 16. Coverage gaps to add

Legacy notes ben duoi da duoc supersede boi block review clean sau day.

### 16.1 Coverage status notes

- `suite-index.md` chi la danh sach active suite hien dang co file regression.
- Section nay la backlog QA da duoc xac nhan qua multi-agent review.
- `BE-AUTH-05` va `BE-AUTH-06` da duoc chuyen sang `active_automated` qua `module.auth-hardening.ps1`.
- Targeted auth activation round ngay `2026-04-15` da pass `68 PASS / 0 FAIL` tren `module.auth-hardening.ps1`, `module.auth-rbac.ps1`, va `module.customer.ps1`.
- Targeted auth rerun ngay `2026-04-19` da pass `60 PASS / 0 FAIL` tren `module.auth-hardening.ps1` va `module.auth-rbac.ps1` sau khi fix harness env whitespace drift va orphan `3100` cleanup.
- `inventory/*` da live tu truoc qua transitive imports; runtime blocker cu chi dung cho `purchase-orders`.
- `purchase-orders` da duoc wire vao `AppModule` trong round `2026-04-24`; `BE-SUP-04` sau do da duoc nang len `active_automated` bang `tests/backend/suites/modules/extended/module.purchase-inventory.ps1`.
- Activation round `2026-04-24 16:48:58 +07` cho `BE-SUP-04` da ghi lai du trace `FAILED_PRODUCT + FAILED_HARNESS -> FIXED_PRODUCT -> FIXED_HARNESS -> PASSED`, final `84 PASS / 0 FAIL`.
- Related ripple rerun cung ngay cho `module.supply-chain.ps1` ghi lai `BLOCKED_ENV -> FIXED_ENV -> PASSED`, final `28 PASS / 0 FAIL`.
- `e2e.public-contracts-resilience.ps1` da duoc kich hoat trong ngay `2026-04-19`; sau khi `LOAD-01`, `LOAD-02`, `LOAD-03`, va `LOAD-04` duoc active bang `tests/backend/perf/perf.load-smoke.k6.js`, `tests/backend/perf/perf.spike-public.k6.js`, `tests/backend/perf/perf.write-contention.k6.js`, va `tests/backend/perf/perf.analytics-read.k6.js`, nhom gap uu tien con lai hien tai la `LOAD-05+`, cung mot so contract-status semantics va env-matrix follow-up cho command endpoint.

### 16.2 Additional env vars and fixtures to control

- Env vars can them vao checklist QA:
  - `AUTH_ENABLE_IP_RESTRICTION`
  - `ENFORCE_AD_ACCOUNT_TIMEZONE`
  - `FB_SENDING_ENABLED`
  - `MESSAGE_TAG`
  - `APP_PUBLIC_ORIGIN`
- Fixtures can them vao du lieu test:
  - CSV hop le, CSV sai schema, CSV co BOM cho `import-users`
  - media URL co encoded traversal nhu `%2e%2e/`
  - credentials JSON hop le/loi cho `order-sheet-sync`
  - token/provider settings hop le/loi cho `api-token`

### 16.3 Additional cases confirmed for existing suites

#### S02 - Auth, RBAC, permission, plan gate

### `BE-AUTH-05` Register security and duplicate rules

- Test `POST /api/auth/register` voi duplicate email, field ngoai whitelist, va active-user cap.
- Xac nhan register khong mo them duong bypass role/permission.
- Trang thai hien tai: `active_automated` qua `module.auth-hardening.ps1`.
- Vong kich hoat suite ngay `2026-04-15`: `FAILED -> FIXED_HARNESS -> PASSED`.
- Vong rerun ngay `2026-04-19`: `FAILED -> FIXED_HARNESS_ENV -> FIXED_CLEANUP -> PASSED`.

### `BE-AUTH-06` Token lifecycle edge cases and IP restriction

- Test expired token, missing token, revoked token, logout lap lai sau logout.
- Lap lai voi `AUTH_ENABLE_IP_RESTRICTION` bat/tat de khoa hanh vi theo env.
- Trang thai hien tai: `active_automated` qua `module.auth-hardening.ps1`.
- Vong kich hoat suite ngay `2026-04-15`: `FAILED -> FIXED_ENV -> PASSED` sau khi dung dung instance IP restriction rieng voi `AUTH_ENABLE_IP_RESTRICTION=true`.
- Vong rerun ngay `2026-04-19`: `PASSED` sau khi fix quoting env `cmd set` va trim bien `AUTH_ENABLE_IP_RESTRICTION` truoc khi so sanh.

#### S03 - Master data, users, import/export

### `BE-MASTER-04` User selector endpoints for ads and orders

- Cover `agents`, `agents-for-ads`, `ads-operators`, `suppliers-for-orders`, `suppliers`, `email/:email`.
- Xac nhan role, `isActive`, filter query, va pham vi du lieu tra ve.

### `BE-MASTER-05` Export users CSV

- Cover `stats`, `preview`, `csv`, role filter, `activeOnly`, header download, va CSV injection payload.
- Khoa ro auth policy mong muon cho endpoint export vi lien quan PII.

### `BE-MASTER-06` Import users CSV

- Cover wrong MIME, empty file, oversize file, malformed CSV, BOM, duplicate email, role mapping, va `validate` truoc khi import.

#### S04 - Ads foundation, tokens, timezone

### `BE-ADS-05` API token lifecycle and provider settings

- Active suite: `module.api-token-timezone.ps1`
- Covered in verified round `2026-04-19 01:58:10 +07` with `22 assertions` on `http://localhost:3600/api`, strict companion `http://localhost:3610/api`, and Mongo `mongodb://127.0.0.1:27017/htxbachgia`
- Security/contract note: `api-tokens` permission is director+manager only; employee is blocked.

- Cover `validate`, `set-primary`, `rotate`, `system-user/sync`, `settings/google`, `settings/tiktok`, `test/google`, `test/tiktok`.
- Xac nhan source precedence va fallback khi provider response loi.

### `BE-ADS-06` Ad account timezone matrix

- Cover timezone hop le/sai cho Facebook, Google, TikTok.
- Lap lai voi `ENFORCE_AD_ACCOUNT_TIMEZONE` bat/tat va truong hop thieu external credential.
- Verified strict/non-strict timezone activation round passed; strict companion `http://localhost:3610/api` is now covered against PATCH bypass in `backend/src/ad-account/ad-account.service.ts`.

#### S09 / S12 - Supply chain, purchase, inventory

### `BE-SUP-04` Purchase and inventory wiring status

- Trang thai sau round `2026-04-24`:
  - `inventory/*` da live qua transitive imports va da duoc probe `200` cho director.
  - `purchase-orders` da duoc wire vao `AppModule`; route doi tu `404` sang guarded `401`/`200`.
  - `tests/backend/suites/modules/extended/module.purchase-inventory.ps1` da duoc kich hoat va verify `2026-04-24 16:48:58 +07`.
  - activation trace: `FAILED_PRODUCT + FAILED_HARNESS -> FIXED_PRODUCT -> FIXED_HARNESS -> PASSED`, initial `50 PASS / 14 FAIL`, rerun `84 PASS / 0 FAIL`.
  - root causes da dong trong same round:
    - product: `purchase-orders/price-history` bi route-shadow boi `@Get(':id')`
    - harness: singleton transaction/history collections bi unwrap thanh scalar trong helper PowerShell
  - related ripple rerun `2026-04-24 16:48:58 +07`: `module.supply-chain.ps1` = `BLOCKED_ENV -> FIXED_ENV -> PASSED`, `28 PASS / 0 FAIL`, tren isolated backend sau khi direct default-base run bi block.
  - purchase contract hardening verify `2026-04-24 18:29:22 +07`: `module.purchase-inventory.ps1` = `101 PASS / 0 FAIL`
    - `backend/src/purchase/purchase-order.service.ts` hien validate raw `purchase-orders/:id` va `supplierId` filter bang `Types.ObjectId.isValid`
    - malformed id/filter tra `400`; valid-but-missing single-resource id giu `404`; valid missing supplier filter giu `200` + empty result
  - related ripple rerun `2026-04-24 18:38:59 +07`: `module.supply-chain.ps1` = `28 PASS / 0 FAIL`
- Full gate va audit:
  - canonical full module regression da xanh `2026-04-24 17:22:35 +07` voi `1145 PASS / 0 FAIL`, `25/25` suites; audit failure cung ngay cho `module.finance-survival-alerts.ps1` van duoc giu tai `module-regression-rerun-20260424-170012.log` / `module-regression-20260424-170022.json`
  - canonical rerun dau tien sau purchase-objectid hardening `2026-04-24 18:39:56 +07` fail `1160 PASS / 2 FAIL`, blocker duy nhat la `module.db-seed-cleanup.ps1`
    - failure mode: `FAILED_ENV`
    - root cause: backend external cua full runner dang cleanup media o `MEDIA_DIR` khac voi temp `DB06_MEDIA_DIR` ma helper DB-06 seed orphan file vao
  - harness/env closure:
    - `tests/backend/suites/modules/extended/module.db-seed-cleanup.ps1` nay yeu cau explicit `DB06_MEDIA_DIR` khi suite chay voi `BACKEND_BASE_URL` external; mismatch env duoc phan loai `BLOCKED` thay vi false product fail
    - blocked preflight probe `2026-04-24 18:57:10 +07`: `module.db-seed-cleanup.ps1` = `BLOCKED`, `0 PASS / 0 FAIL / 1 BLOCKED` khi external backend duoc truyen vao ma khong couple `DB06_MEDIA_DIR`
    - targeted rerun `2026-04-24 18:46:56 +07`: `module.db-seed-cleanup.ps1` = `FAILED_ENV -> FIXED_HARNESS -> FIXED_ENV -> PASSED`, `51 PASS / 0 FAIL`
    - canonical rerun `2026-04-24 18:48:04 +07`: `tests/backend/runners/run-backend-module-regression.ps1` = `FAILED_ENV -> FIXED_HARNESS -> FIXED_ENV -> PASSED`, `1163 PASS / 0 FAIL`, `25/25` suites
  - runner bootstrap closure `2026-04-24 19:19:52 +07`:
    - `tests/backend/runners/run-backend-module-regression.ps1` nay auto-alias `MEDIA_DIR -> DB06_MEDIA_DIR` cho local same-shell external-backend flow
    - direct `module.db-seed-cleanup.ps1` probe `2026-04-24 19:09:11 +07`: `BLOCKED`, `0 PASS / 0 FAIL / 1 BLOCKED` khi chi co `BACKEND_BASE_URL` ma thieu `DB06_MEDIA_DIR`
    - canonical green verification `2026-04-24 19:09:19 +07`: `1163 PASS / 0 FAIL / 0 BLOCKED` voi backend external + runner shell co `MEDIA_DIR` nhung khong set `DB06_MEDIA_DIR`
    - canonical blocked verification `2026-04-24 19:15:47 +07`: `1112 PASS / 0 FAIL / 1 BLOCKED` khi cung backend external do duoc chay lai sau khi xoa ca `MEDIA_DIR` va `DB06_MEDIA_DIR` khoi runner shell; `BLOCKED` khong con bi ep thanh `FAIL`
  - local QA bootstrap closure `2026-04-24 19:44:06 +07`:
    - `tests/backend/runners/run-backend-module-regression-local.ps1` nay build backend bang `npm.cmd run build`, start mot backend local dedicated tren port free, inject tam thoi `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`, `AUTH_RBAC_BASE_URL`, `AUTH_HARDENING_BASE_URL`, `MONGODB_URI`, `MEDIA_DIR`, roi delegate vao canonical runner
    - bootstrap smoke dau tien expose harness drift `Unknown command: "pm"` khi wrapper goi `npm`; wrapper da duoc sua sang `npm.cmd run build` truoc khi rerun full gate
    - `test-all-modules.ps1` shared-DB override verification `2026-04-24 19:31:50 +07`: `PASSED`, `1163 PASS / 0 FAIL / 0 BLOCKED`, backend local `http://localhost:60384/api`
    - `test-all-modules.ps1` clean-shell verification `2026-04-24 19:38:02 +07`: `PASSED`, `1163 PASS / 0 FAIL / 0 BLOCKED`, backend local `http://localhost:60707/api`, auto-generated DB `mongodb://127.0.0.1:27017/htxbachgia_module_regression_local_20260424193802`
    - traceable summary: `tests/backend/artifacts/results/qa-local-bootstrap-summary-20260424-194406.md`
  - external runtime manifest closure `2026-04-24 20:11:07 +07`:
    - pre-fix direct reproduce `module.db-seed-cleanup.ps1`: `BLOCKED`, `0 PASS / 0 FAIL / 1 BLOCKED`, du manifest da ton tai va co `db06MediaDir`, vi harness chua biet doc `BACKEND_RUNTIME_MANIFEST`
    - harness files `tests/backend/setup/backend-runtime-manifest.ps1`, `tests/backend/runners/write-backend-runtime-manifest.ps1`, `tests/backend/runners/run-backend-module-regression.ps1`, `tests/backend/suites/modules/extended/module.db-seed-cleanup.ps1` nay da them machine-readable external-backend contract
    - post-fix direct rerun `2026-04-24 20:00:52 +07`: `module.db-seed-cleanup.ps1` = `BLOCKED -> FIXED_HARNESS -> PASSED`, `51 PASS / 0 FAIL`
    - canonical pass verification `2026-04-24 20:01:27 +07`: `tests/backend/runners/run-backend-module-regression.ps1` = `PASSED`, `1163 PASS / 0 FAIL / 0 BLOCKED`, chi voi `BACKEND_RUNTIME_MANIFEST`
    - canonical blocked verification `2026-04-24 20:06:46 +07`: `tests/backend/runners/run-backend-module-regression.ps1` = `BLOCKED`, `1112 PASS / 0 FAIL / 1 BLOCKED` khi manifest co base URL va Mongo nhung co y thieu `db06MediaDir`
    - traceable summary: `tests/backend/artifacts/results/qa-runtime-manifest-summary-20260424-201107.md`
- Note van hanh:
  - khong con gap mo cho malformed `purchase-orders/:id` contract; risk nay da dong bang suite active + ripple rerun + full gate
  - neu chay canonical runner tren backend external cung shell local, export `MEDIA_DIR` la du de DB-06 couple dung media root; khong can lap lai `DB06_MEDIA_DIR`
  - neu chay direct `module.db-seed-cleanup.ps1` hoac backend external nam ngoai shell hien tai, van phai truyen explicit `DB06_MEDIA_DIR` hoac `BACKEND_RUNTIME_MANIFEST` co `db06MediaDir`
  - neu external backend duoc target ma shell runner khong co ca `MEDIA_DIR` lan `DB06_MEDIA_DIR`, canonical lane se ket thuc `BLOCKED` thay vi false `FAIL`
  - runtime manifest chi giai quyet contract bootstrap; neu manifest thieu `db06MediaDir`, lane van phai `BLOCKED`
  - local default lane khong con phu thuoc service co san tren `localhost:3000`; drift `backend/.env` chi con la open risk cho direct/isolate/external rounds ngoai wrapper

#### S11 - Media, chat, webhook

### `BE-MEDIA-03` Media public alias parity and encoded traversal

- Test cac alias public khac nhau cua media, canonical path, DB fallback, va encoded traversal `%2e%2e/`.
- Trang thai hien tai: `active_automated` qua `e2e.public-contracts-resilience.ps1`.
- Verified round `2026-04-19 03:24:15 +07`: `PASSED` sau khi fix `backend/src/media/media.controller.ts` de `/api/media/serve/:year/:month/:filename` giu alias parity, `403` cho encoded traversal, va DB fallback thong nhat voi legacy `/media`.

### `BE-CHAT-03` Send-side env matrix and 24h policy

- Test `FB_SENDING_ENABLED=0`, ngoai cua so 24h, `MESSAGE_TAG` hop le/khong hop le, image send, AI send.
- Trang thai hien tai: `active_automated` qua `e2e.public-contracts-resilience.ps1`.
- Verified round `2026-04-19 03:24:15 +07`: `PASSED` sau khi fix `backend/src/chat-message/chat-message.controller.ts` de image-send URL/multipart khong con bypass gate 24h khi `FB_SENDING_ENABLED=0`.

#### S12 - Ops, emergency, order-sheet-sync

### `BE-OPS-04` Order sheet sync credentials and lifecycle

- Cover `status`, `credentials`, `test-credentials`, `agents-suppliers`, sync theo agent/supplier, va sync all.
- Co negative case cho malformed JSON credential va missing credential.

### `BE-OPS-05` Emergency overdue boundary and verification-failed alert

- Test moc overdue theo Asia/Ho_Chi_Minh.
- Test nhanh `change-budget` verification failed de xac nhan alert path.

### `BE-OPS-06` Emergency bulk-sync diff semantics

- Kiem tra `updated`, `removed`, `reset`, `existing` khi payload thay doi giua cac lan `bulk-sync`.

#### S13 - Public endpoints, bootstrap env, resilience

### `BE-PUB-01` Advertising-cost-public contract

- Cover `GET /api/advertising-cost-public/yesterday-spent` voi truong hop co du lieu/khong co du lieu.
- Xac nhan contract on dinh va khong yeu cau JWT.
- Trang thai hien tai: `active_automated` qua `e2e.public-contracts-resilience.ps1`.
- Verified round `2026-04-19 03:24:15 +07`: contract public giu `200` cho ca empty dataset va seeded yesterday-spent map.

### `BE-PUB-02` Webhook bootstrap env fallback

- Cover `MESSENGER_VERIFY_TOKEN` / `FB_VERIFY_TOKEN` co va khong co.
- Cover `PUBLIC_ORIGIN` / `APP_PUBLIC_ORIGIN` co va khong co, verify webhook, media public prefix.
- Trang thai hien tai: `active_automated` qua `e2e.public-contracts-resilience.ps1`.
- Verified round `2026-04-19 03:24:15 +07`: fallback dev token, explicit `MESSENGER_VERIFY_TOKEN`, `PUBLIC_ORIGIN`, va `APP_PUBLIC_ORIGIN` bootstrap logs deu duoc verify.

### `BE-PUB-03` Supplier payable PDF token access

- Cover query token hop le, token sai, token het han, token thieu.
- Trang thai hien tai: `active_automated` qua `e2e.public-contracts-resilience.ps1`.
- Verified round `2026-04-19 03:24:15 +07`: token missing/invalid/expired deu `401`, JWT hop le tra `200` voi HTML preview.

### `BE-PUB-04` Deprecated compatibility endpoints

- Kiem tra endpoint deprecated van tra `replacement` / `warning` ro rang va khong bi nham la luong chinh.
- Trang thai hien tai: `active_automated` qua `e2e.public-contracts-resilience.ps1`.
- Verified round `2026-04-19 03:24:15 +07`: `google-sync/cred-check` giu `status=DEPRECATED` va tra `replacement.syncAgent` / `replacement.syncAll` ro rang.

### 16.4 Additional concurrency and consistency cases

### Legacy note (superseded) - `CON-05` Supplier payment batch idempotency

- Chay lai cung `batchId` hoac chay song song `POST /api/test-order2/supplier-payment-batch`.
- Ky vong khong double-pay va khong drift `supplierPaidAt` / summary.

### `CON-06` Agent payment finalize race

- Chay song song `agent-payment-batch` va/hoac `agent-payment-batch/atomic` tren cung tap order.
- Ky vong `realizedAt`, `realizedGrossProfit`, `realizedNetProfit` chi chot mot lan.

### `CON-07` Owner withdrawal approval race

- Gui 2 request `approve`, `approve vs reject`, va `approve vs cancel` gan nhu dong thoi cho cung withdrawal.
- Ky vong `availableBalance`, `totalWithdrawn`, `approvedBy`, `approvedDate`, `transactionReference`, va terminal status khong bi drift hoac double-apply.

- Latest rerun `2026-04-24 22:27:20 +07`:
  - `tests/backend/suites/e2e-flows/e2e.concurrent-finance-ripple.ps1`: same-round metadata hardening first closed `FAILED_HARNESS`, `64 PASS / 3 FAIL`, because a duplicate helper override shadowed the intended terminal-metadata assertion helper
  - same suite rerun on the same isolated backend then closed `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`, `61 PASS / 0 FAIL`
  - no product bug was reproduced for `approve vs reject` / `approve vs cancel`; the winning terminal action kept coherent balance deltas and approval metadata

### `CON-08` Return resolve duplicate and rollback

- Resolve 2 lan, mixed `restock` / `scrap`, hoac ep loi giua transaction.
- Ky vong khong co partial side effect neu transaction fail.

### `CON-09` Other-cost timezone boundary recalc

- Tao / confirm / remove `other-cost` sat midnight local/UTC.
- Ky vong recalc chi chay dung candidate days, khong miss va khong duplicate snapshot.
- Status update `2026-04-19 08:11:05 +07`:
  - now `active_automated` via `tests/backend/suites/modules/extended/module.db-consistency.ps1`
  - verified same-day Bangkok boundary on list, summary, `dueByDay7d`, `ops` snapshot, and `financial-control` ripple
- Shared-DB follow-up `2026-04-24 16:27:12 +07`:
  - first rerun on `mongodb://127.0.0.1:27017/htxbachgia` closed `60 PASS / 8 FAIL` as `FAILED_HARNESS`, not product regression
  - root cause: phase `CON-09` still assumed clean-DB absolute totals while the shared DB already contained one unrelated unpaid `other-cost=12345`
  - suite was fixed to assert deltas against the live baseline, then rerun on the same shared DB closed `77 PASS / 0 FAIL`

### `CON-10` Post-ripple reconciliation across summaries

- Sau `supplier-payment-batch`, `return-request/resolve`, `other-cost confirm`, doi soat:
  - `supplier-payable`
  - `agent-receivable`
  - `financial-control/dashboard`
  - `cashflow/dashboard/summary`
- Ky vong cac summary khong drift nhau sau ripple.

### 16.5 Expanded E2E ripple catalog

### `E2E-RIPPLE-01` Pending order -> approve -> order -> payable -> funds -> dashboard

- Tao `pending-order`, approve thanh `test-order2`, doi soat ripple qua `supplier-payable`, `agent-receivable`, `financial-control`, `funds`, `cashflow`.
- Khoa case khi approve fail nua chung, approve lap lai, hoac update order sau approve.

### `E2E-RIPPLE-02` Advertising cost -> KPI -> alerts -> budget allocation -> recommendation

- Bom cost theo ngay/platform, doi soat `employee-ads-kpi`, `ads-alerts`, `ad-group-profit-report`, `budget-allocation`, recommendation/scale decision.
- Co case reverse trend, du lieu tre, va cost duplicate.

### `E2E-RIPPLE-03` Session log -> labor statement -> payroll payment -> cashflow

- Seed `session-log`, generate labor cost/statement, confirm/pay, doi soat `cashflow`, `financial-control`, payroll summary.
- Cover statement confirm lap lai, part-paid, over-paid, close/reopen.

### `E2E-RIPPLE-04` Return request -> resolve -> profit rollback -> reports

- Tu `return-request`, mixed `restock` / `scrap`, doi soat `return-report`, `order` profit fields, `ad-group-profit-report`, `cashflow`.
- Co case duplicate resolve va late resolve sau khi order da chot payment.
- Trang thai hien tai: `active_automated` qua `e2e.return-ripple.ps1`; activation `FAILED -> FIXED_PRODUCT -> PASSED` da verify trong ngay `2026-04-19`, va rerun sau finance follow-up tai `2026-04-19 10:31:04 +07` van xanh `64 PASS / 0 FAIL`.

### `E2E-RIPPLE-05` Owner fund / loan -> bank balance -> funds -> ads decision

- Tao loan disbursement, repayment, owner withdrawal/transfer, doi soat `funds`, `financial-control`, `budget-allocation`, `cashflow`.
- Co case repayment den han, repayment tre, approve/complete withdrawal sat nhau.
- Trang thai hien tai: `active_automated` qua `scenario.05-loan-owner-fund.ps1`, `e2e.order-finance-impact.ps1`, va `e2e.concurrent-finance-ripple.ps1`.
- Follow-up update `2026-04-19 10:27:08 +07`: `financial-control` bank balance da doc theo master ledger, va targeted `loan-management/pay` probe xac nhan `bankBalance 5000000 -> 4000000` cung luc `debt 5000000 -> 4000000`.

### `E2E-RIPPLE-06` Order update Excel -> order status -> report/cashflow

- Preview, apply Excel, check status delta, doi soat profit report, payable/receivable, dashboard.
- Co case file dung schema nhung du lieu xau, va case update partial.
- Trang thai hien tai: `active_automated` qua `tests/backend/suites/e2e-flows/e2e.order-update-ripple.ps1`.
- Audit trail `2026-04-19 11:31:26 +07`:
  - `tests/backend/artifacts/results/e2e.order-update-ripple-rerun-20260419-104930.log`: `FAILED_HARNESS`
  - `tests/backend/artifacts/results/e2e.order-update-ripple-rerun-20260419-110022.log`: `FAILED_HARNESS`
  - `tests/backend/artifacts/results/e2e.order-update-ripple-rerun-20260419-110102.log`: `FAILED_PRODUCT`
  - `tests/backend/artifacts/results/e2e.order-update-ripple-rerun-20260419-110332.log`: `FAILED_PRODUCT -> FAILED_EXPECTATION`
  - `tests/backend/artifacts/results/e2e.order-update-ripple-rerun-20260419-113126.log`: `FAILED -> FIXED_PRODUCT -> FIXED_EXPECTATION -> PASSED`, `72 PASS / 0 FAIL`
- Root causes and fixes:
  - `backend/src/order-update/order-update.service.ts`
    - `excel/apply` khong con di bang raw `updateMany()`; moi order di qua canonical `TestOrder2Service.update()` de kick payment/profit/report/dashboard ripple dung root cause.
  - `backend/src/agent-receivable/agent-receivable.service.ts`
    - `getCashflowSummary()` da dung canonical `agentPaidAmount` / `agentPaymentStatus` va `COMPLETED_ORDER_STATUSES` / `RETURN_ORDER_STATUSES` thay vi cong thuc cu va literal status cung.
  - `tests/backend/suites/e2e-flows/e2e.order-update-ripple.ps1`
    - fixture/expectation da giu explicit `returnFee=25000`, nen gross-profit assertion khop cong thuc nghiep vu that, khong doi expected de lam dep ket qua.
- Related regression `2026-04-19 11:35:53 +07`:
  - `tests/backend/suites/e2e-flows/e2e.order-finance-impact.ps1`: `PASSED`, `57 PASS / 0 FAIL`
  - `tests/backend/suites/modules/core/module.finance-control-funds.ps1`: `PASSED`, `40 PASS / 0 FAIL`
  - `tests/backend/suites/modules/core/module.reports-products-config.ps1`: `PASSED`, `41 PASS / 0 FAIL`

### 16.6 Expanded database interaction catalog

- Activation update `2026-04-19 04:56:45 +07`:
  - `tests/backend/suites/modules/extended/module.db-consistency.ps1` is now active for `DB-01`, `DB-02`, `DB-03`, `DB-04`, and `CON-08`
  - remaining DB gap after activation: `DB-05`, `DB-06`, and `CON-09`
  - follow-up update `2026-04-19 08:11:05 +07`: `CON-09` is now closed by the same suite expansion, so the remaining DB gaps are `DB-05` and `DB-06`
  - follow-up update `2026-04-19 11:50:21 +07`: `DB-05` is now closed by the same suite expansion, so the remaining DB gap is `DB-06`

### `DB-01` Transaction rollback integrity

- Ep loi giua luong co session/transaction nhu `return-request/resolve`, owner withdrawal, payment batch.
- Ky vong khong co partial write, khong co doc o trang thai nua chot.

### `DB-02` Referential consistency after delete/update

- Xoa/sua entity goc nhu product, category, ad-group, supplier, agent khi van con entity tham chieu.
- Ky vong he thong chan, soft-delete, hoac cleanup theo dung rule, khong de reference mo coi.

### `DB-03` Duplicate and unique key pressure

- Tao du lieu trung email, trung token primary, trung batch id, trung external id, trung media path.
- Ky vong unique rule va recovery path ro rang, khong sinh duplicate logic.

### `DB-04` Read-after-write and cache coherence

- Sau create/update/delete, doc lai qua endpoint summary/list/detail co `forceRefresh=true` va khong co.
- Ky vong khong lech giua document goc, aggregate summary, cache layer, va report layer.

### `DB-05` Pagination/filter/sort stability under mutation

- Vua mutate du lieu vua doc list co `page`, `limit`, filter, sort.
- Ky vong khong missing / duplicate item bat thuong va metadata tong on dinh.
- Status update `2026-04-19 11:50:21 +07`:
  - now `active_automated` via `tests/backend/suites/modules/extended/module.db-consistency.ps1`
  - audit trail:
    - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-114841.log`: `FAILED_HARNESS`
    - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-115021.log`: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`, `68 PASS / 0 FAIL`
  - verified on `GET /api/test-order2` with real `page`, `limit`, `adGroupId`, `q`, `isActive`, `orderStatus`, `sortBy=orderDate`, `sortOrder=desc`
  - mutation stayed in-filter but non-sort (`receiverAddress`, `serviceDetails`) to keep the scenario strict and isolate pagination boundary drift
  - harness fix in the same round: `DB-01 / CON-08` fixture now links `return-request` to a real `test-order2` order instead of `fakeOrderId`, so valid resolve no longer false-fails on linked-order lookup `404`

### `DB-06` High-volume seed and cleanup safety

- Seed nhieu order/cost/chat/media de test cleanup va retention.
- Ky vong cleanup khong quet nham du lieu ngoai test namespace.
- Activated by `tests/backend/suites/modules/extended/module.db-seed-cleanup.ps1` on `2026-04-19 12:15:55 +07`.
- Companion checklist kept in `tests/backend/suites/modules/extended/db.seed-cleanup-checklist.md`.

### 16.7 Expanded load, stress, and soak profiles

### `LOAD-01` Smoke load

- 20-50 RPS vao `health`, `auth/login`, `financial-control/dashboard`, `funds/overview`, `test-order2`.
- Do p50/p95/p99, error rate, va CPU/RAM ket hop Mongo.
- Activated by `tests/backend/perf/perf.load-smoke.k6.js` on `2026-04-19 12:57:02 +07`.
- Final verified pass on isolated backend `http://localhost:3690/api`: `0.00% http_req_failed`, global `http_req_duration p95=427.28ms`, endpoint p95s `auth_login=553.76ms`, `financial_control_dashboard=165.34ms`, `funds_overview=74.36ms`, `test_order2_list=177.52ms`.
- Related post-fix regression kept green by `module.auth-rbac.ps1`, `module.finance-control-funds.ps1`, `e2e.order-finance-impact.ps1`, va `e2e.ops-payroll.ps1`.

### `LOAD-02` Burst / spike load

- Tang dot ngot request vao `webhook/messenger`, `advertising-cost-public`, `order-update/preview`, `test-order2`.
- Ky vong he thong degrade co kiem soat, khong ket hang toan bo.
- Activated by `tests/backend/perf/perf.spike-public.k6.js` on `2026-04-19 13:43:09 +07`.
- Audit trail kept:
  - `tests/backend/artifacts/results/tmp-spike-public-backend-3696-20260419-133036.err.log`: `FAILED_HARNESS/BLOCKED_ENV` because the first isolate runner hit `EADDRINUSE` and webhook verify probed the wrong service on `3696`
  - `tests/backend/artifacts/results/perf.spike-public-summary-20260419-133229.json`: `FAILED_PRODUCT` after `webhook/messenger` acknowledged `200` but background processing raised duplicate-key errors on `chatmessages.platformEventKey=null`
  - `tests/backend/artifacts/results/perf.spike-public-summary-20260419-134125.json`: `FAILED_HARNESS` because the rerun injected `BACKEND_BASE_URL` with `/api` and the harness called `/api/api/...`
  - `tests/backend/artifacts/results/perf.spike-public-summary-20260419-134309.json`: `FAILED_HARNESS/BLOCKED_ENV -> FAILED_PRODUCT -> FAILED_HARNESS -> FIXED_PRODUCT -> PASSED`
- Final verified pass on isolated backend `http://localhost:3810`: `2432` requests, `0.00% http_req_failed`, global `http_req_duration p95=36.31ms`, `p99=83.37ms`, endpoint p95s `webhook_ack=15.08ms`, `advertising_cost_public=30.49ms`, `order_update_preview=45.28ms`, `test_order2_list=47.71ms`.
- Related post-fix regression kept green by `e2e.public-contracts-resilience.ps1` (`61 PASS / 0 FAIL`) va `module.media-chat-config.ps1` (`33 PASS / 0 FAIL`).

### `LOAD-03` Write-heavy contention

- Chay dong thoi create/update payment batch, owner withdrawal, return resolve, other-cost confirm.
- Ky vong khong bi double-apply, deadlock logic, hoac drift summary.
- Activated by `tests/backend/perf/perf.write-contention.k6.js` on `2026-04-19 14:32:36 +07`.
- Audit trail kept:
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-141816.json`: `FAILED_PRODUCT` after concurrent `owner-fund/withdrawals/:id/approve` returned `201, 201` on the same withdrawal
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-142358.json`: `FAILED_PRODUCT` after the owner race fix because mixed `return-request/resolve` contention still pushed latency above threshold
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-142859.json`: `FAILED_PRODUCT` after success/reject metric separation still showed `return_resolve_commit_duration p95=3942ms`
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-143119.json`: `FAILED_PRODUCT` after resolve-path pruning improved the hot path but still missed the threshold at `p95=2525.60ms`
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-143236.json`: `FAILED_PRODUCT -> FIXED_PRODUCT -> FIXED_PRODUCT -> FIXED_PRODUCT -> PASSED`
- Final verified pass on isolated backend `http://localhost:62639`: `120` iterations, `293` HTTP requests, `0.00% http_req_failed`, global `http_req_duration p95=1480.01ms`, `supplier_payment_batch p95=646.00ms`, `agent_payment_batch p95=669.44ms`, `owner_withdrawal_approve_commit_duration p95=1434.40ms`, `return_resolve_commit_duration p95=2009.75ms`, `other_cost_confirm p95=804.82ms`.
- Related post-fix regression kept green by `e2e.concurrent-finance-ripple.ps1` (`40 PASS / 0 FAIL`), `module.db-consistency.ps1` (`68 PASS / 0 FAIL`), va `e2e.return-ripple.ps1` (`64 PASS / 0 FAIL`).
- Latest harness re-verification on dedicated local bootstrap `2026-04-24 21:26:01 +07`: isolated backend `http://localhost:64646`, `120` iterations, `293` HTTP requests, `0.00% http_req_failed`, global `http_req_duration p95=1391.47ms`, `supplier_payment_batch p95=594.22ms`, `agent_payment_batch p95=688.23ms`, `owner_withdrawal_approve_commit_duration p95=1387.93ms`, `return_resolve_commit_duration p95=2209.59ms`, `other_cost_confirm p95=795.19ms`.
- Same-day 2026-04-24 audit extension:
  - `tests/backend/artifacts/results/run-load03-write-contention-fix3-20260424-210944.log` va `tests/backend/artifacts/results/perf.write-contention-summary-runtime-manifest-20260424-210953.json` nay duoc reclassify thanh `FAILED_HARNESS`, khong phai product failure, vi `http://localhost:62922` dang phuc vu stale backend `htxbachgia_load03_fix_step_20260424210049` trong khi manifest/state lai khang dinh DB `htxbachgia_load03_fix3_20260424210944`
  - local bootstrap runner `tests/backend/runners/run-backend-perf-write-contention.ps1` co mot fail dau vong `FAILED_HARNESS` do truyen null `FixturePath`/`SummaryPath` vao canonical runner; sau fix harness thi clean isolated rerun pass ma khong can sua backend product code
- Latest product closure `2026-04-24 22:06:22 +07`:
  - pre-fix valid-contract local control `tests/backend/artifacts/results/perf.write-contention-summary-20260424-215242.json` remained `FAILED_PRODUCT` with `owner_withdrawal_approve_commit_duration p95=2225.10ms`, `return_resolve_commit_duration p95=3447.36ms`, `other_cost_confirm p95=1310.48ms`
  - post-fix isolated rerun `tests/backend/artifacts/results/perf.write-contention-summary-20260424-220622.json` is `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
  - current verified thresholds on isolated backend `http://localhost:50512/api`: `0.00% http_req_failed`, global `http_req_duration p95=1070.93ms`, `supplier_payment_batch p95=441.82ms`, `agent_payment_batch p95=521.25ms`, `owner_withdrawal_approve_commit_duration p95=1503.89ms`, `return_resolve_commit_duration p95=1433.85ms`, `other_cost_confirm p95=861.64ms`
  - related ripple regression stayed green on `tests/backend/artifacts/results/module-regression-20260424-220747.json` with `1163 PASS / 0 FAIL / 0 BLOCKED`, `25/25` suites

### `LOAD-04` Read-heavy analytics load

- Chay lien tuc `financial-control/dashboard`, `cashflow/dashboard/summary`, `ad-group-profit-report/performance`, `return-report/*`.
- Ky vong cache/refresh on dinh, response time khong vo nguong qua nhanh.
- Activated by `tests/backend/perf/perf.analytics-read.k6.js` on `2026-04-19 17:11:15 +07`.
- Audit trail kept:
  - `tests/backend/artifacts/results/perf.analytics-read-seed-setup-20260419-170009.log`: `FAILED_HARNESS/BLOCKED_ENV` because the first isolate served `/health` but auth still targeted the wrong Mongo DB, so `director@test.com` login returned `401`
  - `tests/backend/artifacts/results/perf.analytics-read-seed-setup-20260419-170436.log`: `FAILED_HARNESS` after the initial fixture drift used an invalid `other-cost.category`, then hard-coded unique IDs collided on rerun and a dirty DB doubled report row counts
  - `tests/backend/artifacts/results/perf.analytics-read-seed-setup-20260419-170817.log`: `FAILED_HARNESS` because the self-check counted returns via regex drift instead of the canonical `statuses.returned` value
  - `tests/backend/artifacts/results/perf.analytics-read-summary-20260419-171115.json`: `FAILED_HARNESS/BLOCKED_ENV -> FIXED_ENV -> FIXED_HARNESS -> FIXED_HARNESS -> FIXED_HARNESS -> PASSED`
- Final verified pass on isolated backend `http://localhost:50108`: `3808` HTTP requests, `0.00% http_req_failed`, global `http_req_duration p95=61.49ms`, endpoint p95s `financial_control_dashboard=22.82ms`, `financial_control_dashboard_refresh=71.13ms`, `cashflow_dashboard_summary=13.04ms`, `ad_group_profit_report_performance=73.14ms`, `return_report_product=41.05ms`, `return_report_ad_group=41.28ms`.
- No product bug was reproduced in this round; fixes were limited to isolate/harness discipline in `tests/backend/perf/create-analytics-read-fixture.js`.

### `LOAD-05` Soak test

- Chay 2-8 gio voi traffic hon hop read/write.
- Theo doi memory growth, queue backlog, scheduler overlap, cache inconsistency, va Mongo connection health.

### `LOAD-06` Recovery / resilience under dependency degradation

- Gia lap Mongo cham, provider ads timeout, webhook retry storm, Google Sheets credential loi.
- Ky vong service fail-safe, log du, khong corrupt data, va hoi phuc duoc sau khi dependency on lai.

### Legacy note (superseded) - `CON-05` Supplier payment batch idempotency (duplicate text)

- Táº¡o 1 táº­p order Ä‘Ã£ complete, cháº¡y Ä‘á»“ng thá»i nhiá»u request vÃ o `POST /api/test-order2/supplier-payment-batch`.
- Cháº¡y láº¡i cÃ¹ng `batchId` vÃ  cÃ¹ng `orderIds` sau khi request Ä‘áº§u thÃ nh cÃ´ng.
- Ká»³ vá»ng:
  1. ChÄƒn double-pay cho cÃ¹ng order/batch.
  2. `supplierPaymentStatus`, `supplierPaidAt`, `supplierPaymentBatchId` vÃ  realized profit khÃ´ng bá»‹ ghi Ä‘Ã¨ sai.

### Legacy note (superseded) - `CON-06` Realized profit finalize race

- Táº¡o order cÃ³ supplier/agent pending, gá»­i 2 request payment song song theo hai chiá»u.
- Ká»³ vá»ng:
  1. `realizedAt` chá»‰ chÃ³t má»™t láº§n khi cáº£ hai bÃªn Ä‘Ã£ paid.
  2. `realizedGrossProfit` vÃ  `realizedNetProfit` khÃ´ng bá»‹ táº­t Ä‘Ã´i khi finalize.
  3. Report cashflow/financial-control pháº£i Ä‘á»“ng bá»™ sau khi finalize.

### Legacy note (superseded) - `CON-07` Owner withdrawal approval race

- Táº¡o 1 withdrawal pending, gá»­i 2 request `approve` hoáº·c `complete` gáº§n nhÆ° Ä‘á»“ng thá»i.
- Ká»³ vá»ng:
  1. ChÄƒn approve/re-complete láº·p láº¡i khi status Ä‘Ã£ chuyá»ƒn pha.
  2. `availableBalance`, `totalWithdrawn`, `approvedBy` vÃ  `transactionReference` khÃ´ng bá»‹ double-apply.

### Legacy note (superseded) - `CON-08` Return resolve transaction rollback

- Táº¡o return request cÃ³ nhiá»u item, cÃ³ 1 item restock vÃ  1 item scrap.
- Dá»±ng lá»—i giÃºp `inventory.recordReturnFromRMA()` trong session.
- Ká»³ vá»ng:
  1. Transaction rollback toÃ n bá»™ khi inventory update fail.
  2. KhÃ´ng Ä‘Æ°á»£c set `status=resolved` náº¿u restock chÆ°a commit.

## 17. Execution log 2026-04-15

### 17.1 Scope and environment

- Closing full module regression for the `2026-04-15` round was executed at `2026-04-15 00:34:57 +07` via `tests/backend/runners/run-backend-module-regression.ps1`.
- Baseline users were re-ensured before the run by `tests/backend/setup/ensure-regression-users.ps1`.
- Runtime app target was `http://localhost:3000`.
- Mongo topology for that `2026-04-15` QA round was a single-node replica set on `127.0.0.1:27019`, so transaction paths were supported.
- Historical note:
  - the previous regression `20260415-002059` used standalone Mongo and left `PATCH /api/returns/:id/resolve` in `BLOCKED_ENV`

### 17.2 Final regression status

- Full regression result for the `2026-04-15` round:
  - `764 PASS / 0 FAIL`
  - `18` modules
  - `764` assertions
- Round artifacts:
  - `tests/backend/artifacts/results/module-regression-20260415-003457.json`
  - `tests/backend/artifacts/results/qa-regression-summary-20260415-003457.md`
  - note: that round also populated `tests/backend/artifacts/results/module-regression-latest.json`, which was later superseded by newer reruns
- Historical blocked snapshot kept for audit:
  - `tests/backend/artifacts/results/module-regression-20260415-002059.json`
  - `tests/backend/artifacts/results/qa-regression-summary-20260415-002059.md`

### 17.3 Failed -> fixed -> passed in the `2026-04-15` round

#### `module.labor-other-cost.ps1`

- Previous state:
  - `23 PASS / 1 FAIL`
  - fail at `Create labor statement`
- Root cause:
  - suite reused a fixed statement period and collided with surviving confirmed/closed statements from earlier runs
- Action:
  - updated `tests/backend/suites/modules/core/module.labor-other-cost.ps1` to create a unique statement period per run
- Verification:
  - targeted rerun file `tmp-module.labor-other-cost-rerun-20260415b.log`
  - status `FAILED -> FIXED -> PASSED`

#### `module.reports-products-config.ps1`

- Previous state:
  - `39 PASS / 2 FAIL`
- Fixed item:
  - `Salary config failed`
- Root cause:
  - `GET /api/salary-config` returned `200 []`, but `Invoke-RestMethod` collapsed the empty array into `$null`
- Action:
  - updated `tests/backend/suites/modules/core/module.reports-products-config.ps1` to read the raw HTTP response and treat `[]` as a valid empty result
- Verification:
  - targeted rerun file `tmp-module.reports-products-config-rerun-20260415b.log`
  - status for this case `FAILED -> FIXED -> PASSED`

#### `module.agent-supplier-quotes.ps1`

- Previous state:
  - `5 PASS / 13 FAIL`
- Root cause:
  - suite setup depended on unstable global users and duplicate fixed emails
  - supplier quote response handling did not normalize current payload shapes
- Action:
  - updated `tests/backend/suites/modules/core/module.agent-supplier-quotes.ps1`
  - suite now prefers ensured regression users, falls back to unique temp users, and normalizes supplier quote list/history payloads
- Verification:
  - targeted rerun file `tmp-module.agent-supplier-quotes-rerun-20260415b.log`
  - status `FAILED -> FIXED -> PASSED`

### 17.4 Failed -> blocked_env -> fixed_env -> passed

#### `module.reports-products-config.ps1` -> `Resolve return request failed`

- Active case:
  - `PATCH /api/returns/:id/resolve`
- Earlier classification:
  - `FAILED -> BLOCKED_ENV`
- Earlier reason:
  - the code path is transactional and the previous Mongo topology was standalone
- Earlier runtime evidence:
  - `MongoServerError: Transaction numbers are only allowed on a replica set member or mongos`
  - observed in `backend/qa-test-run.err.log`
- Environment action:
  - recreated the active QA Mongo on `127.0.0.1:27019` as a single-node replica set and verified transaction support before rerun
- Verification:
  - targeted rerun file `tmp-module.reports-products-config-rerun-20260415c.log`
  - targeted rerun file `tmp-module.return-report-product-rate-rerun-20260415c.log`
  - full regression file `tests/backend/artifacts/results/module-regression-20260415-003457.json`
- QA rule:
  - do not downgrade this to PASS and do not relax the transaction path
- Current status:
  - `FAILED -> BLOCKED_ENV -> FIXED_ENV -> PASSED`

## 18. Execution log 2026-04-19

### 18.1 Scope and environment

- Scope:
  - reproduce and fix open auth hardening failure seen in `tests/backend/artifacts/results/module.auth-hardening-rerun-20260415-080150.log`
  - rerun `module.auth-hardening.ps1`
  - rerun related auth regression `module.auth-rbac.ps1`
- Runtime app target for this round:
  - default backend `http://localhost:3200/api`
  - dedicated IP restriction backend `http://localhost:3100/api`
- Mongo runtime for this round:
  - live service `mongodb://127.0.0.1:27017/htxbachgia`
  - topology `rs0`
  - note: `backend/.env` still points to `127.0.0.1:27019`, so this round exported `MONGODB_URI` explicitly
- Baseline users were re-ensured before rerun by `tests/backend/setup/ensure-regression-users.ps1`.

### 18.2 Reproduce and root cause

- Initial local preflight:
  - `tests/backend/setup/ensure-regression-users.ps1` failed against `127.0.0.1:27019`
  - status: `BLOCKED_ENV`
  - action: inspected local runtime, confirmed Windows `MongoDB` service was healthy on `127.0.0.1:27017` and already running as replica set `rs0`
  - status after unblock: `BLOCKED_ENV -> FIXED_ENV`
- Manual reproduce before fix:
  - `manager@test.com` with `allowedLoginIps=[]` returned `201` on the suite-started `3100` instance
  - `x-forwarded-for=203.0.113.10` also returned `201` on the same instance
- Root cause:
  - `tests/backend/suites/modules/core/module.auth-hardening.ps1` started the dedicated backend with `cmd.exe /c set VAR=value && ...`
  - `cmd.exe` preserved trailing whitespace in env values, so `AUTH_ENABLE_IP_RESTRICTION` became `true ` and auth runtime treated IP restriction as disabled
  - suite cleanup stopped the wrapper PID instead of the real node listener PID on `3100`, leaving orphan processes between reruns

### 18.3 Fixes and reruns

- Code and harness fixes:
  - `tests/backend/suites/modules/core/module.auth-hardening.ps1`
    - quote env assignments as `set "NAME=value"`
    - detect and stop the actual `3100` listener PID during cleanup
  - `backend/src/auth/auth.service.ts`
    - trim `AUTH_ENABLE_IP_RESTRICTION` before comparing to `true`
  - `tests/backend/suites/modules/core/module.auth-rbac.ps1`
    - add `AUTH_RBAC_BASE_URL` override for local targeted reruns when `3000` is occupied
- Rerun status:
  - `module.auth-hardening.ps1`
    - log: `tests/backend/artifacts/results/module.auth-hardening-rerun-20260419-0011.log`
    - result: `35 PASS / 0 FAIL`
    - status: `FAILED -> FIXED_HARNESS_ENV -> FIXED_CLEANUP -> PASSED`
    - post-check: `POST_HARDENING_3100_PID=NONE`
  - `module.auth-rbac.ps1`
    - log: `tests/backend/artifacts/results/module.auth-rbac-rerun-20260419-0011.log`
    - result: `25 PASS / 0 FAIL`
    - status: `PASSED`
- Traceable summary:
  - `tests/backend/artifacts/results/qa-auth-regression-summary-20260419-000919.md`
  - `tests/backend/artifacts/results/qa-auth-regression-summary-20260419-000919.json`

### 18.4 Same-day module regression closure

- Failed full regression baseline captured after the auth round:
  - log: `tests/backend/artifacts/results/full-module-regression-20260419-002107.log`
  - json: `tests/backend/artifacts/results/module-regression-20260419-002155.json`
  - result: `766 PASS / 17 FAIL`
- Suites investigated, fixed, and rerun:
  - `module.owner-fund-loan.ps1`
    - baseline: `42 PASS / 1 FAIL`
    - root cause: upcoming repayment coverage used a stale fixed `dueDate` window that had already moved into the past
    - fix: switched to runtime-relative due dates and separated paid repayment data from upcoming repayment data
    - rerun result: `44 PASS / 0 FAIL`
    - status: `FAILED -> FIXED -> PASSED`
  - `module.reports-products-config.ps1`
    - baseline: `37 PASS / 1 FAIL`
    - root cause: pending-order approval assumed a product fixture still existed
    - fix: created or reused a fallback category and product for the pending-order path, then cleaned them up explicitly
    - rerun result: `38 PASS / 0 FAIL`
    - status: `FAILED -> FIXED -> PASSED`
  - `module.supply-chain.ps1`
    - baseline: `1 PASS / 1 FAIL`
    - root cause: setup used fixed emails but only searched by role, so duplicate-user `409` responses broke idempotent bootstrap
    - fix: reused users via `GET /users/email/:email` and recovered cleanly after duplicate-user setup attempts
    - rerun result: `28 PASS / 0 FAIL`
    - status: `FAILED -> FIXED -> PASSED`
  - `module.agent-supplier-quotes.ps1`
    - baseline: `5 PASS / 13 FAIL`
    - root cause: static category/product setup collided with existing data and duplicate category creation leaked a `500`
    - fix:
      - reused existing category and product fixtures by prefix
      - hardened `backend/src/product-category/product-category.service.ts` to translate Mongo duplicate key `11000` into `ConflictException`
    - rerun result: `18 PASS / 0 FAIL`
    - status: `FAILED -> FIXED -> PASSED`
  - `module.finance-survival-alerts.ps1`
    - baseline: `2 PASS / 1 FAIL`
    - root cause: `backend/scripts/test-scenario-4-finance-health.js` depended on ambient ad-group data instead of self-contained fixtures
    - fix: self-seeded scenario-specific users, ad account, fanpage, and ad group and cleaned them up in teardown
    - rerun result: `18 PASS / 0 FAIL`
    - status: `FAILED -> FIXED -> PASSED`
- Targeted rerun after fixes:
  - log: `tests/backend/artifacts/results/targeted-fail-suite-rerun-20260419-003503.log`
  - result:
    - `module.owner-fund-loan.ps1`: `44 PASS / 0 FAIL`
    - `module.reports-products-config.ps1`: `38 PASS / 0 FAIL`
    - `module.supply-chain.ps1`: `28 PASS / 0 FAIL`
    - `module.agent-supplier-quotes.ps1`: `18 PASS / 0 FAIL`
    - `module.finance-survival-alerts.ps1`: `18 PASS / 0 FAIL`
    - summary: `TARGETED_RERUN_PASSED=5/5`
- Canonical full module regression rerun after all fixes:
  - log: `tests/backend/artifacts/results/full-module-regression-rerun-20260419-005330.log`
  - json: `tests/backend/artifacts/results/module-regression-20260419-005412.json`
  - result: `825 PASS / 0 FAIL`
  - catalog state: `19/19` active modules passed on the current catalog
- Traceable closing summary:
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260419-005412.md`
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260419-005412.json`

### 18.5 Open risks after this round

- Canonical full module regression rerun is now closed; no open `FAIL` remains in the current 21-module catalog baseline.
- Local workstation config still drifts from `backend/.env` on Mongo port (`27017` live service vs `27019` in file); suite runners still need explicit `MONGODB_URI` override until the environment is standardized.
- No new backlog item was added in this round; existing planned gaps remain the next priority after this closure (`module.order-sheet-sync-ops.ps1` and concurrency-focused ripple coverage).

### QA addendum - 2026-04-19 active coverage update

- `module.user-import-export.ps1` is now active and covers `BE-MASTER-04`, `BE-MASTER-05`, `BE-MASTER-06`.
- Canonical runner now includes `20` modules.
- Verified full regression on `2026-04-19 01:40:52 +07`: `857 assertions`, `20/20 modules`, `PASS / 0 FAIL` on `http://localhost:3600/api` with `mongodb://127.0.0.1:27017/htxbachgia`.
- Targeted `module.user-import-export.ps1` trace preserved as `BLOCKED_ENV -> FIXED_ENV -> FAILED_HARNESS -> FIXED_HARNESS -> PASSED`.
- Targeted `module.auth-rbac.ps1` rerun passed.
- Security fix verified: import/export endpoints now require auth plus `users` permission, and CSV export neutralizes formula payloads.

### QA addendum - 2026-04-19 order-sheet-sync activation and clean-DB finance harness closure

- `module.order-sheet-sync-ops.ps1` is now active and covers `BE-OPS-04`, `BE-OPS-05`, `BE-OPS-06`.
- Round environment:
  - isolated backend: `http://localhost:3620/api`
  - MongoDB override: `mongodb://127.0.0.1:27017/htxbachgia_order_sheet_ops_20260419_0225`
  - baseline users: `tests/backend/setup/ensure-regression-users.ps1`
  - shell runner: Windows PowerShell
- Manual reproduce before fix:
  - `tests/backend/artifacts/results/manual-order-sheet-sync-repro-20260419-0214.log`
  - `POST /api/order-sheet-sync/agents/all` reported `total=1 success=1 failed=0 errors=[]` even when inner sync returned `success=false`
  - `POST /api/order-sheet-sync/suppliers/all` showed the same incorrect success accounting on invalid-link failures
- Root causes and fixes:
  - `backend/src/order-sheet-sync/order-sheet-sync.service.ts`
    - `syncAllAgents()` and `syncAllSuppliers()` now honor inner `success=false` results and record them as failures with traceable errors
  - `tests/backend/suites/modules/extended/module.order-sheet-sync-ops.ps1`
    - activated deterministic suite coverage for `order-sheet-sync`, emergency bulk-sync diff semantics, overdue boundaries, alert surfacing, permissions, and token verification-failed flow
    - fixed PowerShell-compatible JSON and Mongo seed paths for the suite harness
  - `tests/backend/suites/modules/core/module.ads-alerts-kpi.ps1`
    - fixed clean-DB false fail where valid empty snapshot arrays were previously treated as a failure
  - `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`
    - fixed clean-DB false fail where `GET /finance/available-funds` legitimately returned `[]` and PowerShell collapsed the empty array path into a harness failure
  - `tests/backend/runners/run-backend-module-regression.ps1`
    - added `module.order-sheet-sync-ops.ps1` to the canonical active catalog
- Targeted reruns:
  - `module.order-sheet-sync-ops.ps1`
    - `tests/backend/artifacts/results/module.order-sheet-sync-ops-rerun-20260419-0218.log`
    - status: `FAILED`
    - result: `38 PASS / 8 FAIL`
    - `tests/backend/artifacts/results/module.order-sheet-sync-ops-rerun-20260419-0228.log`
    - status: `FAILED -> FIXED_HARNESS -> FIXED_PRODUCT -> PASSED`
    - result: `56 PASS / 0 FAIL`
  - `module.finance-control-funds.ps1`
    - `tests/backend/artifacts/results/module.finance-control-funds-rerun-20260419-0230.log`
    - result: `40 PASS / 0 FAIL`
  - `module.ads-budget-x-emergency.ps1`
    - `tests/backend/artifacts/results/module.ads-budget-x-emergency-rerun-20260419-0230.log`
    - result: `35 PASS / 0 FAIL`
  - `module.ads-alerts-kpi.ps1`
    - `tests/backend/artifacts/results/module.ads-alerts-kpi-rerun-20260419-0230.log`
    - status: `FAILED_HARNESS`
    - result: `26 PASS / 1 FAIL`
    - `tests/backend/artifacts/results/module.ads-alerts-kpi-rerun-20260419-0234.log`
    - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
    - result: `27 PASS / 0 FAIL`
  - `module.owner-fund-loan.ps1`
    - `tests/backend/artifacts/results/module.owner-fund-loan-rerun-20260419-0236.log`
    - status: `FAILED_HARNESS`
    - result: `43 PASS / 1 FAIL`
    - `tests/backend/artifacts/results/module.owner-fund-loan-rerun-20260419-0246.log`
    - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
    - result: `44 PASS / 0 FAIL`
- Canonical full regression:
  - pre-closure baseline after runner activation:
    - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-0232.log`
    - `tests/backend/artifacts/results/module-regression-20260419-023017.json`
    - result: `933 PASS / 1 FAIL` across `22` modules
    - only remaining failure: `module.owner-fund-loan.ps1` step `5.7 Available funds`
  - closing rerun:
    - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-0247.log`
    - `tests/backend/artifacts/results/module-regression-20260419-023752.json`
    - result: `934 PASS / 0 FAIL` across `22` modules
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-order-sheet-sync-ops-summary-20260419-023752.md`
  - `tests/backend/artifacts/results/qa-order-sheet-sync-ops-summary-20260419-023752.json`
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260419-023752.md`
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260419-023752.json`
- Open risks after closure:
  - local workstation config still drifts from `backend/.env` on Mongo port (`27017` live service vs `27019` in file), so suite runners still need explicit `MONGODB_URI` override until the environment is standardized
  - next planned gaps now move to public/bootstrap contracts, concurrency-focused finance ripple coverage, DB consistency, and load/perf harnesses

### QA addendum - 2026-04-19 public-contracts activation and chat/media contract closure

- `e2e.public-contracts-resilience.ps1` is now active and covers `BE-SMOKE-03`, `BE-MEDIA-03`, `BE-CHAT-03`, `BE-PUB-01`, `BE-PUB-02`, `BE-PUB-03`, `BE-PUB-04`.
- Round environment:
  - manual reproduce backend: `http://localhost:3630/api`
  - isolated public-contract backends: `http://localhost:3640/api`, `http://localhost:3641/api`
  - regression backend: `http://localhost:3650/api`
  - Mongo runtime for all reruns used explicit `MONGODB_URI` on `127.0.0.1:27017`
  - `PLAN_TYPE=enterprise`
  - note: `backend/.env` still points to `127.0.0.1:27019`
- Manual reproduce before fix:
  - `tests/backend/artifacts/results/manual-public-contracts-chat24h-repro-20260419-030040.log`
  - text send outside 24h returned `400`
  - image URL send outside 24h returned `201`
- Activation progression:
  - `tests/backend/artifacts/results/e2e.public-contracts-resilience-run-20260419-031649.log`
    - status: `FAILED_HARNESS`
    - root issue: suite path root resolved to `tests/tests/...`, so isolated backend never became healthy
  - `tests/backend/artifacts/results/e2e.public-contracts-resilience-run-20260419-031803.log`
    - status: `FAILED_HARNESS_ENV`
    - root issues:
      - secondary webhook assertion assumed `FB_VERIFY_TOKEN` would win over existing `.env` `MESSENGER_VERIFY_TOKEN`
      - regression user setup inherited `.env` Mongo drift and failed against `127.0.0.1:27019`
  - `tests/backend/artifacts/results/e2e.public-contracts-resilience-run-20260419-031926.log`
    - status: `FAILED_HARNESS`
    - root issue: media byte compare called `.Trim()` on `byte[]`
  - `tests/backend/artifacts/results/e2e.public-contracts-resilience-run-20260419-032022.log`
    - status: `FAILED`
    - result: `55 PASS / 4 FAIL`
    - product failure: `/api/media/serve/...` returned `404` instead of serving canonical path, rejecting traversal with `403`, and honoring DB fallback
    - harness failure: chat inbound replay assertion used an unstable response path
  - `tests/backend/artifacts/results/e2e.public-contracts-resilience-run-20260419-032231.log`
    - status: `FAILED_HARNESS`
    - result: `60 PASS / 1 FAIL`
    - root issue: outbound replay assertion should have counted isolated DB truth instead of relying on response-shape drift
  - `tests/backend/artifacts/results/e2e.public-contracts-resilience-run-20260419-032414.log`
    - status: `FAILED -> FIXED_HARNESS -> FIXED_PRODUCT -> PASSED`
    - result: `61 PASS / 0 FAIL`
- Root causes and fixes:
  - `backend/src/chat-message/chat-message.controller.ts`
    - image URL and multipart send routes now reuse the 24h gate before persisting outbound messages
  - `backend/src/media/media.controller.ts`
    - explicit `@Get('serve/:year/:month/:filename')` route now preserves `/api/media/serve/...` alias contract, traversal rejection, and DB fallback
  - `tests/backend/suites/e2e-flows/e2e.public-contracts-resilience.ps1`
    - fixed repo-root resolution, explicit `MONGODB_URI` for `ensure-regression-users`, explicit `MESSENGER_VERIFY_TOKEN` precedence checks, binary body compare helper, and direct DB assertions for chat replay truth
- Related reruns after fixes:
  - manual chat rerun:
    - `tests/backend/artifacts/results/manual-public-contracts-chat24h-rerun-20260419-030313.log`
    - status: `FAILED -> FIXED_PRODUCT -> PASSED`
    - result: text send outside 24h `400`, image URL send outside 24h `400`
  - `module.media-chat-config.ps1`
    - `tests/backend/artifacts/results/module.media-chat-config-rerun-20260419-032541.log`
    - result: `33 PASS / 0 FAIL`
- Canonical full module regression after closure:
  - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-032541.log`
  - `tests/backend/artifacts/results/module-regression-20260419-032552.json`
  - result: `935 PASS / 0 FAIL` across `22` modules
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-public-contracts-resilience-summary-20260419-032552.md`
  - `tests/backend/artifacts/results/qa-public-contracts-resilience-summary-20260419-032552.json`
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260419-032552.md`
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260419-032552.json`
- Open risks after closure:
  - local workstation config still drifts from `backend/.env` on Mongo port (`27017` live service vs `27019` in file), so isolated suites still need explicit `MONGODB_URI` override
  - this round verified outbound chat persistence only; blocked multipart image attempts were not expanded into a dedicated media-storage side-effect cleanup suite
  - next planned gaps now move to concurrency-focused finance ripple coverage, DB consistency, and load/perf harnesses

### QA addendum - 2026-04-19 concurrent-finance activation and commission expectation closure

- `tests/backend/suites/e2e-flows/e2e.concurrent-finance-ripple.ps1` is now active and covers `CON-05`, `CON-06`, `CON-07`, `CON-10`, plus `BE-SUP-05`.
- Baseline product failure kept for audit:
  - `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-run-20260419-035102.log`
  - result: `34 PASS / 6 FAIL`
  - reproduce:
    - duplicate supplier payment batch still returned `200` and overwrote `supplierPaymentBatchId` / `supplierPaidAt`
    - duplicate agent payment batch still returned `200` and overwrote `agentPaymentBatchId` / `agentPaidAt`
- Product fix:
  - `backend/src/test-order2/services/order-payment.service.ts`
  - both supplier and agent payment-batch paths now guard duplicate `batchId`, filter only unpaid eligible orders, and atomically persist paid-state updates before recalculating realized profit
- Latest concurrency rerun:
  - `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-run-20260419-041109.log`
  - status: `FAILED -> FIXED_PRODUCT -> PASSED`
  - result: `40 PASS / 0 FAIL`
  - verified:
    - supplier retry idempotency
    - agent retry idempotency
    - atomic agent batch race (`success=1 / failure=1`)
    - owner-withdrawal approve race (`success=1 / failure=1`)
- Related suite drift found and closed in the same round:
  - `tests/backend/suites/e2e-flows/e2e.agent-role-payment.ps1`
    - stale expectation still subtracted `shippingFee` / `returnFee` from external-agent commission
    - baseline: `tests/backend/artifacts/results/e2e.agent-role-payment-rerun-20260419-0431.log` -> `44 PASS / 2 FAIL`
    - rerun: `tests/backend/artifacts/results/e2e.agent-role-payment-rerun-20260419-0442.log` -> `FAILED -> FIXED_EXPECTATION -> PASSED`, `46 PASS / 0 FAIL`
  - `tests/backend/suites/e2e-flows/e2e.order-finance-impact.ps1`
    - stale expectation still used the same old commission formula and non-specific returned-order gross-profit check
    - baseline: `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-0420.log` -> `53 PASS / 3 FAIL`
    - rerun: `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-0431.log` -> `FAILED -> FIXED_EXPECTATION -> PASSED`, `56 PASS / 0 FAIL`
  - source-of-truth used for re-baseline:
    - `backend/src/test-order2/services/order-payment.service.ts`
    - `backend/src/test-order2/services/order-calculation.service.ts`
    - `backend/src/test-order2/test-order2.service.ts`
    - rule: external-agent commission = `COD - (agentQuote * qty)`; shipping and return fees stay on company-side cost lines
- Clean-DB harness closure in the same round:
  - `tests/backend/suites/modules/core/module.ads-alerts-kpi.ps1`
  - baseline: `tests/backend/artifacts/results/module.ads-alerts-kpi-rerun-20260419-0520.log` -> `26 PASS / 1 FAIL`
  - root cause: empty snapshot array from `GET /capital-allocation/snapshots` collapsed to `$null` in PowerShell and caused a false fail
  - rerun: `tests/backend/artifacts/results/module.ads-alerts-kpi-rerun-20260419-0530.log` -> `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`, `27 PASS / 0 FAIL`
- Canonical full module regression audit trail:
  - failed env/harness attempt kept:
    - `tests/backend/artifacts/results/module-regression-20260419-041141.json`
    - status: `FAILED_HARNESS_ENV`
    - note: runner fell back to `http://localhost:3000` before `BACKEND_BASE_URL` / `BACKEND_HEALTH_URL` were exported for the isolated backend
  - final closure:
    - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-0530.log`
    - `tests/backend/artifacts/results/module-regression-20260419-041812.json`
    - status: `FAILED_HARNESS_ENV -> FIXED_ENV -> PASSED`
    - result: `934 PASS / 0 FAIL`, `22 / 22` modules
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-concurrent-finance-ripple-summary-20260419-041812.md`
  - `tests/backend/artifacts/results/qa-concurrent-finance-ripple-summary-20260419-041812.json`
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260419-041812.md`
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260419-041812.json`
- Open risks after closure:
  - `backend/.env` still drifts from live QA Mongo (`27019` in file vs `27017` live), so isolated rounds still need explicit `MONGODB_URI`
  - `CON-08`, `CON-09`, `DB-*`, and `LOAD-*` remain the next gap groups

### QA addendum - 2026-04-19 db-consistency activation and full regression closure

- `tests/backend/suites/modules/extended/module.db-consistency.ps1` is now active and covers `DB-01`, `DB-02`, `DB-03`, `DB-04`, and `CON-08`.
- Round environment:
  - isolated suite backend: `http://localhost:3680/api`
  - canonical full regression backend: `http://localhost:3684/api`
  - MongoDB overrides:
    - `mongodb://127.0.0.1:27017/htxbachgia_db_consistency_20260419045645`
    - `mongodb://127.0.0.1:27017/htxbachgia_module_regression_20260419-045807`
  - baseline users: `tests/backend/setup/ensure-regression-users.ps1`
  - shell runner: Windows PowerShell
- Activation progression kept for audit:
  - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-0453.log`
    - status: `FAILED_HARNESS -> FIXED_HARNESS -> FAILED -> FIXED_PRODUCT -> PASSED`
    - result: `31 PASS / 1 FAIL`
    - failures observed before final product closure:
      - return item `_id` missing on newly created return requests
      - invalid `itemId` resolve returned `200` and marked the request `resolved`
      - deleting a category in use returned `204` and left raw `product.categoryId` orphaned in Mongo
  - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-0456.log`
    - status: `PASSED`
    - result: `32 PASS / 0 FAIL`
- Root causes and fixes:
  - `backend/src/return-request/return-request.schema.ts`
    - return-request line items now persist subdocument `_id` values instead of suppressing them
  - `backend/src/return-request/return-request.service.ts`
    - create path now seeds deterministic line-item ids
    - resolve path now rejects duplicate, unknown, or partial item payloads before mutating request status or inventory
    - legacy pending rows without line-item ids are backfilled before read/resolve so the contract becomes stable
  - `backend/src/product-category/product-category.service.ts`
    - delete now checks raw `products` references on the same Mongo connection and returns `409` while a category is still in use
  - `tests/backend/suites/modules/extended/module.db-consistency.ps1`
    - fixed PowerShell JSON parsing for Windows PowerShell compatibility
    - fixed isolated-backend cleanup to stop the real listener PID and avoid stale-port false hits
    - upgraded `DB-02` to assert raw Mongo foreign-key truth instead of trusting populated API output
  - `tests/backend/suites/modules/core/module.reports-products-config.ps1`
    - removed the fallback that previously used `productId` as a fake return `itemId`
  - `tests/backend/runners/run-backend-module-regression.ps1`
    - added `module.db-consistency.ps1` to the canonical active catalog
- Canonical regression after closure:
  - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-045807.log`
  - `tests/backend/artifacts/results/module-regression-20260419-045816.json`
  - result: `966 PASS / 0 FAIL`, `23 / 23` modules
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-db-consistency-summary-20260419-045816.md`
  - `tests/backend/artifacts/results/qa-db-consistency-summary-20260419-045816.json`
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260419-045816.md`
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260419-045816.json`
- Open risks after closure:
  - `backend/.env` still drifts from the live QA Mongo port (`27019` in file vs `27017` live), so isolated rounds still need explicit `MONGODB_URI`
  - `DB-05`, `DB-06`, `CON-09`, and `LOAD-*` remain open gap groups after this activation

### QA addendum - 2026-04-19 other-cost timezone boundary closure

- `tests/backend/suites/modules/extended/module.db-consistency.ps1` now expands active coverage to `CON-09`.
- Round environment:
  - targeted suite backend: `http://localhost:3680/api`
  - canonical full regression backend: `http://localhost:3684/api`
  - MongoDB overrides:
    - `mongodb://127.0.0.1:27017/htxbachgia_db_consistency_20260419080903`
    - `mongodb://127.0.0.1:27017/htxbachgia_db_consistency_20260419081106`
    - `mongodb://127.0.0.1:27017/htxbachgia_module_regression_20260419-091342`
  - baseline users: `tests/backend/setup/ensure-regression-users.ps1`
  - shell runner: Windows PowerShell
- Activation progression kept for audit:
  - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-080903.log`
    - status: `FAILED`
    - result: `51 PASS / 6 FAIL`
    - failures observed before fix:
      - same-day `other-cost` list and summary filters missed the Bangkok boundary row
      - `dueByDay7d` shifted the same-day due date to yesterday
      - same-day due date raised an overdue alert
      - `ops` snapshot stored the shifted day
  - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-081105.log`
    - status: `FAILED -> FIXED_PRODUCT -> PASSED`
    - result: `57 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-081155.log`
    - status: `BLOCKED_ENV`
    - root issue: runner defaulted to `http://localhost:3000`, where a non-QA service returned `/health=404` and auth `401/403`
  - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-091342.log`
    - `tests/backend/artifacts/results/module-regression-20260419-091356.json`
    - status: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
    - result: `991 PASS / 0 FAIL`, `23 / 23` modules
- Root causes and fixes:
  - `backend/src/other-cost/other-cost.service.ts`
    - date-only `from/to` filters now use Bangkok business-day start/end boundaries instead of raw UTC-midnight parsing
    - cashflow summary now derives `today` from Bangkok business day, keeps metadata `asOfDate` aligned, and groups `dueByDay7d` / `nextDueDate` with `timezone: Asia/Bangkok`
  - `tests/backend/suites/modules/extended/module.db-consistency.ps1`
    - expanded coverage for `other-cost` create, confirm, and delete at Bangkok midnight boundary
    - added raw `ops` snapshot checks plus `financial-control` committed-cash ripple assertions
- Related regression after fixes:
  - canonical full module regression:
    - `tests/backend/artifacts/results/module-regression-20260419-091356.json`
    - result: `991 PASS / 0 FAIL`, `23 / 23` modules
  - downstream suites verified in the same closure:
    - `module.labor-other-cost.ps1`: `32 PASS / 0 FAIL`
    - `module.finance-control-funds.ps1`: `40 PASS / 0 FAIL`
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-db-consistency-summary-20260419-091826.md`
  - `tests/backend/artifacts/results/qa-db-consistency-summary-20260419-091826.json`
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260419-091826.md`
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260419-091826.json`
- Open risks after closure:
  - `backend/.env` still drifts from the live QA Mongo port (`27019` in file vs `27017` live), so isolated rounds still need explicit `MONGODB_URI`
  - local default runner `test-all-modules.ps1` no longer needs explicit `BACKEND_BASE_URL` / `BACKEND_HEALTH_URL`, but direct canonical/external rounds still do when local defaults drift away from the intended QA target
  - `DB-05`, `DB-06`, `E2E-RIPPLE-04`, `E2E-RIPPLE-06`, and `LOAD-*` remain open gap groups after this closure

### QA addendum - 2026-04-19 return-ripple follow-up and finance bank-balance closure

- Verified suites this round:
  - `tests/backend/suites/e2e-flows/e2e.order-finance-impact.ps1`
  - `tests/backend/suites/e2e-flows/e2e.return-ripple.ps1`
- Round environments:
  - watcher backend: `http://localhost:3693/api`
  - built backends: `http://localhost:3694/api`, `http://localhost:3695/api`
  - MongoDB overrides:
    - `mongodb://127.0.0.1:27017/htxbachgia_finance_impact_20260419_02`
    - `mongodb://127.0.0.1:27017/htxbachgia_finance_repay_20260419_03`
    - `mongodb://127.0.0.1:27017/htxbachgia_finance_suite_20260419_04`
  - baseline users: `tests/backend/setup/ensure-regression-users.ps1` with explicit `MONGODB_URI`
  - shell runner: Windows PowerShell
- Audit trail kept:
  - `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-101125.log`
    - status: `BLOCKED_ENV`
    - root issue: regression users were first seeded into the wrong Mongo because `MONGODB_URI` had not been overridden for the isolated backend, so login returned `401`
  - `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-101341.log`
    - status: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
    - result: `57 PASS / 0 FAIL`
  - pre-fix targeted repayment repro kept in `tests/backend/artifacts/results/qa-return-ripple-finance-summary-20260419-103327.md`
    - status: `FAILED`
    - observation: `bankBalance 10000000 -> 10000000` while `totalDebtOutstanding 10000000 -> 9000000`
  - `tests/backend/artifacts/results/finance.loan-repay-probe-20260419-102218.txt`
    - status: `BLOCKED_ENV`
    - root issue: watcher backend on `3693` restarted into a transient module-resolution failure during rebuild
  - `tests/backend/artifacts/results/finance.loan-repay-probe-20260419-102524.txt`
    - status: `FAILED -> FIXED_PRODUCT -> PASSED`
    - probe result: `bankBalance 5000000 -> 4000000`, `totalDebtOutstanding 5000000 -> 4000000`
  - `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-102708.log`
    - status: `PASSED`
    - result: `57 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/e2e.return-ripple-rerun-20260419-103104.log`
    - status: `PASSED`
    - result: `64 PASS / 0 FAIL`
- Root causes and fixes:
  - `backend/src/finance/financial-control.service.ts`
    - `getBankBalance()` now returns the master-ledger calculation path immediately instead of trusting `bank_account.availableBalance`
  - `backend/src/finance/finance.service.ts`
    - `calculateMasterBankBalance()` now subtracts repayment from `loan_contract.totalPrincipalPaid` / `totalInterestPaid`, so `loan-management/pay` affects bank balance as well as debt
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-return-ripple-finance-summary-20260419-103327.md`
  - `tests/backend/artifacts/results/qa-return-ripple-finance-summary-20260419-103327.json`
- Open risks after closure:
  - `backend/.env` still drifts from the live QA Mongo port (`27019` in file vs `27017` live), so isolated rounds still need explicit `MONGODB_URI`
  - watcher-based `start:dev` remained less stable than a built backend process during rebuild-heavy verification
  - remaining gap groups after this round: `DB-05`, `DB-06`, `E2E-RIPPLE-06`, and `LOAD-*`

### QA addendum - 2026-04-19 order-update ripple closure

- Verified suites this round:
  - `tests/backend/suites/e2e-flows/e2e.order-update-ripple.ps1`
  - `tests/backend/suites/e2e-flows/e2e.order-finance-impact.ps1`
  - `tests/backend/suites/modules/core/module.finance-control-funds.ps1`
  - `tests/backend/suites/modules/core/module.reports-products-config.ps1`
- Round environments:
  - isolated backend: `http://localhost:3699/api`
  - health: `http://localhost:3699/health`
  - Mongo override: `mongodb://127.0.0.1:27017/htxbachgia_e2e_order_update_20260419_04`
  - baseline users: `tests/backend/setup/ensure-regression-users.ps1` with explicit `MONGODB_URI`
  - shell runner: Windows PowerShell
- Audit trail kept:
  - `tests/backend/artifacts/results/tmp-order-update-backend-3698-20260419.stderr.log`
    - status: `BLOCKED_ENV`
    - root issue: background start command lost inline `$env:` assignment, fell back to port `3000`, and hit `EADDRINUSE`
  - `tests/backend/artifacts/results/e2e.order-update-ripple-rerun-20260419-113126.log`
    - status: `FAILED -> FIXED_PRODUCT -> FIXED_EXPECTATION -> PASSED`
    - result: `72 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-113147.log`
    - status: `PASSED`
    - result: `57 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module.finance-control-funds-rerun-20260419-113545.log`
    - status: `PASSED`
    - result: `40 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module.reports-products-config-rerun-20260419-113552.log`
    - status: `PASSED`
    - result: `41 PASS / 0 FAIL`
- Root causes and fixes:
  - `backend/src/order-update/order-update.service.ts`
    - order-update Excel apply da route tung order qua canonical service update, nen payable/receivable/report/dashboard ripple chay day du
  - `backend/src/agent-receivable/agent-receivable.service.ts`
    - agent snapshot da doc canonical payable/clawback fields thay vi aggregate legacy, nen `financial-control.monthlyBurn` khong con under-report nhanh agent
  - `tests/backend/suites/e2e-flows/e2e.order-update-ripple.ps1`
    - fixture va expectation giu explicit `returnFee=25000`; drift test/data da duoc sua ma khong ha tieu chuan
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-order-update-ripple-summary-20260419-113629.md`
  - `tests/backend/artifacts/results/qa-order-update-ripple-summary-20260419-113629.json`
- Open risks after closure:
  - remaining gap groups sau round nay: `DB-05`, `DB-06`, va `LOAD-*`
  - isolate start van nen dung explicit `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`, `MONGODB_URI`, va `PORT` khi local `3000` dang bi process khac giu

### QA addendum - 2026-04-19 DB-06 seed cleanup closure

- Verified suites this round:
  - `tests/backend/suites/modules/extended/module.db-seed-cleanup.ps1`
  - `tests/backend/suites/modules/core/module.media-chat-config.ps1`
- Round environments:
  - DB-06 isolate backend: `http://localhost:3684/api`
  - DB-06 health: `http://localhost:3684/health`
  - DB-06 Mongo override: `mongodb://127.0.0.1:27017/htxbachgia_db06_20260419121556`
  - DB-06 media dir: `tests/backend/artifacts/results/tmp-db06-media-20260419121556`
  - media/chat regression isolate backend: `http://localhost:3686/api`
  - media/chat regression Mongo override: `mongodb://127.0.0.1:27017/htxbachgia_media_chat_cfg_20260419121806`
  - baseline users: `tests/backend/setup/ensure-regression-users.ps1` with explicit `MONGODB_URI`
  - shell runner: Windows PowerShell
- Audit trail kept:
  - `tests/backend/artifacts/results/module.db-seed-cleanup-rerun-20260419-121310.log`
    - status: `FAILED_PRODUCT`
    - result: `48 PASS / 2 FAIL`
    - observations before fix:
      - `POST /api/media/cleanup-orphaned` deleted `15` files instead of the seeded `8`
      - DB-06 helper summary still saw `target orphan files = 8`, proving cleanup scanned a different media root than the seeded isolate directory
  - `tests/backend/artifacts/results/module.db-seed-cleanup-rerun-20260419-121555.log`
    - status: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
    - result: `50 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module.media-chat-config-rerun-20260419-121722.log`
    - status: `BLOCKED_ENV`
    - root issue: suite defaulted to `http://localhost:3000/api`, where login returned `403`
  - `tests/backend/artifacts/results/module.media-chat-config-rerun-20260419-121806.log`
    - status: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
    - result: `33 PASS / 0 FAIL`
- Root causes and fixes:
  - `backend/src/media/media.service.ts`
    - explicit `MEDIA_DIR` now resolves and creates the configured directory eagerly, so media list/import/master-sync/cleanup/serve paths do not fall back to `backend/uploads/media` when the configured directory does not exist yet at boot
  - `backend/scripts/db06-seed-cleanup-helper.js`
    - seeded chat messages now carry unique `platformMessageId` values so the helper satisfies the existing unique message indexes
    - helper setup now rolls back partial inserts/files on failure, resolves media dir absolutely, and refuses implicit Mongo fallback
  - `tests/backend/suites/modules/extended/module.db-seed-cleanup.ps1`
    - new active suite now seeds target/protected namespaces, verifies order/media APIs, exercises media cleanup, observes chat TTL, and checks namespace-scoped teardown
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-db06-seed-cleanup-summary-20260419-121924.md`
  - `tests/backend/artifacts/results/qa-db06-seed-cleanup-summary-20260419-121924.json`
- Open risks after closure:
  - remaining gap groups after this round: `LOAD-*`
  - `module.media-chat-config.ps1` still needs explicit `BACKEND_BASE_URL` when local `3000` is occupied; if omitted, treat the run as `BLOCKED_ENV`, not `PASS`

### QA addendum - 2026-04-19 LOAD-01 smoke load closure

- Verified harnesses and suites this round:
  - `tests/backend/perf/perf.load-smoke.k6.js`
  - `tests/backend/suites/modules/core/module.auth-rbac.ps1`
  - `tests/backend/suites/modules/core/module.finance-control-funds.ps1`
  - `tests/backend/suites/e2e-flows/e2e.order-finance-impact.ps1`
  - `tests/backend/suites/e2e-flows/e2e.ops-payroll.ps1`
- Round environments:
  - load isolate backend: `http://localhost:3690/api`
  - load health: `http://localhost:3690/health`
  - load Mongo override: `mongodb://127.0.0.1:27017/htxbachgia_load_smoke_20260419_125702`
  - auth/finance regression isolate backend: `http://localhost:3693/api`
  - auth/finance regression Mongo override: `mongodb://127.0.0.1:27017/htxbachgia_regress_load_authfinance_20260419_130726`
  - order/finance regression isolate backend: `http://localhost:3694/api`
  - order/finance regression Mongo override: `mongodb://127.0.0.1:27017/htxbachgia_regress_load_orderfinance_20260419_130726`
  - baseline users: `tests/backend/setup/ensure-regression-users.js` with explicit `MONGODB_URI`
  - runner stack: Windows PowerShell + built backend `dist/main.js` + `k6`
- Audit trail kept:
  - `tests/backend/artifacts/results/tmp-load-smoke-backend-3687-20260419-123033.out.log`
    - status: `FAILED_HARNESS`
    - root issue: first isolated runner attempt lost clean output capture, so harness setup was not trustworthy enough to score
  - `tests/backend/artifacts/results/perf.load-smoke-summary-20260419-123253.json`
    - status: `FAILED_PRODUCT`
    - observation: global `http_req_duration p95=12.29s` while `http_req_failed=0.00%`; `auth_login p95=12.27s`
  - `tests/backend/artifacts/results/perf.load-smoke-summary-20260419-124509.json`
    - status: `FAILED_PRODUCT`
    - observation: cache/coalescing hot-path fix alone was not enough; global `p95=9.27s`, `auth_login p95=9.45s`
  - `tests/backend/artifacts/results/perf.load-smoke-summary-20260419-125702.json`
    - status: `FAILED_HARNESS -> FAILED_PRODUCT -> FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
    - result: `1207 requests`, `0.00% failed`, global `p95=427.28ms`, `p99=624.08ms`
  - `tests/backend/artifacts/results/module.auth-rbac-rerun-20260419-125944.log`
    - status: `BLOCKED_ENV`
    - root issue: batch reused `BACKEND_BASE_URL` only, while `module.auth-rbac.ps1` reads `AUTH_RBAC_BASE_URL`; suite fell back to the wrong target and hit `404/403`
  - `tests/backend/artifacts/results/module.auth-rbac-rerun-20260419-130726.log`
    - status: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
    - result: `25 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module.finance-control-funds-rerun-20260419-130726.log`
    - status: `PASSED`
    - result: `40 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-130726.log`
    - status: `PASSED`
    - result: `57 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/e2e.ops-payroll-rerun-20260419-125944.log`
    - status: `PASSED`
    - result: `24 PASS / 0 FAIL`
- Root causes and fixes:
  - `backend/src/auth/auth.service.ts`
    - password verification moved from `bcryptjs` to native `bcrypt`, removing the main event-loop bottleneck on the login hot path under `LOAD-01`
  - `backend/src/auth/strategies/jwt.strategy.ts`
    - success-path JWT logs were reduced so high request volume no longer amplifies per-request log overhead
  - `backend/src/finance/funds.service.ts`
    - funds overview now uses short-lived cache, in-flight coalescing, and parallel cold-path compute to avoid duplicate recomputation under concurrent read load
  - `backend/src/finance/finance.service.ts`
    - master bank balance now uses short-lived cache/coalescing and emits invalidation on funding-source, cashflow, and loan mutation paths
  - `backend/src/finance/events/finance-events.constants.ts`
  - `backend/src/finance/events/finance-events.interfaces.ts`
  - `backend/src/finance/events/finance-event-listener.service.ts`
    - finance mutation events now invalidate `financial-control`, funds overview, and master bank balance caches together, preventing stale read models after writes
  - `backend/src/finance/funds.controller.ts`
  - `backend/src/finance/financial-control.controller.ts`
    - request-path log level dropped from `log` to `debug` on the hottest read endpoints
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-load-smoke-summary-20260419-131147.md`
  - `tests/backend/artifacts/results/qa-load-smoke-summary-20260419-131147.json`
- Open risks after closure:
  - remaining gap groups after this round: `LOAD-04+`
  - isolated load/regression rounds still need explicit `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`, `AUTH_RBAC_BASE_URL`, va `MONGODB_URI` when local defaults drift from QA targets
  - `LOAD-04` to `LOAD-06` remain open for analytics read, soak, and recovery/resilience

### QA addendum - 2026-04-19 LOAD-02 spike/public closure

- Verified harnesses and suites this round:
  - `tests/backend/perf/perf.spike-public.k6.js`
  - `tests/backend/suites/e2e-flows/e2e.public-contracts-resilience.ps1`
  - `tests/backend/suites/modules/core/module.media-chat-config.ps1`
- Round environments:
  - spike-load isolate backend: `http://localhost:3810`
  - spike-load health: `http://localhost:3810/health`
  - spike-load Mongo override: `mongodb://127.0.0.1:27017/htxbachgia_spike_public_20260419134309`
  - public-contract regression backends: `http://localhost:3640/api` and `http://localhost:3641/api`
  - media/chat regression isolate backend: `http://localhost:3820/api`
  - media/chat regression Mongo override: `mongodb://127.0.0.1:27017/htxbachgia_media_chat_20260419134657`
  - baseline users: `tests/backend/setup/ensure-regression-users.js` with explicit `MONGODB_URI`
  - runner stack: Windows PowerShell + built backend `dist/main.js` + Docker `grafana/k6`
- Audit trail kept:
  - `tests/backend/artifacts/results/tmp-spike-public-backend-3696-20260419-133036.err.log`
    - status: `FAILED_HARNESS/BLOCKED_ENV`
    - root issue: isolate runner chose an occupied port; webhook verify preflight hit a non-QA service and returned `403`
  - `tests/backend/artifacts/results/perf.spike-public-summary-20260419-133229.json`
    - status: `FAILED_PRODUCT`
    - observation: HTTP checks passed but backend stderr recorded repeated `E11000 duplicate key` on `chatmessages` unique index `sourcePlatform_1_fanpageId_1_platformEventKey_1`
  - `tests/backend/artifacts/results/perf.spike-public-summary-20260419-134125.json`
    - status: `FAILED_HARNESS`
    - root issue: rerun passed `BACKEND_BASE_URL=http://host.docker.internal:<port>/api` into a harness that already appends `/api`, causing `webhook_verify` to probe `/api/api/webhook/messenger`
  - `tests/backend/artifacts/results/perf.spike-public-summary-20260419-134309.json`
    - status: `FAILED_HARNESS/BLOCKED_ENV -> FAILED_PRODUCT -> FAILED_HARNESS -> FIXED_PRODUCT -> PASSED`
    - result: `2432 requests`, `2429` iterations, `0.00% failed`, global `p95=36.31ms`, `p99=83.37ms`
  - `tests/backend/artifacts/results/e2e.public-contracts-resilience-rerun-20260419-134548.log`
    - status: `PASSED`
    - result: `61 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module.media-chat-config-rerun-20260419-134657.log`
    - status: `PASSED`
    - result: `33 PASS / 0 FAIL`
- Root causes and fixes:
  - `backend/src/chat-message/chat-message.service.ts`
    - idempotent chat persistence now strips blank/null `platformMessageId` and `platformEventKey` before insert/upsert, unsets legacy null platform keys on module init, and reconciles message/event unique indexes to partial unique indexes that only apply to non-empty strings
  - `backend/src/chat-message/schemas/chat-message.schema.ts`
    - platform idempotency indexes now use named partial unique definitions instead of sparse unique definitions that still indexed `null`
  - `tests/backend/perf/perf.spike-public.k6.js`
    - active `LOAD-02` harness now enforces seeded-data expectations for `advertising-cost-public`, `order-update/preview`, and `test-order2`, and injects unique Messenger sender/message ids per iteration
  - `tests/backend/perf/create-order-update-preview-fixture.js`
    - deterministic XLSX fixture generator now provides strict preview rows for `order-update/preview` spike runs
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-spike-public-summary-20260419-134820.md`
  - `tests/backend/artifacts/results/qa-spike-public-summary-20260419-134820.json`
- Open risks after closure:
  - remaining gap groups after this round: `LOAD-04+`
  - isolated load/regression rounds still need explicit `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`, `MONGODB_URI`, va `MESSENGER_VERIFY_TOKEN` when local defaults drift from QA targets
  - `module.media-chat-config.ps1` still verifies `media/import-by-url` only at contract-response level; the latest isolated rerun hit outbound `ECONNRESET` to `https://via.placeholder.com/150`, so deterministic positive-path media import still needs a local fixture harness

### QA addendum - 2026-04-19 LOAD-03 write contention closure

- Verified harnesses and suites this round:
  - `tests/backend/perf/perf.write-contention.k6.js`
  - `tests/backend/perf/create-write-contention-fixture.js`
  - `tests/backend/suites/e2e-flows/e2e.concurrent-finance-ripple.ps1`
  - `tests/backend/suites/modules/extended/module.db-consistency.ps1`
  - `tests/backend/suites/e2e-flows/e2e.return-ripple.ps1`
- Round environments:
  - write-contention isolate backend: `http://localhost:62639`
  - write-contention health: `http://localhost:62639/health`
  - write-contention Mongo override: `mongodb://127.0.0.1:27017/htxbachgia_load03_20260419-143236`
  - Docker k6 target root: `http://host.docker.internal:62639`
  - baseline users: `tests/backend/setup/ensure-regression-users.js` with explicit `MONGODB_URI`
  - runner stack: Windows PowerShell + built backend `dist/main.js` + Docker `grafana/k6`
- Audit trail kept:
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-141816.json`
    - status: `FAILED_PRODUCT`
    - observation: `owner-fund/withdrawals/:id/approve` on the same withdrawal returned `201, 201`, proving double-approve was still possible
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-142358.json`
    - status: `FAILED_PRODUCT`
    - observation: owner race passed after fix, but `return_resolve` still failed the latency gate when success and reject traffic were mixed together
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-142859.json`
    - status: `FAILED_PRODUCT`
    - observation: after metric separation, `return_resolve_commit_duration p95=3942ms` still exposed a real product hot-path problem
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-143119.json`
    - status: `FAILED_PRODUCT`
    - observation: resolve-path pruning improved the hot path, but `return_resolve_commit_duration p95=2525.60ms` still missed the threshold
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-143236.json`
    - status: `FAILED_PRODUCT -> FIXED_PRODUCT -> FIXED_PRODUCT -> FIXED_PRODUCT -> PASSED`
    - result: `120` iterations, `293` HTTP requests, `0.00% failed`, global `p95=1480.01ms`, `owner_withdrawal_approve_commit_duration p95=1434.40ms`, `return_resolve_commit_duration p95=2009.75ms`
  - `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-rerun-20260419-143338.log`
    - status: `PASSED`
    - result: `40 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-143409.log`
    - status: `PASSED`
    - result: `68 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/e2e.return-ripple-rerun-20260419-143449.log`
    - status: `PASSED`
    - result: `64 PASS / 0 FAIL`
- Root causes and fixes:
  - `backend/src/owner-fund/owner-fund.service.ts`
    - withdrawal approval now uses a transaction-scoped compare-and-set on `PENDING`, so only one winner can decrement balance and persist `APPROVED`
  - `backend/src/return-request/return-request.service.ts`
    - return resolve now short-circuits duplicate races at the transaction edge and avoids redundant quote recalculation on the resolve path, keeping the hot path within the `LOAD-03` budget
  - `tests/backend/perf/create-write-contention-fixture.js`
    - deterministic fixture seeding now prepares payment-batch, withdrawal, return-resolve, and other-cost rows with explicit expected totals
  - `tests/backend/perf/perf.write-contention.k6.js`
    - active `LOAD-03` harness now enforces one-winner/one-loser race expectations and validates write-side ripple convergence in teardown
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-write-contention-summary-20260419-143957.md`
  - `tests/backend/artifacts/results/qa-write-contention-summary-20260419-143957.json`
- Open risks after closure:
  - remaining gap groups after this round: `LOAD-04+`
  - full canonical module regression was not rerun in this round; only targeted regressions tied directly to the contention fixes were rerun
  - isolated load rounds still need explicit `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`, `MONGODB_URI`, va Docker-host routing when native `k6` is not present on PATH

### QA addendum - 2026-04-24 LOAD-03 local bootstrap closure

- Verified harnesses and suites this round:
  - `tests/backend/runners/run-backend-perf-write-contention.ps1`
  - `tests/backend/runners/run-load03-write-contention.ps1`
  - `tests/backend/perf/create-write-contention-fixture.js`
  - `tests/backend/perf/perf.write-contention.k6.js`
- Round environments:
  - stale-backend audit target: `http://localhost:62922/api`
  - stale-backend manifest/state pair: `tests/backend/artifacts/results/runtime-contract-load03-fix3-20260424-210944.json`
  - dedicated local bootstrap backend: `http://localhost:64646/api`
  - dedicated local bootstrap health: `http://localhost:64646/health`
  - dedicated Mongo override: `mongodb://127.0.0.1:27017/htxbachgia_load03_local_20260424212450`
  - dedicated media root: `tests/backend/artifacts/results/tmp-load03-local-media-20260424212450`
  - Docker k6 target root: `http://host.docker.internal:64646`
- Audit trail kept:
  - `tests/backend/artifacts/results/run-load03-write-contention-fix3-20260424-210944.log`
    - status: `FAILED_HARNESS`
    - observation: runtime manifest/state claimed DB `htxbachgia_load03_fix3_20260424210944`, but fixture order `69eb79b73303fa63856acae5` existed only in `htxbachgia_load03_fix_step_20260424210049`; `62922` was serving stale backend state, so the 500s were not trustworthy product evidence
  - `tests/backend/artifacts/results/perf.write-contention-summary-runtime-manifest-20260424-210953.json`
    - status: `FAILED_HARNESS`
    - result: `http_req_failed rate=0.16382252559726962`; supplier/agent batch 500s belonged to the stale-backend collision above
  - first invocation of `tests/backend/runners/run-backend-perf-write-contention.ps1`
    - status: `FAILED_HARNESS`
    - observation: wrapper passed null `FixturePath`/`SummaryPath` into the canonical runner, and PowerShell aborted before k6 started; no standalone raw log was persisted, but the failure is preserved in the traceable summary for this round
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260424-212539.json`
    - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
    - result: `120` iterations, `293` HTTP requests, `0.00% failed`, global `p95=1391.47ms`, `supplier_payment_batch p95=594.22ms`, `agent_payment_batch p95=688.23ms`, `owner_withdrawal_approve_commit_duration p95=1387.93ms`, `return_resolve_commit_duration p95=2209.59ms`, `other_cost_confirm p95=795.19ms`
- Root causes and fixes:
  - `tests/backend/runners/run-backend-perf-write-contention.ps1`
    - default path now builds a dedicated backend on a free port with isolated Mongo/media roots before delegating to the canonical `LOAD-03` runner
    - writes `runtime-contract-load03-local-*.json` so Docker k6 and teardown read the same backend contract
    - no longer forwards null `FixturePath` or `SummaryPath` into the canonical runner
- Related regression reruns:
  - none; this round fixed harness discipline only, and the clean isolated rerun reproduced no backend product defect
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-load03-local-bootstrap-summary-20260424-212601.md`
  - `tests/backend/artifacts/results/qa-load03-local-bootstrap-summary-20260424-212601.json`
- Open risks after closure:
  - explicit external-backend perf runs still rely on a correct manifest/base-URL contract; if an operator points the runner at the wrong live backend, the harness cannot infer intent
  - stale backend `http://localhost:62922` was left untouched because ownership outside this round was not proven; repro backend `62924` created for this investigation was shut down after validation

### QA addendum - 2026-04-24 LOAD-03 product fix and canonical ripple rerun

- Verified harnesses and suites this round:
  - `tests/backend/runners/run-backend-perf-write-contention.ps1`
  - `test-all-modules.ps1`
- Round environments:
  - pre-fix valid-contract local control artifact: `tests/backend/artifacts/results/perf.write-contention-summary-20260424-215242.json`
  - passing isolated backend after fix: `http://localhost:50512/api`
  - passing isolated health: `http://localhost:50512/health`
  - passing isolated Mongo override: `mongodb://127.0.0.1:27017/htxbachgia_load03_local_20260424220532`
  - passing runtime manifest: `tests/backend/artifacts/results/runtime-contract-load03-local-20260424-220532.json`
- Audit trail kept:
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260424-215242.json`
    - status: `FAILED_PRODUCT`
    - result: valid-contract local control failed thresholds with `owner_withdrawal_approve_commit_duration p95=2225.10ms`, `return_resolve_commit_duration p95=3447.36ms`, `other_cost_confirm p95=1310.48ms`
  - `tests/backend/artifacts/results/run-backend-perf-write-contention-local-bootstrap-20260424-220531.log`
    - status: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
    - result: dedicated local bootstrap backend `http://localhost:50512/api`
  - `tests/backend/artifacts/results/load03-runtime-contract-check-20260424-220622.json`
    - status: `PASSED`
    - result: runtime manifest DB contract matched backend `/api/health/db`
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260424-220622.json`
    - status: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
    - result: `120` iterations, `293` HTTP requests, `0.00% http_req_failed`, global `http_req_duration p95=1070.93ms`, `supplier_payment_batch p95=441.82ms`, `agent_payment_batch p95=521.25ms`, `owner_withdrawal_approve_commit_duration p95=1503.89ms`, `return_resolve_commit_duration p95=1433.85ms`, `other_cost_confirm p95=861.64ms`
  - `tests/backend/artifacts/results/module-regression-rerun-20260424-load03fix-20260424-220658.log`
    - status: `PASSED`
    - result: canonical local-bootstrap module regression rerun stayed green
  - `tests/backend/artifacts/results/module-regression-20260424-220747.json`
    - status: `PASSED`
    - result: `1163 PASS / 0 FAIL / 0 BLOCKED`, `25/25` suites
- Root causes and fixes:
  - `backend/src/test-order2/services/order-calculation.service.ts`
    - same-day order recalculation now runs as a per-day single-flight loop with pending-rerun drain, so `LOAD-03` no longer launches overlapping duplicate recalculations for the same business day
  - `backend/src/finance/events/finance-event-listener.service.ts`
    - `ops`, `agent`, and `supplier` snapshot refreshes are now coalesced per domain instead of running overlapping refresh storms during the same contention burst
- Related regression reruns:
  - `test-all-modules.ps1`: `PASSED`, `1163 PASS / 0 FAIL / 0 BLOCKED`
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-load03-product-fix-summary-20260424-221308.md`
  - `tests/backend/artifacts/results/qa-load03-product-fix-summary-20260424-221308.json`
- Open risks after closure:
  - explicit external-manifest `LOAD-03` should still be rerun if a fresh cross-shell/container confirmation is required after the product fix
  - stale backend `http://localhost:62922/api` was left untouched because ownership outside this round was not proven

### QA addendum - 2026-04-19 LOAD-04 analytics-read closure

- Verified harnesses and setup this round:
  - `tests/backend/perf/create-analytics-read-fixture.js`
  - `tests/backend/perf/perf.analytics-read.k6.js`
- Round environments:
  - first failed isolate env note: `perf.analytics-read-seed-setup-20260419-170009.log` (`FAILED_HARNESS/BLOCKED_ENV`)
  - clean passing isolate backend: `http://localhost:50108`
  - clean passing health: `http://localhost:50108/health`
  - clean passing Mongo override: `mongodb://127.0.0.1:27017/htxbachgia_load04_20260419-170954`
  - Docker k6 base URL: `http://host.docker.internal:50108`
- Audit trail:
  - `tests/backend/artifacts/results/perf.analytics-read-seed-setup-20260419-170009.log`
    - status: `FAILED_HARNESS/BLOCKED_ENV`
    - observation: isolate backend answered `/health`, but auth still hit the wrong Mongo target and returned `401`
  - `tests/backend/artifacts/results/perf.analytics-read-seed-setup-20260419-170436.log`
    - status: `FAILED_HARNESS`
    - observation: fixture drift round exposed invalid `other-cost.category`, hard-coded unique IDs, and dirty-DB row duplication on rerun
  - `tests/backend/artifacts/results/perf.analytics-read-seed-setup-20260419-170817.log`
    - status: `FAILED_HARNESS`
    - observation: return self-check used regex drift and expected `0` while the reports correctly returned `48`
  - `tests/backend/artifacts/results/perf.analytics-read-seed-setup-20260419-170954.log`
    - status: `FIXED_ENV -> FIXED_HARNESS -> FIXED_HARNESS -> FIXED_HARNESS -> PASSED`
    - result: `24` ad groups, `192` orders, `48` returns, `24` advertising-cost rows, `12` other-cost rows
  - `tests/backend/artifacts/results/perf.analytics-read-summary-20260419-171115.json`
    - status: `PASSED`
    - result: `3808` HTTP requests, `0.00% http_req_failed`, global `p95=61.49ms`, `financial_control_dashboard p95=22.82ms`, `financial_control_dashboard_refresh p95=71.13ms`, `cashflow_dashboard_summary p95=13.04ms`, `ad_group_profit_report_performance p95=73.14ms`, `return_report_product p95=41.05ms`, `return_report_ad_group p95=41.28ms`
- Root causes and fixes:
  - `tests/backend/perf/create-analytics-read-fixture.js`
    - `other-cost.category` now stays inside the real enum contract, seed namespaces use per-run keys, and self-checks compare against the canonical `statuses.returned` value
  - `tests/backend/perf/perf.analytics-read.k6.js`
    - root base URLs are normalized before `/api` is appended, and the active harness now writes a JSON summary artifact for traceable closure
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-analytics-read-summary-20260419-171318.md`
  - `tests/backend/artifacts/results/qa-analytics-read-summary-20260419-171318.json`
- Open risks after closure:
  - remaining gap groups after this round: `LOAD-05+`
  - no product regression reruns were required in this round because no backend product code changed; this closure fixed harness/env issues only
  - native `k6` is still not on `PATH`; Docker `grafana/k6` remains the verified local runner

### QA addendum - 2026-04-24 Finance Survival Alerts closure and canonical 25-suite rerun

- Scope:
  - close the only failing suite from the isolated full module regression run on `2026-04-24 17:00:22 +07`
  - preserve `FAILED -> FIXED -> PASSED` history
  - rerun the full active backend catalog after the fix
- Audit trail kept:
  - `tests/backend/artifacts/results/module-regression-rerun-20260424-170012.log`
    - status: `FAILED_HARNESS`
    - result: `1141 PASS / 3 FAIL`
    - blocker suite: `module.finance-survival-alerts.ps1`
    - failing assertions:
      - `DSO was not greater than DPO`
      - `Cashflow status missing`
      - `Missing DPO_LESS_THAN_DSO alert`
  - `tests/backend/artifacts/results/module.finance-survival-alerts-rerun-20260424-172136.log`
    - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
    - result: `18 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module-regression-rerun-20260424-172224.log`
    - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
    - result: `1145 PASS / 0 FAIL`, `25/25` suites
  - `tests/backend/artifacts/results/module-regression-20260424-172235.json`
    - status: `PASSED`
    - result: `1145 PASS / 0 FAIL`, `25/25` suites
- Root cause:
  - `backend/scripts/test-scenario-4-finance-health.js` Phase 1 fixture seeded `agentQuote` but did not seed `agentPaidAmount`
  - current `GET /finance/cashflow-health` path computes `dso` via `AgentReceivableService.getCashflowSummary()`, which reads `ordertest2.agentPaidAmount`
  - isolated clean-DB probe before the fix returned `dso=0`, `dpo=2.1`, `status=safe`, `alerts=[]`
- Fix:
  - `backend/scripts/test-scenario-4-finance-health.js`
    - `setupScenario1` now seeds `agentPaidAmount=6_900_000` so Scenario 1 exercises the same cashflow input that the current dashboard code actually reads
    - assertions were kept unchanged
- Post-fix verification:
  - targeted rerun `module.finance-survival-alerts.ps1`: `18 PASS / 0 FAIL`
  - canonical full rerun `tests/backend/runners/run-backend-module-regression.ps1`: `1145 PASS / 0 FAIL`
- Traceable summaries:
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260424-172235.md`
  - `tests/backend/artifacts/results/qa-module-regression-summary-20260424-172235.json`

### QA addendum - 2026-04-24 owner-fund ledger consistency closure

- Scope:
  - reproduce owner-withdrawal ledger/history drift on fresh approved/completed withdrawals
  - fix the root cause in `backend/src/owner-fund/owner-fund.service.ts`
  - rerun owner-fund module, owner-fund concurrency ripple, finance/funds cache ripple, and canonical full module regression
- Audit trail kept:
  - `tests/backend/artifacts/results/module.owner-fund-loan-ledger-rerun-20260424-223653.log`
    - status: `FAILED_PRODUCT`
    - result: `45 PASS / 3 FAIL`
    - failing assertions:
      - completed withdrawal missing from owner transaction history
      - owner transaction history `summary.totalOut=0`
      - fund summary `summary.totalOut=0`
  - `tests/backend/artifacts/results/module.owner-fund-loan-ledgerfix-rerun-20260424-224104.log`
    - status: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
    - result: `67 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-run-20260424-224135.log`
    - status: `FAILED_HARNESS`
    - result: `61 PASS / 3 FAIL`
    - root cause: PowerShell helper unwrapped a singleton ledger row, hiding `.Count` for the exact-once check
  - `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-run-20260424-224220.log`
    - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
    - result: `67 PASS / 0 FAIL`
    - exact-once ledger assertions now cover approve-vs-approve, approve-vs-reject, and approve-vs-cancel
  - ad hoc isolated rerun before the final finance/funds pass:
    - status: `FAILED_HARNESS_ENV`
    - evidence: `tests/backend/artifacts/results/tmp-finance-funds-ownerfund-backend-20260424-224316.err.log`
    - observation: backend bootstrap in that shell flow could not find `backend/dist/main.js`, so the suite never started
  - `tests/backend/artifacts/results/module.finance-control-funds-ownerfund-rerun-20260424-224617.log`
    - status: `FAILED_HARNESS_ENV -> FIXED_HARNESS_ENV -> PASSED`
    - result: `40 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module-regression-20260424-224736.json`
    - status: `PASSED`
    - result: `1186 PASS / 0 FAIL / 0 BLOCKED`, `25/25` suites
- Root cause:
  - owner-withdrawal approve/complete mutated `availableBalance` and `totalWithdrawn`, but no linked `fund_transactions` row was created for fresh-path ledger/history APIs
- Fix:
  - `backend/src/owner-fund/owner-fund.service.ts`
    - `approveWithdrawal()` now creates exactly one linked `FundTransaction` inside the same Mongo transaction that approves the withdrawal and debits owner balance
    - `completeWithdrawal()` only updates the linked ledger reference metadata when a final bank transaction reference is supplied; it does not create a second money-out row
    - approval now emits `OWNER_FUND_CHANGED` after commit so finance/funds caches refresh from the real money-out event
- Post-fix verification:
  - `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`: `67 PASS / 0 FAIL`
  - `tests/backend/suites/e2e-flows/e2e.concurrent-finance-ripple.ps1`: `67 PASS / 0 FAIL`
  - `tests/backend/suites/modules/core/module.finance-control-funds.ps1`: `40 PASS / 0 FAIL`
  - `powershell -ExecutionPolicy Bypass -File .\test-all-modules.ps1`: `1186 PASS / 0 FAIL / 0 BLOCKED`, `25/25` suites
- Open risks after closure:
  - pre-fix `approved/completed` withdrawals may still need a separate backfill/migration if historical ledger/history parity is required
  - this round fixed fresh-path correctness and exact-once race behavior; it did not fabricate legacy ledger rows

### QA addendum - 2026-04-24 owner-fund historical ledger reconciliation closure

- Scope:
  - reproduce historical owner-withdrawal ledger drift on isolated fixture and on the real QA DB `mongodb://127.0.0.1:27017/htxbachgia`
  - fix the root cause in owner-fund schema/query handling instead of loosening the historical suite
  - activate `tests/backend/suites/modules/extended/module.owner-fund-ledger-reconcile.ps1`
  - rerun related owner-fund / finance regressions and canonical full module regression
  - apply the reconcile path to the real QA DB only after the active suite and related regressions were green
- Audit trail kept:
  - `tests/backend/artifacts/results/module.owner-fund-ledger-reconcile-rerun-20260424-231537.log`
    - status: `FAILED_HARNESS`
    - result: fixture seed succeeded but the PowerShell helper treated the node-script output as invalid JSON
  - `tests/backend/artifacts/results/module.owner-fund-ledger-reconcile-rerun-20260424-231811.log`
    - status: `FAILED_HARNESS`
    - result: suite advanced to dry-run step but the native-command call path still needed cleanup before the real product signal was visible
  - `tests/backend/artifacts/results/module.owner-fund-ledger-reconcile-rerun-20260424-233235.log`
    - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
    - result: `26 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module.owner-fund-loan-rerun-20260424-233410.log`
    - status: `PASSED`
    - result: `67 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module.finance-control-funds-rerun-20260424-233410.log`
    - status: `PASSED`
    - result: `40 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-rerun-20260424-233410.log`
    - status: `PASSED`
    - result: `67 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module-regression-20260424-233705.json`
    - status: `PASSED`
    - result: `1212 PASS / 0 FAIL / 0 BLOCKED`, `26/26` suites
  - `tests/backend/artifacts/results/owner-fund-ledger-reconcile-dryrun-real-20260424-234202.json`
    - status: `FAILED_PRODUCT`
    - result: `18` anomalies, `55,840,000` missing amount, `0` duplicates
  - `tests/backend/artifacts/results/owner-fund-ledger-reconcile-apply-real-20260424-234211.json`
    - status: `FAILED_PRODUCT -> FIXED_PRODUCT`
    - result: `18` inserted, `0` anomalies after apply
  - `tests/backend/artifacts/results/owner-fund-ledger-reconcile-verify-real-20260424-234218.json`
    - status: `PASSED`
    - result: `0` anomalies, `0` duplicates
  - `tests/backend/artifacts/results/owner-fund-ledger-reconcile-api-probe-20260424-234228.json`
    - status: `PASSED`
    - result: real-QA-DB owner-history API now returns the repaired withdrawal row and `summary.totalOut`
- Root cause:
  - `backend/src/owner-fund/schemas/fund-transaction.schema.ts` and `backend/src/owner-fund/schemas/withdrawal.schema.ts` declared `ObjectId` decorator metadata as `Types.ObjectId`, which compiled as Mongoose `Mixed` instead of `ObjectId`
  - live owner-fund writes therefore persisted `ownerId` as string, while the historical reconciliation path used true `ObjectId`
  - owner-scoped reads in `backend/src/owner-fund/owner-fund.service.ts` queried raw string equality and therefore ignored historical backfilled rows even when `fund-summary` already reflected the money-out amount
  - `backend/scripts/reconcile-owner-withdrawal-ledger.js` reconstructed owner history from `fund_transactions` using string-only ownerId filters, so mixed-type history could be partially invisible during balance reconstruction
- Fix:
  - `backend/src/owner-fund/schemas/fund-transaction.schema.ts`
    - `ownerId` and `createdBy` now use `SchemaTypes.ObjectId`
  - `backend/src/owner-fund/schemas/withdrawal.schema.ts`
    - `ownerId` and `approvedBy` now use `SchemaTypes.ObjectId`
  - `backend/src/owner-fund/owner-fund.service.ts`
    - owner-scoped reads (`findAllWithdrawals`, `getOwnerStatistics`, `findAllFundTransactions`, `getOwnerTransactionHistory`) now match by stringified `ownerId` via `$expr`, so legacy string rows and normalized `ObjectId` rows remain visible through the same API contract
  - `backend/scripts/reconcile-owner-withdrawal-ledger.js`
    - existing owner-event rows for balance reconstruction are now loaded by stringified `ownerId`, not string-only equality
  - `tests/backend/suites/modules/extended/module.owner-fund-ledger-reconcile.ps1`
    - historical backfill + idempotence lane is now active and green
- Post-fix verification:
  - `tests/backend/suites/modules/extended/module.owner-fund-ledger-reconcile.ps1`: `26 PASS / 0 FAIL`
  - `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`: `67 PASS / 0 FAIL`
  - `tests/backend/suites/modules/core/module.finance-control-funds.ps1`: `40 PASS / 0 FAIL`
  - `tests/backend/suites/e2e-flows/e2e.concurrent-finance-ripple.ps1`: `67 PASS / 0 FAIL`
  - `powershell -ExecutionPolicy Bypass -File .\test-all-modules.ps1`: `1212 PASS / 0 FAIL / 0 BLOCKED`, `26/26` suites
- Residual risk after closure:
  - owner-fund APIs and the reconcile path now tolerate both historical string and normalized `ObjectId` storage, but there is no separate global data migration yet that normalizes all legacy owner-fund references to one BSON type

### QA addendum - 2026-04-25 owner-fund ObjectId normalization and delete-guard closure

- Scope:
  - activate `tests/backend/suites/modules/extended/module.owner-fund-objectid-normalize.ps1`
  - reproduce and fix the owner delete path that allowed removing an owner with existing withdrawals/fund transactions
  - normalize mixed string/ObjectId owner-fund refs on the real QA DB only after the active suite and related regressions were green
  - rerun related owner-fund / finance regressions and canonical full module regression
  - keep a read-only orphan-owner audit for the residual real-QA data issue instead of inventing owners
- Audit trail kept:
  - `tests/backend/artifacts/results/module.owner-fund-objectid-normalize-direct-run-20260425-000805.err.log`
    - status: `FAILED_HARNESS`
    - result: suite parser/bootstrap drift on the first isolated activation attempt
  - `tests/backend/artifacts/results/module.owner-fund-objectid-normalize-direct-run-20260425-000902.out.log`
    - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
    - result: baseline normalize lane closed once the PowerShell here-string/parser drift was fixed
  - `tests/backend/artifacts/results/module.owner-fund-objectid-normalize-rerun-20260425-001052.out.log`
    - status: `PASSED`
    - result: hardening rerun stayed green after adding unexpected-BSON blockers and compare-and-set updates to the normalize script
  - `tests/backend/artifacts/results/module.owner-fund-objectid-normalize-deleteguard-rerun-20260425-001836.out.log`
    - status: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
    - result: `43 PASS / 0 FAIL / 0 BLOCKED`
  - `tests/backend/artifacts/results/owner-fund-objectid-normalize-dryrun-real-20260425-001107.json`
    - status: `FAILED_PRODUCT`
    - result: `98` convertible refs, `0` invalid strings, `0` unexpected BSON-type blockers
  - `tests/backend/artifacts/results/owner-fund-objectid-normalize-apply-real-20260425-001132.json`
    - status: `FAILED_PRODUCT -> FIXED_PRODUCT`
    - result: `98` refs updated (`40` `withdrawals.ownerId`, `29` `withdrawals.approvedBy`, `11` `fund_transactions.ownerId`, `18` `fund_transactions.createdBy`)
  - `tests/backend/artifacts/results/owner-fund-objectid-normalize-verify-real-20260425-001143.json`
    - status: `PASSED`
    - result: `0` convertible refs, `0` invalid strings, `0` unexpected BSON-type blockers
  - `tests/backend/artifacts/results/owner-fund-delete-guard-repro-pass-20260425-003420.json`
    - status: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
    - result: deleting an owner with financial history now returns `HTTP 400` and leaves the owner row readable
  - `tests/backend/artifacts/results/module.owner-fund-loan-cleanupfix-rerun-20260425-002706.out.log`
    - status: `PASSED`
    - result: `67 PASS / 0 FAIL`; suite cleanup now removes dependent rows before deleting seeded owners
  - `tests/backend/artifacts/results/module.finance-control-funds-objectidguard-rerun-20260425-001924.out.log`
    - status: `PASSED`
    - result: `40 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-objectidguard-rerun-20260425-001924.out.log`
    - status: `PASSED`
    - result: `67 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module-regression-owner-objectid-final-20260425-002719.log`
    - status: `PASSED`
    - result: canonical local-bootstrap full rerun stayed green
  - `tests/backend/artifacts/results/module-regression-20260425-002807.json`
    - status: `PASSED`
    - result: `1254 PASS / 0 FAIL / 0 BLOCKED`, `27/27` suites
  - `tests/backend/artifacts/results/owner-fund-orphan-owner-audit-real-20260425-111459.json`
    - status: `FAILED_PRODUCT`
    - result: real QA DB still has `15` orphan owner refs spanning `37` withdrawal docs and `26` fund transactions
- Root causes:
  - `backend/scripts/normalize-owner-fund-objectids.js` originally only converted canonical string ids and did not classify unexpected BSON types as blockers or use compare-and-set filters on apply
  - `backend/src/owner-fund/owner-fund.service.ts`
    - `deleteOwner()` previously allowed deleting an owner even when withdrawals/fund transactions still referenced that owner id, which could orphan financial history
  - `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`
    - older cleanup flow deleted seeded owners via API without first removing dependent history, so shared environments could accumulate ownerless rows before the delete guard was tightened
  - the residual real-QA orphan-owner set is historical identity loss, not surviving type drift: the money rows remain, but the authoritative `owners` rows no longer exist
- Fix:
  - `backend/scripts/normalize-owner-fund-objectids.js`
    - dry-run now flags invalid strings and unexpected BSON types as blockers
    - apply path now updates rows with compare-and-set filters so concurrent changes cannot be overwritten blindly
  - `backend/src/owner-fund/owner-fund.service.ts`
    - `deleteOwner()` now rejects deletion when any withdrawal or fund-transaction history still points at the owner id, using the same flexible mixed-type owner filter as the read paths
  - `tests/backend/suites/modules/extended/module.owner-fund-objectid-normalize.ps1`
    - active lane now covers dry-run/apply/re-apply normalization plus delete-owner-with-history contract hardening
  - `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`
    - cleanup now removes dependent owner-fund rows directly in Mongo before deleting seeded owners, preventing new shared-DB orphaning from suite teardown
- Post-fix verification:
  - `tests/backend/suites/modules/extended/module.owner-fund-objectid-normalize.ps1`: `43 PASS / 0 FAIL / 0 BLOCKED`
  - `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`: `67 PASS / 0 FAIL`
  - `tests/backend/suites/modules/core/module.finance-control-funds.ps1`: `40 PASS / 0 FAIL`
  - `tests/backend/suites/e2e-flows/e2e.concurrent-finance-ripple.ps1`: `67 PASS / 0 FAIL`
  - `powershell -ExecutionPolicy Bypass -File .\test-all-modules.ps1`: `1254 PASS / 0 FAIL / 0 BLOCKED`, `27/27` suites
  - real QA DB objectId normalization: `98` refs updated, post-verify `0` convertible refs remain
- Residual risk after closure:
  - real QA DB still contains `15` orphan owner refs; the current safe path is read-only audit because child owner-fund documents do not contain enough authoritative owner identity to reconstruct deleted `owners` rows without inventing data
  - owner-scoped APIs remain intentionally strict and will still return `404` when the owner document itself is missing, even if raw list endpoints can still surface the underlying money rows
  - any future repair must be a one-off authoritative restore path driven by backup/export evidence, not a generic migration or placeholder-owner backfill

### QA addendum - 2026-04-25 owner-fund orphan fixture cleanup closure

- Scope:
  - validate snapshot-scoped orphan-fixture cleanup logic locally via `tests/backend/suites/modules/extended/module.owner-fund-orphan-fixture-cleanup.ps1`
  - reproduce the real QA DB orphan-owner issue on a fresh audit snapshot
  - classify the real QA DB orphan clusters via dry-run before any delete
  - apply cleanup only after dry-run confirmed `0` blocked clusters and `0` unknown clusters
  - rerun serial verify audit and idempotent re-apply on the same real QA DB
- Audit trail kept:
  - `tests/backend/artifacts/results/module.owner-fund-orphan-fixture-cleanup-rerun-20260425-115356.log`
    - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
    - result: local validation suite closed at `44 PASS / 0 FAIL / 0 BLOCKED`
  - `tests/backend/artifacts/results/owner-fund-orphan-owner-audit-real-20260425-115356.json`
    - status: `FAILED_PRODUCT`
    - result: real QA DB pre-audit found `15` orphan owner refs spanning `37` withdrawal docs and `26` fund transactions
  - `tests/backend/artifacts/results/owner-fund-orphan-cleanup-dryrun-real-20260425-115356.json`
    - status: `FAILED_PRODUCT`
    - result: `15` eligible clusters (`11` `module.owner-fund-loan`, `4` `synthetic.emergency-owner-fund`), `0` blocked clusters, `0` unknown clusters, `63` candidate docs
  - `tests/backend/artifacts/results/owner-fund-orphan-cleanup-apply-real-20260425-115356.json`
    - status: `FAILED_PRODUCT -> FIXED_DATA`
    - result: deleted `37` orphan withdrawals and `26` orphan fund transactions, total `63`
  - `tests/backend/artifacts/results/owner-fund-orphan-owner-audit-verify-real-20260425-115356.json`
    - status: `DISCARDED`
    - result: artifact nay duoc tao song song voi `apply`, nen la race artifact khong authoritative va khong duoc dung lam post-apply verify
  - `tests/backend/artifacts/results/owner-fund-orphan-owner-audit-verify-real-20260425-120005.json`
    - status: `PASSED`
    - result: serial verify audit returned `0` orphan owner refs, `0` orphan withdrawals, `0` orphan fund transactions
  - `tests/backend/artifacts/results/owner-fund-orphan-cleanup-idempotent-real-20260425-120005.json`
    - status: `PASSED`
    - result: re-apply on zero-orphan snapshot deleted `0` docs
  - `tests/backend/artifacts/results/module-regression-20260425-002807.json`
    - status: `PASSED`
    - result: latest canonical active full gate before/after this data-only round remains `1254 PASS / 0 FAIL / 0 BLOCKED`, `27/27` suites
- Root causes:
  - real QA DB retained historical orphan rows from two exact fixture families that were no longer backed by authoritative `owners` documents
  - `11` orphan clusters matched the exact `module.owner-fund-loan` synthetic family already known in the repo
  - `4` orphan clusters matched the exact `synthetic.emergency-owner-fund` signature with explicit E2E-style marker strings and linked withdrawal/fund-transaction references; round nay khong claim provenance toi bat ky active suite hien hanh nao
  - prior to this round, there was no snapshot-scoped exact-pattern cleanup helper with a hard stop on unknown cluster shapes
- Fix / control:
  - `backend/scripts/cleanup-owner-fund-orphan-fixtures.js`
    - classify orphan-owner clusters from a provided audit JSON only
    - allow `--apply` chi khi tat ca clusters deu nam trong allowlist exact-pattern va khong co `blocked`/`unknown`
    - giu note ro rang rang helper nay khong phai generic owner-restore path va khong prove provenance cua `synthetic.emergency-owner-fund` toi active suite nao
  - `tests/backend/suites/modules/extended/module.owner-fund-orphan-fixture-cleanup.ps1`
    - local validation lane cover dry-run classification, blocked apply when unknown cluster exists, successful apply after unknown cluster removal, final zero-orphan verify, va idempotent re-apply
- Post-fix verification:
  - `tests/backend/suites/modules/extended/module.owner-fund-orphan-fixture-cleanup.ps1`: `44 PASS / 0 FAIL / 0 BLOCKED`
  - real QA DB pre-audit -> cleanup apply -> serial verify: `FAILED_PRODUCT -> FIXED_DATA -> PASSED`
  - real QA DB idempotent re-apply: `PASSED`, deleted `0`
  - canonical active full regression khong can rerun trong round nay vi khong co runtime product code path nao thay doi; latest green gate van la `tests/backend/artifacts/results/module-regression-20260425-002807.json`
- Residual risk after closure:
  - helper nay chi an toan cho orphan snapshot/family exact-match; neu future audit lo ra cluster shape moi thi phai `BLOCKED`/manual review, khong duoc auto-delete
  - suite `module.owner-fund-orphan-fixture-cleanup.ps1` la validation/admin lane khong nam trong active `27`-suite regression gate
  - generic owner-identity restore van phai la mot playbook rieng dua tren bang chung authoritative, khong duoc suy luan tu child documents

### Legacy note (superseded) - `CON-09` Other-cost timezone boundary recalc

- Táº¡o/Ä‘á»•i `other-cost` sáº¯p ranh vá» date boundary vÃ  cÃ³ `dueDate` qua ngÃ y lá»ch timezone.
- KÃ­ch hoáº¡t create/update/confirm/remove Ä‘á»ƒ xem recalc theo cáº£ local day vÃ  UTC day.
- Ká»³ vá»ng:
  1. Chá»‰ recalc Ä‘Ãºng order ngÃ y liÃªn quan, khÃ´ng bá» sá»‘t vÃ  khÃ´ng recalc tráº» sang ngÃ y khÃ¡c.
  2. Cashflow summary phÃ¢n biá»‡t Ä‘Æ°á»£c confirmed/unconfirmed vÃ  due14d.
