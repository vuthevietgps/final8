# SMARTERP — Hệ Thống Quản Lý Doanh Nghiệp
**Version**: 15.0 | **Cập nhật**: 23/02/2026

---

## 1. TỔNG QUAN

Hệ thống ERP quản lý doanh nghiệp thương mại điện tử, tập trung vào:
- Quản lý đơn hàng & chuỗi cung ứng (NCC, Đại lý)
- Theo dõi ROI quảng cáo (Facebook, Google, TikTok)
- Kiểm soát tài chính & dòng tiền (CFO Dashboard)
- Quản lý nhân sự & KPI nhân viên quảng cáo

### Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | NestJS + TypeScript | v11.x |
| Frontend | Angular + Standalone Components + Signals | v20.x |
| Database | MongoDB Atlas (Mongoose ODM) | v8.18 |
| Auth | Passport JWT (4h expiry) | v11.x |
| Scheduling | @nestjs/schedule (Cron jobs) | v6.x |
| External | Facebook Ads, Google Ads, TikTok Ads, Google Sheets | - |

### Khởi chạy
```bash
cd backend && npm run start:dev    # http://localhost:3000
cd frontend && npm start           # http://localhost:4200
```

### Test Account
| Role | Email | Password |
|------|-------|----------|
| Director | director@test.com | 123456 |

---

## 2. KIẾN TRÚC BACKEND (48 modules, 57 controllers)

### 2.1 Entry Point
- `main.ts`: Global prefix `/api` (trừ `/health`), CORS (4200, 4201, 8080), ValidationPipe (whitelist + transform), SanitizePipe, UTF-8 middleware
- `app.module.ts`: Import 45 modules (2 orphaned: `inventory/`, `purchase/`)

### 2.2 Modules theo Domain

#### 🔐 Auth & Users (5 modules)
| Module | Prefix | Chức năng |
|--------|--------|-----------|
| `auth` | `/auth` | Login, register, validate-token, logout |
| `user` | `/users` | CRUD 7 loại user, deactivate/reactivate |
| `export-user` | `/export-users` | Export CSV |
| `import-user` | `/import-users` | Import CSV |
| `session-log` | `/session-logs` | Lịch sử đăng nhập |

**7 loại user**: director, manager, employee, internal_agent, external_agent, internal_supplier, external_supplier

#### 📦 Đơn hàng & Thanh toán (6 modules)
| Module | Prefix | Chức năng |
|--------|--------|-----------|
| `test-order2` | `/test-order2` | CRUD đơn hàng, seed, export, import, supplier/agent payment batch |
| `pending-order` | `/pending-orders` | Đơn chờ duyệt → approved → tạo order |
| `order-status` | `/order-status` | Cấu hình trạng thái đơn hàng |
| `order-update` | `/order-update` | Cập nhật trạng thái đơn hàng |
| `return-request` | `/returns` | Yêu cầu hoàn hàng (items[].decision) |
| `return-report` | `/return-report` | Báo cáo hoàn hàng |

#### 🛍️ Sản phẩm & Khách hàng (5 modules)
| Module | Prefix | Chức năng |
|--------|--------|-----------|
| `product-category` | `/product-category` | Nhóm sản phẩm |
| `product` | `/products` | Sản phẩm |
| `media` | `/media` | Upload ảnh sản phẩm |
| `customer` | `/customers` | Quản lý khách hàng |
| `quote` | `/quotes` | Báo giá đại lý |

#### 📢 Quảng cáo (8 modules)
| Module | Prefix | Chức năng |
|--------|--------|-----------|
| `ad-account` | `/ad-accounts` | Tài khoản quảng cáo |
| `ad-group` | `/ad-groups` | Nhóm quảng cáo (+ sync Facebook) |
| `advertising-cost` | `/advertising-cost` | Chi phí QC (JWT required) |
| `advertising-cost-public` | `/advertising-cost-public` | Chi phí QC (public, no auth) |
| `advertising-optimization` | — | Logic tối ưu QC |
| `ads-alerts` | `/ads-alerts` | Cảnh báo real-time (SSE, cron 30min) |
| `employee-ads-kpi` | `/employee-ads-kpi` | KPI nhân viên QC |
| `ad-group-profit-report` | `/ad-group-profit-report` | Báo cáo lợi nhuận nhóm QC |

