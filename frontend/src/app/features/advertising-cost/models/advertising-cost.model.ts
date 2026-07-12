export type AdChannel = 'facebook' | 'google' | 'tiktok' | 'zalo' | 'other';
export type ManagementMode = 'direct' | 'bm' | 'mcc' | 'bc';

export interface AdvertisingCost {
  _id?: string;
  date: string;
  channel?: AdChannel;
  frequency?: number;
  adGroupId: string;
  spentAmount?: number;
  cpm?: number;
  cpc?: number;
  impressions?: number;
  clicks?: number;
  reach?: number;
  messagingConversationStarted7d?: number;
  costPerMessagingConversation?: number;
  messagingFirstReply?: number;
  createdAt?: string;
  adAccountId?: string;
  adAccountName?: string;
  adAccountAccountId?: string;
  customerId?: string;
  businessCenterId?: string;
  businessCenterName?: string;
  managementMode?: ManagementMode;
  adsManagerUserId?: string;
  assignedEmployeeId?: string;
}

export type CreateAdvertisingCost = Omit<AdvertisingCost, '_id' | 'createdAt'>;
export type UpdateAdvertisingCost = Partial<CreateAdvertisingCost>;

export interface AdvertisingCostSummary {
  totalSpent: number;
  count: number;
  avgCPM: number;
  avgCPC: number;
}
