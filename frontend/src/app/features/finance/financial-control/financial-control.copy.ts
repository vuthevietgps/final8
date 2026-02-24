/**
 * FINANCIAL CONTROL - Text Copy & Tooltips
 * =========================================
 * File này chứa tất cả text, tooltip, hướng dẫn cho UI Financial Control
 * Dễ quản lý, dễ cập nhật, dễ dịch sang ngôn ngữ khác
 */

// ═══════════════════════════════════════════════════════════
// TOOLTIP CONTENT (4 dòng chuẩn: Ý nghĩa, Công thức, Nguồn, Lưu ý)
// ═══════════════════════════════════════════════════════════

export interface TooltipContent {
  meaning: string;       // Ý nghĩa
  formula: string;       // Công thức
  source: string;        // Nguồn dữ liệu
  note: string;          // Lưu ý vận hành
}

export interface KpiTooltipsType {
  bankBalance: TooltipContent;
  committedCash: TooltipContent;
  freeCash: TooltipContent;
  monthlyBurn: TooltipContent;
  runway: TooltipContent;
  survivalFloor: TooltipContent;
  safety: TooltipContent;
  adsBudgetApproved: TooltipContent;
  ownerWithdrawable: TooltipContent;
  forecast7DLowPoint: TooltipContent;
}

export const KPI_TOOLTIPS: KpiTooltipsType = {
  bankBalance: {
    meaning: 'Tiền hiện có trong ngân hàng/quỹ.',
    formula: 'Nhập từ nguồn quỹ/bank hoặc tính: Số dư cũ + Vốn vay + Doanh thu đã thu - Chi phí đã chi.',
    source: 'Funding Sources / Bank Input / Transactions.',
    note: '⚠️ Nếu số này sai → toàn dashboard sai. Cần đối chiếu với sao kê ngân hàng.',
  },
  committedCash: {
    meaning: 'Tiền "đã có chủ" - phải chi trong 14 ngày tới (mặc định).',
    formula: 'CommittedCash = Σ(Lương + Vận hành + Đại lý + Nợ vay) trong window 14D.',
    source: 'Labor AP + Ops AP + Agent Payables + Debt Due (14D) + Tax (nếu có).',
    note: '⚠️ Nếu có module lỗi/timeout → số có thể bị thiếu (hiển thị PARTIAL).',
  },
  freeCash: {
    meaning: 'Tiền còn lại sau khi trừ cam kết 14D - tiền có thể chi ngay.',
    formula: 'FreeCash = BankBalance - CommittedCash(14D).',
    source: 'Tính từ 2 chỉ số trên.',
    note: '⚠️ FreeCash < 0 = cảnh báo thiếu tiền trả đúng hạn!',
  },
  monthlyBurn: {
    meaning: 'Chi phí bắt buộc hàng tháng để doanh nghiệp tồn tại.',
    formula: 'MonthlyBurn = Lương core + Vận hành bắt buộc (trừ ads) + Trả nợ + Hoa hồng đại lý chờ thanh toán + NCC chờ thanh toán.',
    source: 'Labor/AP + Other Costs (non-ads) + Debt due + Agent pending + Supplier pending.',
    note: 'Dùng để tính Runway và Survival Floor.',
  },
  runway: {
    meaning: 'Sống được bao lâu nếu không có dòng tiền vào.',
    formula: 'Runway = FreeCash / MonthlyBurn (tháng).',
    source: 'Tính từ FreeCash và MonthlyBurn.',
    note: '🔴 < 1 tháng = Danger | 🟠 1-3 tháng = Warning | 🟡 3-6 tháng = OK | 🟢 > 6 tháng = Safe.',
  },
  survivalFloor: {
    meaning: 'Mức tiền tối thiểu phải giữ để sống còn 3 tháng.',
    formula: 'SurvivalFloor = SurvivalMonths × MonthlyBurn (mặc định 3 tháng).',
    source: 'Config survivalMonths + MonthlyBurn breakdown.',
    note: 'Tiền dưới mức này = KHÔNG được scale, KHÔNG cho owner rút.',
  },
  safety: {
    meaning: 'Mức an toàn so với Survival Floor.',
    formula: 'Safety% = (FreeCash / SurvivalFloor) × 100.',
    source: 'FreeCash và SurvivalFloor.',
    note: '< 100% = Rủi ro sống còn, cần ưu tiên tích lũy.',
  },
  adsBudgetApproved: {
    meaning: 'Ngân sách Ads được duyệt cho 7 ngày tới.',
    formula: 'AdsBudget = min(OptimalAdsSuggestion, AvailableAfterSurvival).',
    source: 'Ad Group Daily Report + Financial Control config.',
    note: '= 0đ nếu chưa đủ Survival Floor. Chỉ scale khi đã an toàn.',
  },
  ownerWithdrawable: {
    meaning: 'Số tiền Owner có thể rút an toàn ngay bây giờ.',
    formula: 'OwnerWithdrawable = max(0, AvailableAfterSurvival - AdsBudgetApproved).',
    source: 'Tính sau khi đã trừ Survival + Ads.',
    note: '= 0đ nếu Runway < 3 tháng hoặc đang scale ads.',
  },
  forecast7DLowPoint: {
    meaning: 'Điểm thấp nhất dự kiến trong 7 ngày tới.',
    formula: 'LowPoint = min(ForecastBank[day 1..7]).',
    source: 'Forecast dựa trên ExpectedIn/Out từ các module.',
    note: '< 0 = CASH CRUNCH | < SurvivalFloor = RỦI RO.',
  },
};

