/**
 * FUNDS INTERFACES - TypeScript interfaces cho quản lý quỹ theo Spec chuẩn
 * ==================================================
 * 
 * 4 QUỸ CỐT LÕI:
 * 1. QUỸ ĐẶT CHỖ (Committed Cash) - Tiền đã có CHỦ nhưng CHƯA chi
 * 2. QUỸ ADS (Growth Capital) - Nguồn duy nhất được phép chạy ads
 * 3. QUỸ DỰ PHÒNG (Survival Buffer) - Đệm chống sốc hệ thống
 * 4. QUỸ OWNER (Thu nhập) - Tiền thực sự thuộc về chủ
 */

/**
 * 5 Lớp dữ liệu của mỗi quỹ
 */
export interface FundLayer {
  // 1. Flow (Hôm qua)
  flow: {
    yesterday: number;        // Số tiền tăng/giảm hôm qua
    reason?: string;          // Lý do tăng/giảm
  };
  
  // 2. Stock (Lũy kế)
  stock: {
    current: number;          // Số dư hiện tại
    asOf: Date;               // Thời điểm tính
  };
  
  // 3. Projection (7-15 ngày)
  projection: {
    days7: number;            // Ước tính sau 7 ngày
    days15: number;           // Ước tính sau 15 ngày
    trend: 'up' | 'down' | 'stable';
    dailyAverage: number;     // Trung bình ngày
  };
  
  // 4. Threshold (Ngưỡng)
  threshold: {
    min: number;              // Ngưỡng tối thiểu
    max: number;              // Ngưỡng tối đa
    status: 'safe' | 'warning' | 'danger';
    daysUntilMin?: number;    // Số ngày đến ngưỡng min
  };
  
  // 5. Permission (Quyền)
  permission: {
    canUse: boolean;          // Có được dùng không
    allowedFor: string[];     // Dùng cho việc gì
    blockedFor: string[];     // Không được dùng cho việc gì
    approvalRequired: boolean; // Cần duyệt không
  };
}

/**
 * Quỹ Đặt Chỗ (Committed Cash)
 */
export interface CommittedCashFund extends FundLayer {
  breakdown: {
    unpaidLaborCost: number;      // Lương chưa trả
    unpaidOtherCost: number;      // Chi phí vận hành chưa thanh toán
    unpaidAgentCommission: number; // Hoa hồng đại lý chưa trả
  };
}

/**
 * Quỹ Ads (Growth Capital)
 */
export interface AdsFund extends FundLayer {
  breakdown: {
    fromInitialCapital: number;   // 45% vốn ban đầu
    fromReinvestment: number;     // 45% lợi nhuận tái đầu tư
    adsSpent: number;             // Đã chi ads
    remaining: number;            // Còn lại
  };
  dailyBudget: {
    suggested: number;            // Budget đề xuất/ngày
    actual: number;               // Budget thực tế/ngày
    daysRemaining: number;        // Số ngày có thể chạy
  };
}

/**
 * Quỹ Dự Phòng (Survival Buffer)
 */
export interface SurvivalBufferFund extends FundLayer {
  breakdown: {
    fromProfit: number;           // 20% lợi nhuận thuần
    used: number;                 // Đã sử dụng (emergency)
    remaining: number;            // Còn lại
  };
  survivalDays: number;           // Số ngày sống sót nếu dừng ads
}

/**
 * Quỹ Owner (Thu nhập)
 */
export interface OwnerFund extends FundLayer {
  breakdown: {
    fromProfit: number;           // 20% lợi nhuận thuần
    withdrawn: number;            // Đã rút
    retained: number;             // Giữ lại
  };
}

/**
 * Kết quả tổng quan các quỹ
 */
export interface FundsOverview {
  // Doanh thu (Net Revenue)
  revenue: {
    total: number;                // Tổng doanh thu = COD thành công - tiền nhập hàng
    realized: number;             // Đã nhận từ NCC
    pending: number;              // Đang chờ NCC thanh toán
    orderCount: number;           // Số đơn
  };
  
  // Vốn ban đầu (Seed Capital) - NGUỒN, không phải quỹ
  seedCapital: {
    total: number;                // Tổng vốn vay/cá nhân
    allocated: number;            // Đã phân bổ
    remaining: number;            // Còn lại
  };
  
  // 4 Quỹ cốt lõi
  committedCash: CommittedCashFund;   // Quỹ Đặt Chỗ
  adsFund: AdsFund;                   // Quỹ Ads
  survivalBuffer: SurvivalBufferFund; // Quỹ Dự Phòng
  ownerFund: OwnerFund;               // Quỹ Owner
  
  // Lợi nhuận thuần (để phân bổ)
  netProfit: {
    realized: number;             // Lợi nhuận thuần đã thực hiện
    pending: number;              // Lợi nhuận thuần đang chờ
    total: number;                // Tổng
  };
  
  // Công thức kiểm tra
  validation: {
    bankBalance: number;          // Tổng tiền ngân hàng (nếu có)
    totalFunds: number;           // Tổng các quỹ
    difference: number;           // Chênh lệch (phải ≈ 0)
    isValid: boolean;             // Hệ thống có đúng không
  };
  
  // Công thức cốt lõi
  formulas: {
    tienTuDo: number;             // TienTuDo = TongTienNganHang – QuyDatCho
    adsBudgetAllowed: number;     // AdsBudgetAllowed = min(QuyAds, TienTuDo)
  };
  
  calculatedAt: Date;
}
