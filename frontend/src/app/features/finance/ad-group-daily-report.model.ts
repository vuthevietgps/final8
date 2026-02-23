export interface AdGroupDailyReport {
  date: string;
  adGroupId: string;
  adGroupName: string;
  platform: string;
  adsCost: number;
  netProfit: number;
  // Chi phí gợi ý dựa trên thuật toán lợi nhuận biên giảm dần
  suggestedSpend: number | null;
  suggestionReason: string | null;
  suggestionConfidence: number | null;
}

export interface AdGroupDailyReportSummary {
  totalAdsCost: number;
  totalNetProfit: number;
}

export interface AdGroupDailyReportResponse {
  summary: AdGroupDailyReportSummary;
  details: AdGroupDailyReport[];
  dateRange: {
    from: string;
    to: string;
  };
}

export interface TopAdGroup {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  adsCost: number;
  netProfit: number;
}

export interface OptimalSpendSuggestion {
  adGroupId: string;
  adGroupName: string;
  currentAvgSpend: number;
  /** Chi phí gợi ý theo lợi nhuận biên (không giới hạn %) */
  suggestedSpend: number;
  /** Chi phí gợi ý có áp dụng trần +20% tăng / -30% giảm */
  suggestedSpendWithCap: number;
  reason: string;
  confidence: number;
  marginalAnalysis: {
    dataPoints: number;
    lastMarginalProfit: number;
    avgMarginalProfit: number;
  };
}

export interface OptimalSpendResponse {
  adGroupSuggestions: OptimalSpendSuggestion[];
  /** Tổng chi phí gợi ý theo lợi nhuận biên */
  totalSuggestedSpend: number;
  /** Tổng chi phí gợi ý có áp dụng trần % - dùng cho Financial Control */
  totalSuggestedSpendWithCap: number;
  /** Tổng chi phí hiện tại */
  totalCurrentSpend: number;
}
