# CFO Spec v2.0: Agent Payment Workflow

## Order Lifecycle → Payment Eligibility

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Order Creation                                             │
│                                                                     │
│  User creates order → OrderStatus = "Chưa có mã vận đơn"          │
│  agentPaymentStatus = null                                         │
│  agentEligibleAt = null                                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Order Completion (TRIGGER)                                 │
│                                                                     │
│  OrderStatus changes to:                                            │
│    - "Giao thành công" (DELIVERED)                                │
│    - "Hàng hoàn" (RETURNED)                                        │
│                                                                     │
│  ▶ handleOrderStatusChange() executes:                             │
│    ✓ Check if external agent                                       │
│    ✓ Set agentEligibleAt = new Date()                             │
│    ✓ Calculate commission:                                         │
│       - DELIVERED: COD - agentQuote×qty - shipping                │
│       - RETURNED: 0 - agentQuote×qty - shipping - returnFee       │
│    ✓ Set agentCommissionFinal = commission (SNAPSHOT)             │
│    ✓ Set agentPaymentStatus = PENDING                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Finance Review (Ops Summary)                               │
│                                                                     │
│  GET /api/test-order2/agent-payment/ops-summary                    │
│                                                                     │
│  Aging calculation uses agentEligibleAt:                           │
│    days = today - agentEligibleAt                                  │
│    ├─ 0-7 days → Normal                                           │
│    ├─ 8-14 days → Warning                                         │
│    └─ 15+ days → Danger                                           │
│                                                                     │
│  Breakdown by agent:                                               │
│    - Pending payable amount                                        │
│    - Clawback outstanding                                          │
│    - Net amount                                                    │
│    - Flag if > 5M threshold                                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Payment Batch Creation                                     │
│                                                                     │
│  Frontend:                                                          │
│   ├─ User selects pending orders                                  │
│   ├─ Calculate selectedTotal                                       │
│   │                                                                 │
│   ├─ IF selectedTotal < 0:                                         │
│   │   └─ 🚫 BLOCK: Show red alert, prevent batch creation        │
│   │                                                                 │
│   ├─ IF selectedTotal > 5M:                                        │
│   │   ├─ Show yellow warning banner                              │
│   │   ├─ Modal requires checkbox confirm                         │
│   │   ├─ Validate attachments exist                              │
│   │   └─ Send: confirmOverThreshold=true, confirmedBy=userId     │
│   │                                                                 │
│   └─ ELSE (normal <5M):                                           │
│       └─ Standard flow, no extra requirements                     │
│                                                                     │
│  Backend API:                                                       │
│   POST /api/test-order2/agent-payment-batch/atomic                │
│   ├─ Calculate total from orderIds                                │
│   ├─ IF total > 5M:                                                │
│   │   ├─ Check confirmOverThreshold === true                      │
│   │   ├─ Check attachments.length > 0                            │
│   │   ├─ Check confirmedBy exists                                │
│   │   └─ If any fail → throw error                               │
│   │                                                                 │
│   ├─ Atomic update with conditions:                               │
│   │   WHERE:                                                       │
│   │     - _id IN orderIds                                         │
│   │     - agentPaymentStatus = PENDING                            │
│   │     - agentPaymentBatchId NOT EXISTS ← CHỐNG DOUBLE-PAY      │
│   │   SET:                                                         │
│   │     - agentPaymentStatus = PAID                               │
│   │     - agentPaymentBatchId = batchId                           │
│   │     - agentPaidAt = paidDate                                  │
│   │     - agentPaymentNote = note                                 │
│   │     - agentPaymentAttachments = attachments                   │
│   │     - (if >5M) confirmOverThreshold = true                    │
│   │     - (if >5M) confirmedBy = userId                           │
│   │     - (if >5M) confirmedAt = paidDate                         │
│   │                                                                 │
│   └─ Return: orderCount, totalPayable, totalClawback, netAmount  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Audit & Reporting                                          │
│                                                                     │
│  All payments stored with:                                          │
│    - agentEligibleAt: When became eligible                         │
│    - agentCommissionFinal: Original commission (immutable)         │
│    - agentPaidAmount: Actual paid amount                           │
│    - agentPaymentBatchId: Batch reference                          │
│    - agentPaidAt: Payment date                                     │
│    - (if >5M) confirmOverThreshold, confirmedBy, confirmedAt       │
│    - agentPaymentAttachments: Proof of payment                     │
│                                                                     │
│  Reports can show:                                                  │
│    - Accurate aging (from eligibleAt, not updatedAt)              │
│    - Commission changes (compare final vs current)                 │
│    - Threshold payments (who approved, when, attachments)          │
│    - Audit trail for compliance                                    │
└─────────────────────────────────────────────────────────────────────┘
```

## Validation Rules Flow

```
User clicks "Tạo Phiếu Thanh Toán"
│
├─ Calculate selectedTotal
│
├─ IF selectedTotal < 0 (negative):
│   └─ 🚫 STOP: Alert "Không thể thanh toán tổng âm"
│       └─ Return early, do not open modal
│
├─ IF selectedTotal >= 0:
│   └─ Open modal
│       │
│       ├─ IF selectedTotal > 5,000,000:
│       │   └─ Show threshold warning section
│       │       ├─ Display alert box
│       │       ├─ Show mandatory checkbox
│       │       └─ Validate on submit:
│       │           ├─ Check confirmOverThreshold = true
│       │           └─ Check attachments not empty
│       │
│       └─ ELSE (normal amount):
│           └─ Standard modal, no extra requirements
│
└─ User clicks "Xác Nhận Thanh Toán"
    │
    ├─ Frontend validation:
    │   ├─ Check batchId and paidDate filled
    │   ├─ IF isOverThreshold:
    │   │   ├─ Check checkbox ticked
    │   │   └─ Check attachments present
    │   └─ IF validation fails → alert and return
    │
    └─ Call API: createPaymentBatchAtomic()
        │
        └─ Backend validation:
            ├─ Calculate total from orderIds
            ├─ IF total > 5M:
            │   ├─ Check confirmOverThreshold
            │   ├─ Check attachments.length > 0
            │   └─ Check confirmedBy
            │       └─ IF any fail → throw error
            │
            └─ Atomic update orders
                └─ Return result