// ═══════════════════════════════════════════════════════════
// FORECAST TABLE TOOLTIPS
// ═══════════════════════════════════════════════════════════

export const FORECAST_COLUMN_TOOLTIPS = {
  expectedIn: {
    label: '📥 Tiền VÀO',
    tooltip: 'Dự kiến thu: NCC chuyển khoản + Vay giải ngân + Refund + Thu khác. Đã áp hệ số rủi ro 80%.',
  },
  expectedOut: {
    label: '📤 Tiền RA',
    tooltip: 'Dự kiến chi: Ads + Lương + Vận hành + Đại lý + Thuế + Trả nợ.',
  },
  forecastBank: {
    label: '💰 Số Dư',
    tooltip: 'Số dư dự kiến cuối ngày = Số dư hôm trước + Tiền vào - Tiền ra.',
  },
};

export const FORECAST_BADGE_TOOLTIPS = {
  lowPoint: 'Điểm thấp nhất trong 7 ngày - cần theo dõi kỹ ngày này.',
  cashCrunch: '🚨 CASH CRUNCH: Số dư dự kiến < 0, cần hành động ngay!',
  survivalRisk: '⚠️ RỦI RO SỐNG CÒN: Số dư < Survival Floor, không đủ buffer 3 tháng.',
};

// ═══════════════════════════════════════════════════════════
// LEGEND / STATUS
// ═══════════════════════════════════════════════════════════

export const STATUS_LEGEND = {
  safe: { icon: '✅', label: 'OK', color: '#3fb950', description: 'Chỉ số trong ngưỡng an toàn' },
  ok: { icon: '🟡', label: 'Watch', color: '#d29922', description: 'Cần theo dõi, chưa nguy hiểm' },
  warning: { icon: '🟠', label: 'Warning', color: '#f0883e', description: 'Cảnh báo, cần hành động sớm' },
  danger: { icon: '🔴', label: 'Danger', color: '#f85149', description: 'Nguy hiểm, cần hành động ngay' },
  missing: { icon: '⚪', label: 'Missing', color: '#8b949e', description: 'Thiếu dữ liệu hoặc module lỗi' },
};

export const DATA_STATUS = {
  ok: { label: 'OK', color: '#3fb950', tooltip: 'Tất cả module hoạt động bình thường.' },
  partial: { label: 'PARTIAL', color: '#d29922', tooltip: 'Một số module timeout/error/missing. Số liệu có thể không đầy đủ.' },
  error: { label: 'ERROR', color: '#f85149', tooltip: 'Không thể lấy dữ liệu từ server.' },
};

// ═══════════════════════════════════════════════════════════
// HƯỚNG DẪN ĐỌC DASHBOARD (CEO/CFO Guide)
// ═══════════════════════════════════════════════════════════

export const CEO_GUIDE = {
  title: 'Cách đọc Dashboard (CEO/CFO)',
  steps: [
    {
      step: 1,
      title: 'Kiểm tra khả năng chi trả',
      description: 'Nhìn "Committed 14D" → Có trả được đúng hạn không? FreeCash >= Committed là OK.',
    },
    {
      step: 2,
      title: 'Đánh giá sống còn',
      description: 'Nhìn "Runway" → >= 3 tháng là an toàn. < 1 tháng là nguy hiểm, cần hành động ngay.',
    },
    {
      step: 3,
      title: 'Quyết định scale/rút tiền',
      description: 'Chỉ khi Runway >= 3 tháng mới xem "Ads Budget" và "Owner Withdrawable".',
    },
    {
      step: 4,
      title: 'Kiểm tra rủi ro tương lai',
      description: 'Nhìn "Forecast Low Point" → Đây là ngày rủi ro nhất trong 7 ngày tới.',
    },
  ],
  notes: [
    'Số 0đ không có nghĩa "không phát sinh" - có thể là module thiếu dữ liệu.',
    'Forecast là dự báo dựa trên dữ liệu hiện có + hệ số rủi ro, không phải cam kết.',
    'Khi thấy "PARTIAL" → kiểm tra module nào đang lỗi trong tooltip.',
  ],
};

// ═══════════════════════════════════════════════════════════
// ZERO VALUE EXPLANATIONS
// ═══════════════════════════════════════════════════════════

export const ZERO_VALUE_REASONS = {
  adsBudgetApproved: [
    'AvailableAfterSurvival = 0 (chưa đủ Survival Floor)',
    'Runway < 3 tháng (đang ở trạng thái nguy hiểm)',
    'Không có ad groups đang hoạt động',
  ],
  ownerWithdrawable: [
    'Chưa đủ Survival Floor (cần 3 tháng buffer)',
    'Đã dành hết cho Ads Budget',
    'FreeCash <= 0',
  ],
  committedCash: [
    'Không có khoản nào phải trả trong 14 ngày tới',
    'Tất cả đã thanh toán',
    'Module timeout/error (kiểm tra Data Status)',
  ],
};

// ═══════════════════════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Format số tiền VND, tránh hiển thị -0đ
 */
export function formatVND(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  // Tránh hiển thị -0đ
  if (Math.abs(value) < 0.5) return '0 ₫';
  return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' ₫';
}

/**
 * Format số tiền có dấu +/-
 */
export function formatVNDWithSign(value: number): string {
  if (Math.abs(value) < 0.5) return '0 ₫';
  const formatted = new Intl.NumberFormat('vi-VN').format(Math.abs(Math.round(value)));
  return (value >= 0 ? '+' : '-') + formatted + ' ₫';
}
