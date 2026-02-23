# 🔄 Điều Chỉnh Thuật Ngữ - Làm Rõ Mô Hình Kinh Doanh

## 📋 Checklist Thay Đổi

### Phase 1: Frontend UI (Ưu tiên cao) ⚡
- [ ] 1.1 Sidebar navigation labels
- [ ] 1.2 Component titles & descriptions  
- [ ] 1.3 Table column headers
- [ ] 1.4 Button texts
- [ ] 1.5 Tooltips & help text

### Phase 2: Routing (Tương thích ngược) 🔗
- [ ] 2.1 Keep old routes working
- [ ] 2.2 Add new routes (optional)
- [ ] 2.3 Redirect old to new (optional)

### Phase 3: Backend (Comment only) 📝
- [ ] 3.1 Add clarification comments
- [ ] 3.2 Keep technical names unchanged
- [ ] 3.3 Update API documentation

### Phase 4: Documentation 📚
- [ ] 4.1 Update README
- [ ] 4.2 Create business model guide
- [ ] 4.3 User training materials

---

## 🎯 Phase 1: Frontend UI Changes

### 1.1 Sidebar Navigation

**File**: `frontend/src/app/shared/sidebar/sidebar.component.ts`

```typescript
// BEFORE (❌ Gây nhầm lẫn)
{
  title: "Nhà Cung Cấp",
  items: [
    { icon: "👤", label: "Danh Sách NCC", route: "/suppliers" },
    { icon: "💳", label: "Công nợ NCC", route: "/suppliers/payables" }
  ]
}

// AFTER (✅ Rõ ràng)
{
  title: "Nhà Cung Cấp",
  items: [
    { icon: "👤", label: "Danh Sách NCC", route: "/suppliers" },
    { 
      icon: "📦", 
      label: "Thanh Toán NCC", 
      route: "/suppliers/payables",
      tooltip: "Đối soát và thanh toán với NCC (NCC thu COD và trả về)"
    }
  ]
}
```

```typescript
// BEFORE (❌ Không rõ)
{
  title: "Đại Lý",
  items: [
    { icon: "👥", label: "Danh Sách Đại Lý", route: "/agents" },
    { icon: "💳", label: "Công nợ Đại Lý", route: "/agents/receivables" }
  ]
}

// AFTER (✅ Rõ ràng)
{
  title: "Đại Lý",
  items: [
    { icon: "👥", label: "Danh Sách Đại Lý", route: "/agents" },
    { 
      icon: "💰", 
      label: "Hoa Hồng Đại Lý", 
      route: "/agents/receivables",
      tooltip: "Quản lý hoa hồng phải trả cho đại lý"
    }
  ]
}
```

### 1.2 Component Titles & Descriptions

#### Supplier Payable Component

**File**: `frontend/src/app/features/supplier-payable/supplier-payable.component.html`

```html
<!-- BEFORE -->
<div class="page-header">
  <h1>🏢 Công Nợ Nhà Cung Cấp</h1>
</div>

<!-- AFTER -->
<div class="page-header">
  <h1>📦 Thanh Toán Nhà Cung Cấp</h1>
  <p class="page-description">
    Quản lý đối soát và thanh toán với nhà cung cấp. 
    <span class="help-text">
      💡 NCC thu COD từ khách hàng và chuyển về doanh thu thuần theo chu kỳ 10 ngày.
    </span>
  </p>
</div>
```

#### Agent Receivable Component

**File**: `frontend/src/app/features/agent-receivable/agent-receivable.component.html`

```html
<!-- BEFORE -->
<div class="page-header">
  <h1>👥 Công Nợ Đại Lý</h1>
</div>

<!-- AFTER -->
<div class="page-header">
  <h1>💰 Hoa Hồng Đại Lý</h1>
  <p class="page-description">
    Quản lý hoa hồng phải trả cho đại lý.
    <span class="help-text">
      💡 Hoa hồng được tính từ doanh thu thuần và thanh toán sau khi nhận tiền từ NCC.
    </span>
  </p>
</div>
```

### 1.3 Table Column Headers

#### Supplier Statement Table