```

## Data Flow Diagram

```
┌─────────────┐
│   Order     │  Status change → COMPLETED
│  Document   │
└──────┬──────┘
       │
       │ handleOrderStatusChange()
       ▼
┌─────────────────────────────────────┐
│  Auto-set Payment Fields            │
│  ┌───────────────────────────────┐  │
│  │ agentEligibleAt: Date         │  │ ← WHEN eligible
│  │ agentCommissionFinal: Number  │  │ ← ORIGINAL amount
│  │ agentPaymentStatus: PENDING   │  │ ← Payment state
│  └───────────────────────────────┘  │
└──────┬──────────────────────────────┘
       │
       │ Ops summary aggregation
       ▼
┌─────────────────────────────────────┐
│   Frontend: Ops Summary             │
│  ┌───────────────────────────────┐  │
│  │ Payable Pending              │  │ ← Aging from agentEligibleAt
│  │ Paid                          │  │
│  │ Clawback Outstanding          │  │
│  │ Aging Buckets (0-7, 8-14, 15+)│  │
│  │ Breakdown by Agent            │  │
│  │   - isOverThreshold flag      │  │ ← >5M indicator
│  └───────────────────────────────┘  │
└──────┬──────────────────────────────┘
       │
       │ User selects orders
       ▼
┌─────────────────────────────────────┐
│   Frontend: Validation              │
│  ┌───────────────────────────────┐  │
│  │ selectedTotal < 0?            │  │ → 🚫 BLOCK
│  │ selectedTotal > 5M?           │  │ → ⚠️ REQUIRE CONFIRM
│  │ else (normal)                 │  │ → ✅ ALLOW
│  └───────────────────────────────┘  │
└──────┬──────────────────────────────┘
       │
       │ API call with metadata
       ▼
┌─────────────────────────────────────┐
│   Backend: Atomic Update            │
│  ┌───────────────────────────────┐  │
│  │ WHERE:                        │  │
│  │   - status = PENDING          │  │
│  │   - batchId NOT EXISTS        │  │ ← IDEMPOTENCY
│  │                               │  │
│  │ SET:                          │  │
│  │   - status = PAID             │  │
│  │   - batchId, paidAt, etc.     │  │
│  │   - (if >5M) audit fields     │  │ ← confirmOverThreshold
│  └───────────────────────────────┘  │
└──────┬──────────────────────────────┘
       │
       │ Payment complete
       ▼
