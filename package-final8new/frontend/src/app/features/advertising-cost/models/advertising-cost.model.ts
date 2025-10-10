export interface AdvertisingCost {
  _id?: string;
  date: string; // ISO string yyyy-mm-dd (UI hiển thị mm/dd/yyyy)
  frequency?: number;
  adGroupId: string;
  spentAmount?: number;
  cpm?: number;
  cpc?: number;
  createdAt?: string;
  // Enriched fields (backend join via ad group -> ad account)
  adAccountId?: string;
  adAccountName?: string;
  adAccountAccountId?: string;
}

export type CreateAdvertisingCost = Omit<AdvertisingCost, '_id' | 'createdAt'>;
export type UpdateAdvertisingCost = Partial<CreateAdvertisingCost>;

export interface AdvertisingCostSummary {
  totalSpent: number;
  count: number;
  avgCPM: number;
  avgCPC: number;
}