#### 💳 Tài chính (3 multi-controller modules)
| Module | Controllers | Chức năng |
|--------|------------|-----------|
| `finance` | 7 controllers: `finance`, `financial-control`, `budget-allocation`, `capital-allocation`, `funds`, `loan-management`, `ad-group-daily-report` | CFO dashboard, vay, đầu tư, báo cáo |
| `cashflow-control` | 5 controllers: `dashboard`, `ads-decision`, `alerts`, `funds`, `profit` | Kiểm soát dòng tiền |
| `owner-fund` | 1 controller | Quỹ chủ sở hữu, rút tiền, giao dịch |

#### 💰 Chi phí & Nhân sự (4 modules)
| Module | Prefix | Chức năng |
|--------|--------|-----------|
| `labor-cost1` | `/labor-cost1` | Chi phí nhân công + Labor Statement |
| `other-cost` | `/other-cost` | Chi phí khác |
| `salary-config` | `/salary-config` | Cấu hình lương |
| `supplier-payable` | `/supplier-payables` | Công nợ NCC |

#### 🤝 Đại lý & NCC (3 modules)
| Module | Prefix | Chức năng |
|--------|--------|-----------|
| `agent-receivable` | `/agent-receivables`, `/agent-payables` | Công nợ đại lý |
| `supplier-quote` | `/supplier-quotes` | Báo giá NCC |
| `fanpage` | `/fanpages` | Quản lý fanpage |

#### ⚙️ Hệ thống & Cấu hình (8 modules)
| Module | Prefix | Chức năng |
|--------|--------|-----------|
| `health` | `/health` | Health check (no auth) |
| `delivery-status` | `/delivery-status` | Trạng thái giao hàng |
| `production-status` | `/production-status` | Trạng thái sản xuất |
| `google-sync` | `/google-sync` | Sync Google Sheets |
| `order-sheet-sync` | `/order-sheet-sync` | Sync đơn hàng ↔ Google Sheets |
| `openai-config` | `/openai-configs` | Cấu hình OpenAI |
| `api-token` | `/api-tokens` | Token API (Facebook, Google, TikTok) |
| `chat-message` | `/chat-messages`, `/webhook/messenger` | Chat Messenger |

---

## 3. KIẾN TRÚC FRONTEND (48 features, 15 sidebar menus)

### 3.1 Core Layer
- **AuthService**: Login/logout, JWT token management, role-permission mapping
- **AuthGuard**: Check token → validate with backend → check route permissions
- **GuestGuard**: Redirect logged-in users to dashboard
- **AuthInterceptor**: Attach `Authorization: Bearer` header to all requests
- **ThemeService**: Theme switching

### 3.2 Ma trận phân quyền (Role → Permissions)

| Permission | Director | Manager | Employee | Int.Agent | Ext.Agent | Int.Supplier | Ext.Supplier |
|------------|:--------:|:-------:|:--------:|:---------:|:---------:|:------------:|:------------:|
| users | ✅ | | | | | | |
| orders | ✅ | ✅ | ✅ | ✅ | ✅ | | |
| products, product-categories | ✅ | | | ✅ | | ✅ | |
| ad-accounts, ad-groups | ✅ | ✅ | | | | | |
| advertising-costs | ✅ | ✅ | | | | | |
| ads-budget | ✅ | ✅ | | | | | |
| employee-ads-kpi | ✅ | ✅ | | | | | |
| finance | ✅ | ✅ | | | | | |
| owner-fund | ✅ | | | | | | |
| labor-costs, other-costs | ✅ | | | | | | |
| salary-config | ✅ | | | | | | |
| customers | ✅ | | | | | | |
| quotes | ✅ | | | | | ✅ | ✅ |
| reports, export, import | ✅ | | | | | | |
| delivery-status | ✅ | | | ✅ | ✅ | | |
| production-status | ✅ | | | | | | |
| media | ✅ | ✅ | | | | | |
| fanpages, openai-configs | ✅ | ✅ | | | | | |
| api-tokens | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| chat-messages | ✅ | ✅ | | | | | |
| pending-orders | ✅ | ✅ | | | | | |
| settings | ✅ | | | | | | |

### 3.3 Sidebar Navigation (15 menu groups)