┌─────────────────────────────────────┐
│   Audit Trail                       │
│  ┌───────────────────────────────┐  │
│  │ All payments logged with:     │  │
│  │ - Original eligible date      │  │
│  │ - Commission snapshot         │  │
│  │ - Threshold approvals         │  │
│  │ - Attachments                 │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## UI/UX Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Tổng Hợp Vận Hành                                       │
│                                                             │
│  [Card: Payable]  [Card: Paid]  [Card: Clawback]          │
│  [Card: 0-7d]     [Card: 8-14d] [Card: 15+d]              │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 👥 Theo Đại Lý (Top 10) - CLICKABLE                       │
│                                                             │
│  Agent Name | Pending | Payable | Clawback | Net | Aging   │
│  ──────────────────────────────────────────────────────────│
│  ▶ Nguyễn Văn A  │  50 │ 12M │  2M  │ 10M │ ...           │ ← Click here
│    Trần Thị B    │  30 │  8M │  1M  │  7M │ ...           │
│                                                             │
│  (Click agent → filters pending orders below)              │
└─────────────────────────────────────────────────────────────┘
         │ [User clicks agent]
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 📋 Đơn Hàng Chờ Thanh Toán                                 │
│                                                             │
│  [Filtered by: Nguyễn Văn A]                               │
│                                                             │
│  [ ] Order 1 | Customer | ... | 500,000 đ                  │
│  [ ] Order 2 | Customer | ... | 800,000 đ                  │
│  [✓] Order 3 | Customer | ... | 1,200,000 đ ← Selected     │
│  [✓] Order 4 | Customer | ... | 3,500,000 đ ← Selected     │
│                                                             │
│  Selected: 2 orders | Total: 4,700,000 đ                   │
│  [Tạo Phiếu Thanh Toán]                                    │
└─────────────────────────────────────────────────────────────┘
         │ [User clicks button]
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 💵 Modal: Tạo Phiếu Thanh Toán                             │
│                                                             │
│  Tạo phiếu cho 2 đơn, tổng: 4,700,000 đ                    │
│                                                             │
│  Mã phiếu: [PTTT-AGENT-2026-02-001]                        │
│  Ngày TT: [2026-02-03]                                     │
│  Ghi chú: [___________________________]                    │
│  Chứng từ: [https://drive.google.com/...]                  │
│                                                             │
│  (Normal flow - no threshold alert)                        │
│                                                             │
│  [Hủy]  [✅ Xác Nhận Thanh Toán]                           │
└─────────────────────────────────────────────────────────────┘

         BUT if total > 5M...

┌─────────────────────────────────────────────────────────────┐
│ 💵 Modal: Tạo Phiếu Thanh Toán                             │
│                                                             │
│  Tạo phiếu cho 5 đơn, tổng: 12,500,000 đ                   │
│                                                             │
│  Mã phiếu: [PTTT-AGENT-2026-02-002]                        │
│  Ngày TT: [2026-02-03]                                     │
│  Ghi chú: [___________________________]                    │
│  Chứng từ: [https://drive.google.com/...]                  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ ⚠️ Thanh toán vượt ngưỡng 5,000,000 đ               │ │
│  │ Bạn phải xác nhận và đính kèm chứng từ để tiếp tục  │ │
│  │                                                       │ │
│  │ [✓] Tôi xác nhận thanh toán vượt ngưỡng và đã đính │ │
│  │     kèm chứng từ đầy đủ                             │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [Hủy]  [✅ Xác Nhận Thanh Toán] ← Disabled until checked  │
└─────────────────────────────────────────────────────────────┘

         AND if total < 0...

┌─────────────────────────────────────────────────────────────┐
│ 📋 Đơn Hàng Chờ Thanh Toán                                 │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 🚫 KHÔNG THỂ THANH TOÁN                               │ │
│  │ Tổng hoa hồng âm: -2,500,000 đ (đại lý nợ công ty)  │ │
│  │ Vui lòng tách riêng các đơn hoàn để theo dõi công nợ │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [✓] Order 1 (Returned) | ... | -1,200,000 đ              │
│  [✓] Order 2 (Returned) | ... | -1,300,000 đ              │
│                                                             │
│  Selected: 2 orders | Total: -2,500,000 đ                  │
│  [Tạo Phiếu Thanh Toán] ← DISABLED                         │
└─────────────────────────────────────────────────────────────┘
```

---

**End of Workflow Documentation**
