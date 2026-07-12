import { Types } from "mongoose";

export const DEMO_BATCH_ID = "DEMO_DIRECTOR_AI_PACK_20260614";
export const DEMO_PREFIX = "DEMO_AIDP28";

export type DirectorDemoSeedMode = "dry-run" | "apply" | "reset-demo";
export type DirectorDemoSeedProfile = "small" | "medium" | "large";

export interface DirectorDemoSeedProfileConfig {
  profile: DirectorDemoSeedProfile;
  timeRangeDays: number;
  suppliers: number;
  agents: number;
  employees: number;
  productGroups: number;
  products: number;
  supplierQuotes: number;
  dealerQuotes: number;
  purchaseOrders: number;
  salesOrders: number;
  customers: number;
  loans: number;
  loanRepayments: number;
  laborEntries: number;
  adAccounts: number;
  adCampaigns: number;
  adGroups: number;
  dailyAdMetricRows: number;
  leadRows: number;
  inventoryMovements: number;
}

export interface DirectorDemoSeedCliOptions {
  mode: DirectorDemoSeedMode;
  profile: DirectorDemoSeedProfile;
  mongoUri?: string;
}

export interface DemoCollectionDocs {
  collection: string;
  docs: any[];
}

export interface DirectorDemoDataset {
  batchId: string;
  prefix: string;
  profile: DirectorDemoSeedProfile;
  generatedAt: string;
  reportDate: string;
  collections: DemoCollectionDocs[];
  counts: Record<string, number>;
  anomalies: string[];
}

export interface DirectorDemoSeedSummary {
  profile: DirectorDemoSeedProfile;
  mode: DirectorDemoSeedMode;
  dryRun: boolean;
  resetFirst: boolean;
  batchId: string;
  prefix: string;
  counts: Record<string, number>;
  anomaliesCreated: number;
}

export interface ResetOperation {
  collection: string;
  filter: Record<string, any>;
}

export type DemoObjectId = Types.ObjectId;

