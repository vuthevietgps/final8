/**
 * File: ad-account/models/ad-account.model.ts
 * Muc dich: Interface cho Tai Khoan Quang Cao o frontend.
 */

export type AdManagementMode = 'direct' | 'bm' | 'mcc' | 'bc';
export type AdTokenSource = 'system' | 'account' | 'manual';

export interface AdsOperatorRef {
  _id: string;
  fullName?: string;
  email?: string;
  role?: string;
}

export interface AdAccount {
  _id: string;
  name: string;
  accountId: string;
  accountType: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'shopee' | 'lazada';
  managementMode?: AdManagementMode;
  isActive: boolean;
  notes?: string;
  description?: string;
  loginCustomerId?: string;
  businessCenterId?: string;
  businessCenterName?: string;
  tokenSource?: AdTokenSource;
  adsManagerUserId?: string | AdsOperatorRef;
  lastOperatorActivityAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdAccountRequest {
  name: string;
  accountId: string;
  accountType: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'shopee' | 'lazada';
  managementMode?: AdManagementMode;
  isActive?: boolean;
  notes?: string;
  description?: string;
  loginCustomerId?: string;
  businessCenterId?: string;
  businessCenterName?: string;
  tokenSource?: AdTokenSource;
  adsManagerUserId?: string;
}

export interface UpdateAdAccountRequest extends Partial<CreateAdAccountRequest> {}

export interface AdAccountSearchFilter {
  keyword?: string;
  accountType?: string;
  status?: string;
  managementMode?: string;
  adsManagerUserId?: string;
}

export interface AccountTypeStats {
  _id: string;
  count: number;
  active: number;
}
