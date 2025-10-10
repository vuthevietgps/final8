/**
 * File: features/ad-group/models/ad-group.model.ts
 * Mục đích: Khai báo interface/kiểu dữ liệu cho Nhóm Quảng Cáo (frontend).
 */

export type AdPlatform = 'facebook' | 'google' | 'ticktock';

// Chat script configuration for AI responses
export interface ChatScript {
  greeting: string;
  upsell: string;
  closing: string;
  attributes: string[];
}

// Discount program configuration
export interface DiscountProgram {
  discountType: 'percentage' | 'fixed' | '';
  discountValue: number;
  conditions: string;
}

export interface AdGroup {
  _id?: string;
  name: string;         // Tên nhóm quảng cáo
  adGroupId: string;    // ID nhóm quảng cáo (do người dùng nhập)
  
  // Legacy fields (backward compatibility)
  productId?: string;    // Tham chiếu sản phẩm (deprecated)
  agentId?: string;      // Tham chiếu user (đại lý) (deprecated)
  adAccountId?: string;  // Tham chiếu tài khoản quảng cáo (deprecated)
  platform?: AdPlatform; // Nền tảng quảng cáo (deprecated)
  
  // New chatbot integration fields
  fanpageId?: string;           // Tham chiếu fanpage
  productCategoryId?: string;   // Tham chiếu danh mục sản phẩm
  selectedProducts?: string[];  // Danh sách sản phẩm được chọn
  openAIConfigId?: string;      // Cấu hình OpenAI
  chatScript?: ChatScript;      // Kịch bản trò chuyện
  discountProgram?: DiscountProgram; // Chương trình khuyến mãi
  enableWebhook?: boolean;      // Kích hoạt webhook
  enableAIChat?: boolean;       // Kích hoạt AI chat
  
  isActive: boolean;    // Trạng thái (đang hoạt động / đã tạm dừng)
  notes?: string;       // Ghi chú (không bắt buộc)
  
  // Populated fields (khi có populate từ backend)
  productName?: string;
  agentName?: string;
  adAccountName?: string;
  adAccountAccountId?: string;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export type CreateAdGroup = Omit<AdGroup, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateAdGroup = Partial<CreateAdGroup>;