```typescript
// BEFORE
columns = [
  { key: 'periodFrom', label: 'Từ ngày' },
  { key: 'periodTo', label: 'Đến ngày' },
  { key: 'openingBalance', label: 'Số dư đầu' },
  { key: 'periodPayables', label: 'Phát sinh' },
  { key: 'periodCodCollected', label: 'COD thu' },
  { key: 'netAfterCod', label: 'Trả về' },
  { key: 'statementPaymentTotal', label: 'Đã nhận' },
  { key: 'closingBalance', label: 'Còn lại' }
];

// AFTER (✅ Thêm tooltip)
columns = [
  { key: 'periodFrom', label: 'Từ ngày', tooltip: 'Đầu kỳ đối soát' },
  { key: 'periodTo', label: 'Đến ngày', tooltip: 'Cuối kỳ đối soát' },
  { key: 'periodCodCollected', label: 'COD NCC thu', tooltip: 'Tổng COD NCC thu từ khách' },
  { key: 'periodPayables', label: 'Chi phí hàng', tooltip: 'Chi phí hàng + phí ship' },
  { 
    key: 'netAfterCod', 
    label: '💰 Doanh thu thuần', 
    tooltip: 'Số tiền NCC sẽ trả = COD - Chi phí',
    highlight: true 
  },
  { key: 'statementPaymentTotal', label: 'NCC đã trả', tooltip: 'Số tiền đã nhận từ NCC' },
  { key: 'closingBalance', label: 'NCC còn nợ', tooltip: 'Số tiền NCC chưa trả' }
];
```

#### Agent Statement Table

```typescript
// BEFORE
columns = [
  { key: 'periodFrom', label: 'Từ ngày' },
  { key: 'periodTo', label: 'Đến ngày' },
  { key: 'periodReceivables', label: 'Phát sinh' },
  { key: 'statementPaymentTotal', label: 'Đã trả' },
  { key: 'closingBalance', label: 'Còn phải trả' }
];

// AFTER
columns = [
  { key: 'periodFrom', label: 'Từ ngày', tooltip: 'Đầu kỳ đối soát' },
  { key: 'periodTo', label: 'Đến ngày', tooltip: 'Cuối kỳ đối soát' },
  { 
    key: 'periodReceivables', 
    label: '💰 Hoa hồng phát sinh', 
    tooltip: 'Hoa hồng từ các đơn trong kỳ',
    highlight: true 
  },
  { key: 'statementPaymentTotal', label: 'Đã thanh toán', tooltip: 'Hoa hồng đã trả agent' },
  { key: 'closingBalance', label: 'Còn phải trả', tooltip: 'Hoa hồng chưa trả agent' }
];
```

### 1.4 Button Texts

```typescript
// Supplier Statement Actions
buttons = {
  payment: {
    // BEFORE
    text: '💰 Thanh toán',
    
    // AFTER  
    text: '✅ Ghi nhận đã nhận',
    tooltip: 'Ghi nhận đã nhận tiền từ NCC'
  },
  close: {
    text: '🔒 Chốt kỳ',
    tooltip: 'Chốt kỳ đối soát (không thể sửa)'
  },
  pdf: {
    text: '📄 Biên bản',
    tooltip: 'In biên bản đối soát'
  }
};

// Agent Statement Actions  
buttons = {
  payment: {
    // BEFORE
    text: '💰 Thanh toán',
    
    // AFTER
    text: '💸 Trả hoa hồng',
    tooltip: 'Thanh toán hoa hồng cho agent'
  },
  close: {
    text: '🔒 Chốt kỳ',
    tooltip: 'Chốt kỳ thanh toán (không thể sửa)'
  }
};
```

### 1.5 Form Labels & Placeholders

#### Supplier Payment Modal

```html
<!-- BEFORE -->
<div class="modal-header">
  <h2>💰 Thanh Toán</h2>
</div>

<!-- AFTER -->
<div class="modal-header">
  <h2>✅ Ghi Nhận Đã Nhận Tiền Từ NCC</h2>
  <p class="modal-description">
    Ghi nhận số tiền đã nhận từ nhà cung cấp trong kỳ này
  </p>
</div>

<form>
  <!-- BEFORE -->
  <label>Số tiền thanh toán</label>
  
  <!-- AFTER -->
  <label>
    Số tiền đã nhận
    <span class="help-icon" title="Số tiền NCC đã chuyển khoản cho bạn">?</span>
  </label>
  <input type="number" placeholder="Ví dụ: 2500000" />
</form>
```

#### Agent Payment Modal

```html
<!-- BEFORE -->
<div class="modal-header">
  <h2>💰 Thanh Toán</h2>
</div>

<!-- AFTER -->
<div class="modal-header">
  <h2>💸 Thanh Toán Hoa Hồng Cho Agent</h2>
  <p class="modal-description">
    Thanh toán hoa hồng cho đại lý trong kỳ này
  </p>
</div>

<form>
  <label>
    Số tiền thanh toán
    <span class="help-icon" title="Số tiền hoa hồng trả cho agent">?</span>
  </label>
  <input type="number" placeholder="Ví dụ: 125000" />
</form>
```

