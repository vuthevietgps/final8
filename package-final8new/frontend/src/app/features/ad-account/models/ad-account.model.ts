/**
 * File: ad-account/models/ad-account.model.ts
 * Mục đích: Interface cho Tài Khoản Quảng Cáo ở frontend.
 */

export interface AdAccount {
  _id: string;
  name: string; // Tên tài khoản quảng cáo
  accountId: string; // ID tài khoản quảng cáo
  accountType: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'shopee' | 'lazada'; // Loại tài khoản quảng cáo
  isActive: boolean; // Trạng thái hoạt động
  notes?: string; // Ghi chú
  description?: string; // Mô tả tài khoản
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdAccountRequest {
  name: string;
  accountId: string;
  accountType: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'shopee' | 'lazada';
  isActive?: boolean;
  notes?: string;
  description?: string;
}

export interface UpdateAdAccountRequest extends Partial<CreateAdAccountRequest> {}

export interface AdAccountSearchFilter {
  keyword?: string;
  accountType?: string;
  status?: string;
}

export interface AccountTypeStats {
  _id: string;
  count: number;
  active: number;
}
