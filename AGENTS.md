# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Build and Run Commands

### Development
```bash
# Backend (NestJS) - runs on port 3000
cd backend && npm run start:dev

# Frontend (Angular) - runs on port 4200
cd frontend && npm start
```

### Production Build
```bash
cd backend && npm run build
cd frontend && npm run build
```

### Docker
```bash
docker-compose up -d          # Start all services
docker-compose logs -f        # View logs
docker-compose down           # Stop services
```

### Testing
```bash
cd backend && npm test              # Run backend tests
cd backend && npm run test:watch    # Watch mode
cd frontend && npm test             # Run frontend tests

# Backend QA regression catalog: tests/backend/README.md
powershell -ExecutionPolicy Bypass -File test-all-modules.ps1   # local QA bootstrap default: build backend, start dedicated local backend, run full module regression
powershell -ExecutionPolicy Bypass -File tests/backend/runners/run-backend-module-regression.ps1   # canonical runner for pre-bootstrapped or external backend
```

### Linting
```bash
cd backend && npm run lint
```

## Architecture Overview

This is a full-stack ERP system for business operations management with emphasis on advertising ROI tracking, financial control, and supply chain management.

### Tech Stack
- **Backend**: NestJS v11 + MongoDB (Mongoose) + Passport JWT
- **Frontend**: Angular v20 with standalone components + Signals
- **Database**: MongoDB Atlas
- **External APIs**: Facebook Ads, Google Ads, TikTok Ads, Google Sheets

### Backend Structure (backend/src/)

The backend uses NestJS module pattern. Each feature is a self-contained module with:
- `*.module.ts` - Module definition
- `*.controller.ts` - REST endpoints
- `*.service.ts` - Business logic
- `schemas/*.schema.ts` - Mongoose schemas
- `dto/*.dto.ts` - Request/response DTOs

**Key Modules by Domain:**

| Domain | Modules |
|--------|---------|
| Auth | `auth`, `user`, `session-log` |
| Orders | `test-order2`, `order-status`, `order-update`, `pending-order` |
| Finance | `finance`, `cashflow-control`, `owner-fund`, `supplier-payable`, `agent-receivable` |
| Advertising | `ad-account`, `ad-group`, `advertising-cost`, `ads-alerts`, `employee-ads-kpi` |
| Products | `product`, `product-category`, `supplier-quote` |
| Costs | `labor-cost1`, `other-cost`, `salary-config` |

Entry point: `app.module.ts` imports all feature modules.

### Frontend Structure (frontend/src/app/)

```
core/           # Singleton services, guards, interceptors
  services/     # auth.service.ts, theme.service.ts
  guards/       # auth.guard.ts, guest.guard.ts
features/       # Feature components (lazy-loaded)
shared/         # Shared components (sidebar)
app.routes.ts   # Route definitions with guards and permissions
```

**Routing Pattern**: Routes use `AuthGuard` with `data.permissions` array for role-based access.

### Authentication Flow

1. JWT-based auth with 4-hour expiry
2. Login: `POST /api/auth/login` returns JWT token
3. Token stored in `localStorage['access_token']`
4. All protected routes require `Authorization: Bearer <token>` header
5. Roles: `director`, `manager`, `employee`, `internal_agent`, `external_agent`, `internal_supplier`, `external_supplier`

### Database Connection

MongoDB URI configured via `MONGODB_URI` environment variable. Fallback to Atlas cluster in `app.module.ts`.

### Environment Variables

Required in `backend/.env` (copy from `.env.example`):
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing key
- `PORT` - API port (default 3000)
- `CORS_ORIGINS` - Allowed frontend origins

Optional (for external integrations):
- `FB_ADS_ACCESS_TOKEN` - Facebook Marketing API
- `GOOGLE_ADS_*` - Google Ads API credentials
- `TIKTOK_*` - TikTok Ads API

### Key Business Concepts

- **TestOrder2**: Main order entity with profit tracking, linked to ad groups
- **Ad Groups**: Marketing campaigns with budget/ROI tracking across platforms
- **Financial Control**: CFO dashboard with cashflow forecasting, survival floor calculation
- **Supplier Payable / Agent Receivable**: Track vendor payments and agent commissions

### API Patterns

All APIs follow REST conventions with `/api` prefix:
- `GET /api/{resource}` - List
- `POST /api/{resource}` - Create
- `GET /api/{resource}/:id` - Get one
- `PATCH /api/{resource}/:id` - Update
- `DELETE /api/{resource}/:id` - Delete

Health check: `GET /health` (no auth required)

### Financial Control Formulas (CFO Spec)

```
FreeCash = BankBalance - CommittedCash(14D)
SurvivalFloor = 3 × MonthlyBurn
AvailableAfterSurvival = max(0, FreeCash - SurvivalFloor)
AdsBudgetApproved = min(OptimalAdsSuggestion, AvailableAfterSurvival)
OwnerWithdrawable = max(0, AvailableAfterSurvival - AdsBudgetApproved)
```

Ad group budget caps: +20% increase / -30% decrease per day vs baseline.

### Key Field Mapping Notes

- User field is `role` (not `userType`), `fullName` (not `name`)
- Login response returns `user.id` (not `user._id`)
- Return resolve uses `items[].decision` (not `resolution`)
- Withdrawal approve uses `approvedBy` (MongoId, not `approverNotes`)
- Loan repayment uses `amountPrincipal` + `amountInterest` (not `amount` + `principalPortion`)
- Pending order approve requires `adGroupId`
- Ad group create requires `fanpageId` (create fanpage first)
- Employee KPI: wildcard routes `@Get(':employeeId')` must be at end of controller