---

## 🔗 Phase 2: Routing (Optional)

### Option A: Keep Old Routes (Khuyến nghị)
```typescript
// Không thay đổi route, chỉ đổi label
// ✅ Tương thích ngược
// ✅ Không break existing links
// ✅ Không cần migration

{
  path: 'suppliers/payables',  // Route giữ nguyên
  component: SupplierPayableComponent,
  data: { title: 'Thanh Toán NCC' }  // Chỉ đổi title
}
```

### Option B: Add New Routes + Redirect
```typescript
// Thêm route mới, redirect từ cũ
// ⚠️ Cần test kỹ
// ⚠️ Có thể ảnh hưởng SEO/bookmarks

// New routes
{
  path: 'suppliers/settlements',
  component: SupplierPayableComponent
},
{
  path: 'agents/commissions',
  component: AgentReceivableComponent
},

// Redirects (backward compatibility)
{
  path: 'suppliers/payables',
  redirectTo: 'suppliers/settlements',
  pathMatch: 'full'
},
{
  path: 'agents/receivables',
  redirectTo: 'agents/commissions',
  pathMatch: 'full'
}
```

**Khuyến nghị**: Dùng Option A (chỉ đổi labels, giữ routes)

---

## 📝 Phase 3: Backend Comments

### Supplier Module

**File**: `backend/src/supplier-payable/schemas/supplier-statement.schema.ts`

```typescript
/**
 * SupplierStatement - Kỳ đối soát thanh toán với nhà cung cấp
 * 
 * MÔ HÌNH DROPSHIPPING COD:
 * =========================
 * 1. NCC thu COD từ khách hàng (giữ tiền)
 * 2. Chu kỳ 10 ngày đối soát 1 lần
 * 3. NCC trả về: COD thu - Chi phí hàng = Doanh thu thuần
 * 
 * KHÔNG PHẢI công nợ truyền thống!
 * User không vay/mua chịu từ NCC.
 * NCC là người THU TIỀN HỘ và THANH TOÁN định kỳ.
 * 
 * VÍ DỤ:
 * ------
 * COD NCC thu: 10,000,000 đ
 * Chi phí hàng:  7,500,000 đ
 * ─────────────────────────
 * NCC trả về:    2,500,000 đ (= doanh thu thuần)
 */
@Schema({ timestamps: true })
export class SupplierStatement {
  @Prop({ type: Number, default: 0 })
  periodCodCollected!: number;  // COD mà NCC thu được
  
  @Prop({ type: Number, default: 0 })
  periodPayables!: number;  // Chi phí hàng + phí ship
  
  @Prop({ type: Number, default: 0 })
  netAfterCod!: number;  // ✅ DOANH THU THUẦN = COD - Chi phí
  
  @Prop({ type: Number, default: 0 })
  statementPaymentTotal!: number;  // NCC đã trả về
  
  @Prop({ type: Number, default: 0 })
  closingBalance!: number;  // NCC còn giữ (chưa trả)
}
```

### Agent Module

**File**: `backend/src/agent-receivable/schemas/agent-statement.schema.ts`

```typescript
/**
 * AgentStatement - Kỳ thanh toán hoa hồng cho đại lý
 * 
 * MÔ HÌNH HOA HỒNG:
 * =================
 * 1. Agent tạo đơn hàng cho user
 * 2. User nhận doanh thu thuần từ NCC
 * 3. User PHẢI TRẢ hoa hồng cho agent
 * 
 * Tên collection "agent-receivable" từ góc nhìn của agent
 * (Agent nhận tiền = User trả tiền)
 * 
 * VÍ DỤ:
 * ------
 * Doanh thu thuần: 2,500,000 đ
 * Hoa hồng 5%:       125,000 đ
 * 
 * LUỒNG TIỀN:
 * Day 10: NCC trả user 2,500,000 đ
 * Day 11: User trả agent 125,000 đ
 * Day 12: User phân bổ 2,375,000 đ vào quỹ
 */
@Schema({ timestamps: true })
export class AgentStatement {
  @Prop({ type: Number, default: 0 })
  periodReceivables!: number;  // ✅ HOA HỒNG phát sinh
  
  @Prop({ type: Number, default: 0 })
  statementPaymentTotal!: number;  // User đã trả agent
  
  @Prop({ type: Number, default: 0 })
  closingBalance!: number;  // User còn nợ agent
}
```

---

## 📚 Phase 4: Documentation

