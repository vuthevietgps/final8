/**
 * File: features/ad-group/models/ad-group.model.ts
 * Má»¥c Ä‘Ã­ch: Khai bÃ¡o interface/kiá»ƒu dá»¯ liá»‡u cho NhÃ³m Quáº£ng CÃ¡o (frontend).
 */

export type AdPlatform = 'facebook' | 'google' | 'tiktok';

export interface AdGroup {
  _id?: string;
  name: string;         // TÃªn nhÃ³m quáº£ng cÃ¡o
  adGroupId: string;    // ID nhÃ³m quáº£ng cÃ¡o (do ngÆ°á»i dÃ¹ng nháº­p)
  
  // Legacy fields (backward compatibility)
  productId?: string;    // Tham chiáº¿u sáº£n pháº©m (deprecated)
  agentId?: string;      // Tham chiáº¿u user (Ä‘áº¡i lÃ½) (deprecated)
  adAccountId?: string;  // Tham chiáº¿u tÃ i khoáº£n quáº£ng cÃ¡o (deprecated)
  platform?: AdPlatform; // Ná»n táº£ng quáº£ng cÃ¡o (deprecated)
  dailyBudget?: number;  // NgÃ¢n sÃ¡ch/ngÃ y hiá»‡n táº¡i
  
  // New chatbot integration fields
  fanpageId?: string;           // Tham chiáº¿u fanpage
  productCategoryId?: string;   // Tham chiáº¿u danh má»¥c sáº£n pháº©m
  selectedProducts?: string[];  // Khóa cứng: mảng luôn có đúng 1 sản phẩm
  enableWebhook?: boolean;      // KÃ­ch hoáº¡t webhook
  // Auto control fields
  autoControlEnabled?: boolean;
  spendThresholdDaily?: number;      // VND/ngÃ y
  cprThresholdDaily?: number;        // VND/ cuá»™c há»™i thoáº¡i
  minConversations?: number;         // sá»‘ há»™i thoáº¡i tá»‘i thiá»ƒu Ä‘á»ƒ tÃ­nh CPR
  autoPausedReason?: string;         // backend ghi chÃº khi tá»± dá»«ng
  
  isActive: boolean;    // Tráº¡ng thÃ¡i (Ä‘ang hoáº¡t Ä‘á»™ng / Ä‘Ã£ táº¡m dá»«ng)
  notes?: string;       // Ghi chÃº (khÃ´ng báº¯t buá»™c)
  
  // Populated fields (khi cÃ³ populate tá»« backend)
  productName?: string;
  agentName?: string;
  adAccountName?: string;
  adAccountAccountId?: string;

  // AI Ä‘á» xuáº¥t ngÃ¢n sÃ¡ch
  aiSuggestedBudget?: number;
  aiChangePercent?: number;
  aiReason?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export type CreateAdGroup = Omit<AdGroup, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateAdGroup = Partial<CreateAdGroup>;

export interface AdGroupRecommendation {
  adGroupId: string;
  name: string;
  platform: string;
  currentBudget: number;
  suggestedBudget: number;
  changePercent: number;
  reason: string;
}

