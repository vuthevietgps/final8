/**
 * File: features/ad-group/ad-group.model.ts
 * Muc dich: Khai bao interface/kieu du lieu cho Nhom Quang Cao.
 */

import { AdsOperatorRef, AdAccount } from '../../ad-account/models/ad-account.model';

export type AdPlatform = 'facebook' | 'google' | 'tiktok';

export interface AdGroup {
  _id?: string;
  name: string;
  adGroupId: string;

  productId?: string;
  agentId?: string | AdsOperatorRef;
  adAccountId?: string | AdAccount;
  platform?: AdPlatform;
  dailyBudget?: number;

  fanpageId?: string;
  productCategoryId?: string;
  selectedProducts?: Array<string | { _id?: string; name?: string; categoryId?: any; status?: string }>;
  enableWebhook?: boolean;

  autoControlEnabled?: boolean;
  spendThresholdDaily?: number;
  cprThresholdDaily?: number;
  minConversations?: number;
  autoPausedReason?: string;

  assignedEmployeeId?: string | AdsOperatorRef;
  lastOperatorActivityAt?: string;
  isActive: boolean;
  notes?: string;

  productName?: string;
  agentName?: string;
  adAccountName?: string;
  adAccountAccountId?: string;

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