| # | Icon | Menu | Routes chính |
|---|------|------|-------------|
| 1 | 👥 | Quản Lý Người Dùng | `/users`, `/costs/salary` |
| 2 | 🤝 | Nhà Cung Cấp | `/suppliers`, `/supplier-quotes`, `/payments/supplier` |
| 3 | 🏢 | Đại Lý | `/agents`, `/quotes`, `/payments/agent` |
| 4 | 📦 | Quản Lý Đơn Hàng | `/orders/test2`, `/orders/update`, `/orders/google-sheet-sync` |
| 5 | 🤝 | Quản Lý Khách Hàng | `/customers` |
| 6 | 🛍️ | Sản Phẩm | `/product-category`, `/product`, `/media`, `/media-report` |
| 7 | 💸 | Ngân Sách Ads | `/ads-budget` |
| 8 | 📊 | KPI Nhân Viên Ads | `/employee-ads-kpi` |
| 9 | 📢 | Quảng Cáo | `/ad-accounts`, `/ad-groups`, `/costs/advertising`, `/api-tokens`, `/ad-group-counts` |
| 10 | 🤖 | AI & Chat | `/fanpages`, `/openai-configs`, `/conversations`, `/api-tokens`, `/ads-settings` |
| 11 | 💰 | Chi Phí | `/costs/labor1`, `/costs/other` |
| 12 | 💳 | Tài Chính | `/finance/financial-control`, `/owner-fund`, `/finance/ad-group-daily-report`, `/loans` |
| 13 | 🔄 | Quản Lý Trạng Thái | `/production-status`, `/delivery-status` |
| 14 | 📈 | Lợi Nhuận | `/reports/daily-profit`, `/reports/return-report`, `/reports/product-profit` |
| 15 | ⚙️ | Cài Đặt | `/settings` |

+ 🔔 **Ads Alerts**: Notification bell trong sidebar header (cho user có permission `ad-groups`)

---

## 4. CÁC TÍNH NĂNG CHÍNH ĐÃ HOÀN THÀNH

### 4.1 Quản lý Đơn hàng (TestOrder2)
- CRUD đơn hàng với profit tracking, liên kết ad group
- Seed dữ liệu mẫu, export JSON/CSV
- Thanh toán hàng loạt NCC/Đại lý (payment batch)
- Pending orders → approve → tạo đơn hàng
- Return request với items[].decision

### 4.2 Quảng cáo & KPI
- Quản lý tài khoản QC (Facebook, Google, TikTok)
- Nhóm QC với budget/ROI tracking, auto-sync từ Facebook API
- Cảnh báo real-time (SSE + cron 30min, 8:00-22:00)
- Thresholds: ROI < 50% CRITICAL, < 80% WARNING, > 150% SUCCESS, CSI ≥ 0.7 KILL
- KPI nhân viên QC: daily suggestions, profitable stats, progress tracking
- Gợi ý chi phí tối ưu (suggestedSpend + suggestedSpendWithCap)

### 4.3 Tài chính (CFO Spec v3.0)
- **Dashboard 8 số**: Bank Balance, Committed(14D), Free Cash, Monthly Burn, Runway, AdsBudgetApproved(7D), OwnerWithdrawable, Forecast 7D LowPoint
- **Công thức**:
  - `FreeCash = BankBalance - CommittedCash(14D)`
  - `SurvivalFloor = 3 × MonthlyBurn`
  - `AvailableAfterSurvival = max(0, FreeCash - SurvivalFloor)`
  - `AdsBudgetApproved = min(OptimalAdsSuggestion, AvailableAfterSurvival)`
  - `OwnerWithdrawable = max(0, AvailableAfterSurvival - AdsBudgetApproved)`
- **Ads Budget Cap**: +20% tăng / -30% giảm per day vs baseline
- **Forecast 7 ngày**: Alert khi LowPoint < 0 (CASH CRUNCH) hoặc < SurvivalFloor (RỦI RO)

### 4.4 Quỹ Chủ sở hữu (Owner Fund)
- CRUD owners, deposit/withdrawal lifecycle
- Withdrawal flow: create → approve → complete (hoặc reject/cancel)
- Fund account statistics, transactions history

