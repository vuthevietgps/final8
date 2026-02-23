# PHÂN TÁCH RÕ RÀNG: DÒNG TIỀN vs HIỆU QUẢ KINH DOANH

## 🎯 Mục Tiêu
Tách biệt 2 góc độ quan trọng trong quản lý tài chính:
1. **DÒNG TIỀN (Cash Flow)** - Tiền có thật, tiền ra vào
2. **HIỆU QUẢ KINH DOANH (Business Performance)** - Lợi nhuận, phân bổ, hiệu quả

---

## 📊 DÒNG TIỀN (Cash Flow Tracking)

### Mục Đích
Theo dõi tiền MẶT THỰC TẾ có thể chi tiêu

### Câu Hỏi Giải Đáp
"Có bao nhiêu tiền CÓ THỂ chi ngay bây giờ?"

### Metrics

| Metric | Công Thức | Ý Nghĩa |
|--------|-----------|---------|
| **Bank Balance** | Vốn vay + Doanh thu - (Lương + Vận hành + Đại lý + Owner đã rút + Ads đã chi) | Tiền CÓ THẬT trong tài khoản |
| **Committed Cash** | Lương chưa trả + NCC chưa trả + Đại lý chưa trả | Nợ SẮP PHẢI TRẢ |
| **Free Cash Flow** | Bank Balance - Committed Cash | Tiền CÓ THỂ dùng ngay |

### Ví Dụ

```
Bank Balance: 151,275,000đ
Committed Cash: 0đ
─────────────────────────────
Free Cash Flow: 151,275,000đ ✅
```

**Giải thích**: Toàn bộ 151M đều CÓ THỂ chi tiêu vì không có nợ phải trả.

---

## 💼 HIỆU QUẢ KINH DOANH (Business Performance)

### Mục Đích
Theo dõi PHÂN BỔ và SỬ DỤNG tiền

### Câu Hỏi Giải Đáp
"Tiền được dùng vào đâu? Còn bao nhiêu chưa phân bổ?"

### Metrics

| Metric | Công Thức | Ý Nghĩa |
|--------|-----------|---------|
| **Allocated Cash** | Ads Fund + Reserve Fund + Owner Fund | Tiền đã "gắn nhãn" cho mục đích |
| **Unallocated Cash** | Free Cash Flow - Allocated Cash | Tiền chưa quyết định làm gì |

### Breakdown

```
Free Cash Flow: 151,275,000đ
├─ Allocated Cash: 69,193,000đ
│  ├─ Ads Fund: 68,661,000đ (cho quảng cáo)
│  ├─ Reserve Fund: 516,000đ (dự phòng)
│  └─ Owner Fund: 516,000đ (thuộc owner, chưa rút)
└─ Unallocated: 82,082,000đ ✅ (hoàn toàn tự do)
```

**Giải thích**:
- Trong 151M tiền khả dụng:
  - 69M đã CÓ MỤC ĐÍCH (ads, dự phòng, owner)
  - 82M CHƯA CÓ MỤC ĐÍCH (có thể phân bổ tùy ý)

---

## 🔑 ĐIỂM KHÁC BIỆT QUAN TRỌNG

### ❌ SAI LẦM CŨ
"Trừ tất cả các quỹ khỏi Free Cash"

```typescript
// ❌ SAI
Free Cash = Bank - (Committed + Ads + Reserve + Owner)
= 151M - (0 + 68M + 0.5M + 0.5M)
= 82M
```

**Vấn đề**: 
- Ads Fund (68M) là tiền "DỰ ĐỊNH" cho ads, CHƯA CHI thực tế
- Owner Fund (0.5M) là tiền "thuộc owner", CHƯA RÚT ra
- Cả 2 vẫn NẰM TRONG tài khoản → vẫn CÓ THỂ dùng!

### ✅ ĐÚNG MỚI
"Phân tầng rõ ràng: Cash Flow vs Business"

```typescript
// ✅ DÒNG TIỀN
Free Cash Flow = Bank - Committed
= 151M - 0 = 151M (tiền CÓ THỂ dùng)

// ✅ HIỆU QUẢ KINH DOANH
Allocated = 69M (đã có mục đích)
Unallocated = 82M (chưa có mục đích)
```

**Lợi ích**:
- Dòng tiền: Biết có bao nhiêu tiền thực tế
- Kinh doanh: Biết tiền được phân bổ ra sao

---

## 📋 SỬ DỤNG TRONG THỰC TẾ

### Case 1: Muốn Chi Tiêu Khẩn Cấp
**Câu hỏi**: "Cần 10M gấp, có đủ không?"

```
→ Xem Free Cash Flow: 151M ✅ Đủ!
```

### Case 2: Muốn Tăng Ngân Sách Ads
**Câu hỏi**: "Muốn tăng ads thêm 20M, lấy từ đâu?"

```
→ Xem Unallocated Cash: 82M ✅
→ Có thể phân bổ thêm 20M cho Ads Fund
```

### Case 3: Owner Muốn Rút Tiền
**Câu hỏi**: "Owner muốn rút 5M, có được không?"

```
→ Xem Free Cash Flow: 151M ✅ Có thể rút!
→ Owner Fund hiện có: 0.5M (chưa đủ)
→ Có thể phân bổ thêm 4.5M từ Unallocated (82M)
```

---

## 💻 API Response Structure

```json
{
  "cashFlow": {
    "bankBalance": 151275000,
    "committedCash": 0,
    "freeCash": 151275000
  },
  "businessPerformance": {
    "allocatedCash": 69193000,
    "unallocatedCash": 82082000,
    "breakdown": {
      "adsFund": 68661000,
      "reserveFund": 516000,
      "ownerFund": 516000
    }
  }
}
```

---

## 🎯 KẾT LUẬN

| Góc Độ | Mục Đích | Metric Chính |
|--------|----------|--------------|
| **DÒNG TIỀN** | Quản lý khả năng thanh toán | Free Cash Flow |
| **KINH DOANH** | Quản lý phân bổ & hiệu quả | Allocated/Unallocated |

**Nguyên tắc vàng**:
- ❌ Không trừ "allocated funds" khỏi Free Cash
- ✅ Chỉ trừ "committed liabilities" (nợ phải trả)
- ✅ Hiển thị allocation như "phân loại" của Free Cash
