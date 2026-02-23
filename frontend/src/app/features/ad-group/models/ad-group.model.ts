/**
 * File: features/ad-group/models/ad-group.model.ts
 * Mục đích: Khai báo interface/kiểu dữ liệu cho Nhóm Quảng Cáo (frontend).
 */

export type AdPlatform = 'facebook' | 'google' | 'tiktok';

export interface AdGroup {
  _id?: string;
  name: string;         // Tên nhóm quảng cáo
  adGroupId: string;    // ID nhóm quảng cáo (do người dùng nhập)
  
  // Legacy fields (backward compatibility)
  productId?: string;    // Tham chiếu sản phẩm (deprecated)
  agentId?: string;      // Tham chiếu user (đại lý) (deprecated)
  adAccountId?: string;  // Tham chiếu tài khoản quảng cáo (deprecated)
  platform?: AdPlatform; // Nền tảng quảng cáo (deprecated)
  dailyBudget?: number;  // Ngân sách/ngày hiện tại
  
  // New chatbot integration fields
  fanpageId?: string;           // Tham chiếu fanpage
  productCategoryId?: string;   // Tham chiếu danh mục sản phẩm
  selectedProducts?: string[];  // Danh sách sản phẩm được chọn
  enableWebhook?: boolean;      // Kích hoạt webhook
  // Auto control fields
  autoControlEnabled?: boolean;
  spendThresholdDaily?: number;      // VND/ngày
  cprThresholdDaily?: number;        // VND/ cuộc hội thoại
  minConversations?: number;         // số hội thoại tối thiểu để tính CPR
  autoPausedReason?: string;         // backend ghi chú khi tự dừng
  
  isActive: boolean;    // Trạng thái (đang hoạt động / đã tạm dừng)
  notes?: string;       // Ghi chú (không bắt buộc)
  
  // Populated fields (khi có populate từ backend)
  productName?: string;
  agentName?: string;
  adAccountName?: string;
  adAccountAccountId?: string;

  // AI đề xuất ngân sách
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