### 4.1 README Section

Thêm vào `README.md`:

```markdown
## 💰 Mô Hình Kinh Doanh

### Dropshipping với COD
- **Nhà cung cấp**: Thu COD từ khách, chuyển về doanh thu thuần
- **Đại lý**: Nhận hoa hồng từ doanh thu thuần
- **Chu kỳ**: 10 ngày thanh toán 1 lần

### Luồng Tiền
```
Khách → COD → NCC (giữ tiền)
            ↓ (10 ngày)
      Doanh thu thuần → User
            ↓
      Hoa hồng → Agent
            ↓
      Phân bổ quỹ
```

Xem chi tiết: [docs/BUSINESS-MODEL-CLARIFICATION.md](docs/BUSINESS-MODEL-CLARIFICATION.md)
```

### 4.2 User Guide

Tạo file `docs/USER-GUIDE-SETTLEMENTS.md`:

```markdown
# 📘 Hướng Dẫn Sử Dụng - Thanh Toán & Hoa Hồng

## 1. Thanh Toán Nhà Cung Cấp

### Khi nào sử dụng?
- Mỗi 10 ngày đối soát với NCC 1 lần
- Sau khi NCC chuyển tiền vào tài khoản

### Các bước:
1. Vào menu "📦 Thanh Toán NCC"
2. Chọn nhà cung cấp và kỳ đối soát
3. Xem "Doanh thu thuần" = COD - Chi phí
4. Click "✅ Ghi nhận đã nhận" khi nhận tiền
5. Nhập số tiền thực tế nhận được
6. Upload chứng từ (screenshot chuyển khoản)
7. Click "🔒 Chốt kỳ" sau khi xác nhận

## 2. Hoa Hồng Đại Lý

### Khi nào sử dụng?
- Sau khi đã nhận tiền từ NCC
- Trước khi phân bổ vào quỹ

### Các bước:
1. Vào menu "💰 Hoa Hồng Đại Lý"
2. Chọn đại lý và kỳ thanh toán
3. Xem "Hoa hồng phát sinh"
4. Click "💸 Trả hoa hồng"
5. Nhập số tiền thanh toán
6. Upload chứng từ
7. Click "🔒 Chốt kỳ"
```

---

## 🎨 CSS/Styling Changes

```css
/* Highlight important columns */
.highlight-column {
  background-color: #fff3cd;
  font-weight: 600;
  color: #856404;
}

/* Help text */
.page-description {
  color: #666;
  font-size: 14px;
  margin-top: 8px;
  line-height: 1.6;
}

.help-text {
  display: inline-block;
  padding: 4px 8px;
  background: #e8f4fd;
  border-radius: 4px;
  font-size: 13px;
  color: #004085;
}

/* Tooltips */
.help-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  background: #007bff;
  color: white;
  border-radius: 50%;
  text-align: center;
  line-height: 16px;
  font-size: 11px;
  cursor: help;
  margin-left: 4px;
}

/* Modal descriptions */
.modal-description {
  color: #666;
  font-size: 13px;
  margin-top: 4px;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-left: 3px solid #007bff;
  border-radius: 4px;
}
```

---

## ✅ Implementation Plan

### Week 1: Frontend UI (High Priority)
- [ ] Day 1: Update sidebar labels + tooltips
- [ ] Day 2: Update component titles + descriptions
- [ ] Day 3: Update table headers + tooltips
- [ ] Day 4: Update button texts + modals
- [ ] Day 5: Add CSS styles + test

### Week 2: Documentation
- [ ] Day 1: Add backend comments
- [ ] Day 2: Update README
- [ ] Day 3: Create user guide
- [ ] Day 4: Create business model doc (done ✅)
- [ ] Day 5: Review & finalize

### Week 3: Testing & Rollout
- [ ] Day 1-2: QA testing
- [ ] Day 3: User training
- [ ] Day 4: Deploy to production
- [ ] Day 5: Monitor & collect feedback

---

## 🚨 Important Notes

### Tương thích ngược:
- ✅ Technical names (schema, API) giữ nguyên
- ✅ Routes giữ nguyên
- ✅ Database không cần migration
- ✅ Chỉ thay đổi UI labels

### Rủi ro:
- ⚠️ User cần làm quen với thuật ngữ mới
- ⚠️ Training materials cần update
- ⚠️ Cần thông báo trước cho users

### Lợi ích:
- ✅ Rõ ràng hơn nhiều
- ✅ Phản ánh đúng mô hình kinh doanh
- ✅ Giảm nhầm lẫn
- ✅ Dễ training nhân viên mới
