/**
 * File: models/advertising-cost-suggestion.interface.ts
 * Mục đích: Định nghĩa TypeScript interfaces cho đề xuất chi phí quảng cáo
 */
export interface AdvertisingCostSuggestion {
  _id?: string;
  adGroupId: string;
  adGroupName: string;
  suggestedCost: number; // Chi phí đề xuất (nhập bằng tay)
  dailyCost: number; // Chi phí hàng ngày (lấy từ advertising-cost2)
  dailyDifference: number; // Chênh lệch = dailyCost - suggestedCost
  dailyDifferencePercent: number; // Chênh lệch % = (chênh lệch / đề xuất) * 100
  isActive?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdvertisingCostSuggestionStatistics {
  totalSuggestions: number;
  activeSuggestions: number;
  totalSuggestedCost: number;
  totalDailyCost: number;
  averageSuggestedCost: number;
  averageDailyCost: number;
  totalDifference: number;
}

export interface CreateAdvertisingCostSuggestionRequest {
  adGroupId: string;
  adGroupName: string;
  suggestedCost: number;
  dailyCost?: number;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateAdvertisingCostSuggestionRequest {
  adGroupId?: string;
  adGroupName?: string;
  suggestedCost?: number;
  dailyCost?: number;
  isActive?: boolean;
  notes?: string;
}