### 4.5 Khoản vay (Loan Management)
- Loan lifecycle: create → disburse → repayment → close
- Dashboard, upcoming payments, cashflow impact
- Payment options calculator

### 4.6 Chi phí
- Labor Cost: CRUD + Labor Statement (create → calculate → payment → close)
- Other Cost: CRUD + summary by month/category
- Salary Config: Cấu hình lương theo role

### 4.7 Chuỗi cung ứng
- Supplier Payable: Công nợ NCC, statement
- Agent Receivable: Công nợ đại lý, hoa hồng
- Supplier Quote / Quote: Báo giá NCC & đại lý

### 4.8 AI & Chat
- Fanpage management, OpenAI config
- Chat messages + Messenger webhook
- API token management (multi-platform)

---

## 5. TRẠNG THÁI TEST

### ✅ Kết quả: xem catalog QA hiện hành

| Nhóm | Vị trí chuẩn |
|------|-------------|
| Module core | `tests/backend/suites/modules/core/` |
| Module extended | `tests/backend/suites/modules/extended/` |
| E2E | `tests/backend/suites/e2e-flows/` |
| Scenario | `tests/backend/suites/business-scenarios/` |
| Legacy | `tests/backend/legacy/` |

Chi tiết:
- Catalog hiện hành: `tests/backend/README.md`
- Kế hoạch test hiện hành: `tests/backend/docs/backend-test-plan.md`
- Baseline lịch sử: `tests/backend/legacy/docs/TEST-PLAN-20260223.md`

### Chạy test
```bash
powershell -ExecutionPolicy Bypass -File test-all-modules.ps1
```

---

## 6. CẤU HÌNH & ENVIRONMENT

### Backend (.env)
```
MONGODB_URI=<MONGODB_URI_FROM_SECRET_MANAGER>
JWT_SECRET=your-secret
PORT=3000
CORS_ORIGINS=http://localhost:4200,http://localhost:4201
FB_ADS_ACCESS_TOKEN=...     # Optional
GOOGLE_ADS_*=...            # Optional
TIKTOK_*=...                # Optional
```

### Config Defaults (Financial Control)
| Key | Value |
|-----|-------|
| CommittedWindowDays | 14 |
| SurvivalMonths | 3 |
| SupplierCashCycleDays | 10 |
| RiskAdjustInflow | 0.80 |
| MinStartBudget | 200,000 VNĐ |
| UpperCapMultiplier | 1.20 |
| LowerCapMultiplier | 0.70 |

---

## 7. API PATTERNS

```
GET    /api/{resource}           # List (with query filters)
POST   /api/{resource}           # Create
GET    /api/{resource}/:id       # Get one
PATCH  /api/{resource}/:id       # Update
DELETE /api/{resource}/:id       # Delete
GET    /health                   # Health check (no auth)
```

- All requests require `Authorization: Bearer <token>` (except `/health`, `/auth/login`, `/auth/register`)
- ValidationPipe: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- CORS: `credentials: true`

---

## 8. GHI CHÚ PHÁT TRIỂN

### Modules chưa kích hoạt (orphaned)
- `inventory/` — có đầy đủ controller/service/schema nhưng chưa import trong app.module
- `purchase/` — tương tự

### Lưu ý kỹ thuật
- User field là `role` (không phải `userType`), `fullName` (không phải `name`)
- Login response trả `user.id` (không phải `user._id`)
- Return resolve dùng `items[].decision` (không phải `resolution`)
- Withdrawal approve dùng `approvedBy` (MongoId, không phải `approverNotes`)
- Loan repayment dùng `amountPrincipal` + `amountInterest` (không phải `amount` + `principalPortion`)
- Pending order → approve cần có `adGroupId`
- Ad group create cần `fanpageId` (tạo fanpage trước)
- Employee KPI: wildcard routes `@Get(':employeeId')` phải đặt cuối controller

### Tiến trình phát triển
| Ngày | Milestone |
|------|-----------|
| 30/01/2026 | Scaffold project, basic CRUD, first test scripts |
| 02/02/2026 | Financial modules, labor statement, CFO spec v2 |
| 03/02/2026 | Agent payment, ads alerts, advanced finance |
| 14/02/2026 | Phase 1-5 test scripts, E2E business flow |
| 16/02/2026 | Consolidated backend regression suites and cleanup |
