import {
  DEMO_BATCH_ID,
  DEMO_PREFIX,
  DirectorDemoSeedProfile,
  DirectorDemoSeedProfileConfig,
} from "./director-demo-seed.types";

export { DEMO_BATCH_ID, DEMO_PREFIX };

export const DIRECTOR_DEMO_SEED = "DEMO_DIRECTOR_AI_PACK_20260614";
export const DIRECTOR_DEMO_REPORT_DATE = "2026-06-14";
export const DIRECTOR_DEMO_ANCHOR_DATE = "2026-06-14T00:00:00.000Z";

export const DIRECTOR_DEMO_PROFILES: Record<
  DirectorDemoSeedProfile,
  DirectorDemoSeedProfileConfig
> = {
  small: {
    profile: "small",
    timeRangeDays: 45,
    suppliers: 6,
    agents: 14,
    employees: 8,
    productGroups: 8,
    products: 30,
    supplierQuotes: 90,
    dealerQuotes: 90,
    purchaseOrders: 60,
    salesOrders: 180,
    customers: 160,
    loans: 3,
    loanRepayments: 18,
    laborEntries: 160,
    adAccounts: 2,
    adCampaigns: 6,
    adGroups: 10,
    dailyAdMetricRows: 220,
    leadRows: 220,
    inventoryMovements: 180,
  },
  medium: {
    profile: "medium",
    timeRangeDays: 180,
    suppliers: 24,
    agents: 80,
    employees: 45,
    productGroups: 36,
    products: 180,
    supplierQuotes: 720,
    dealerQuotes: 720,
    purchaseOrders: 420,
    salesOrders: 1800,
    customers: 1400,
    loans: 10,
    loanRepayments: 120,
    laborEntries: 1800,
    adAccounts: 6,
    adCampaigns: 30,
    adGroups: 54,
    dailyAdMetricRows: 3600,
    leadRows: 2400,
    inventoryMovements: 2200,
  },
  large: {
    profile: "large",
    timeRangeDays: 180,
    suppliers: 30,
    agents: 100,
    employees: 72,
    productGroups: 50,
    products: 300,
    supplierQuotes: 1000,
    dealerQuotes: 1000,
    purchaseOrders: 800,
    salesOrders: 3000,
    customers: 3000,
    loans: 15,
    loanRepayments: 200,
    laborEntries: 5000,
    adAccounts: 8,
    adCampaigns: 80,
    adGroups: 120,
    dailyAdMetricRows: 5000,
    leadRows: 5000,
    inventoryMovements: 5000,
  },
};

export function resolveDemoProfile(
  profile?: string,
): DirectorDemoSeedProfileConfig {
  const key = (profile || "medium") as DirectorDemoSeedProfile;
  const resolved = DIRECTOR_DEMO_PROFILES[key];
  if (!resolved) {
    throw new Error(`Unsupported demo seed profile: ${profile}`);
  }
  return resolved;
}

