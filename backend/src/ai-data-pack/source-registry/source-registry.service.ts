import { Injectable } from "@nestjs/common";
import { SourceRegistryEntry } from "./source-registry.types";

const dbOnly = {
  readOnlyDbOnly: true as const,
  providerSyncAllowedInThisPr: false as const,
  mutationAllowed: false as const,
};

const SOURCES: SourceRegistryEntry[] = [
  {
    sourceKey: "google_ads",
    domain: "ads",
    businessImportance: "critical",
    packRelevance: ["director", "marketer", "data_quality", "mapping"],
    defaultMaxStalenessMinutes: 60,
    freshnessMethod: "sync_run",
    coverageMethod: "report_date_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "google_ads_sync_runs",
        filter: { status: "success" },
        fields: [
          {
            field: "completedAt",
            kind: "last_successful_sync",
            valueType: "date",
          },
        ],
      },
      {
        collectionName: "google_ads_daily_metrics",
        fields: [
          { field: "lastSyncAt", kind: "record_updated", valueType: "date" },
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "date", kind: "record_date", valueType: "date_string" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "google_ads_daily_metrics",
        mode: "report_date",
        field: "date",
        valueType: "date_string",
      },
    ],
    notes:
      "Uses durable successful sync runs and local daily metric coverage only; no provider call.",
  },
  {
    sourceKey: "meta_ads",
    domain: "ads",
    businessImportance: "important",
    packRelevance: ["director", "marketer", "data_quality"],
    defaultMaxStalenessMinutes: 180,
    freshnessMethod: "max_updated_at",
    coverageMethod: "report_date_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "advertisingcosts",
        filter: { channel: "facebook" },
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "date", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "advertisingcosts",
        filter: { channel: "facebook" },
        mode: "report_date",
        field: "date",
        valueType: "date",
      },
    ],
    notes: "Local advertising-cost watermark only; not proof of provider sync.",
  },
  {
    sourceKey: "tiktok_ads",
    domain: "ads",
    businessImportance: "important",
    packRelevance: ["director", "marketer", "data_quality"],
    defaultMaxStalenessMinutes: 180,
    freshnessMethod: "max_updated_at",
    coverageMethod: "report_date_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "advertisingcosts",
        filter: { channel: "tiktok" },
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "date", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "advertisingcosts",
        filter: { channel: "tiktok" },
        mode: "report_date",
        field: "date",
        valueType: "date",
      },
    ],
    notes: "Local advertising-cost watermark only; not proof of provider sync.",
  },
  {
    sourceKey: "zalo_ads",
    domain: "ads",
    businessImportance: "optional",
    packRelevance: ["marketer", "data_quality"],
    defaultMaxStalenessMinutes: null,
    freshnessMethod: "unsupported",
    coverageMethod: "unsupported",
    ...dbOnly,
    availability: "unsupported",
    notes: "No confirmed local Zalo Ads data source.",
  },
  {
    sourceKey: "advertising_costs",
    domain: "ads",
    businessImportance: "critical",
    packRelevance: ["director", "marketer", "data_quality"],
    defaultMaxStalenessMinutes: 360,
    freshnessMethod: "max_updated_at",
    coverageMethod: "report_date_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "advertisingcosts",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "date", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "advertisingcosts",
        mode: "report_date",
        field: "date",
        valueType: "date",
      },
    ],
  },
  {
    sourceKey: "crm_leads",
    domain: "crm",
    businessImportance: "critical",
    packRelevance: ["director", "marketer", "data_quality", "mapping"],
    defaultMaxStalenessMinutes: 120,
    freshnessMethod: "max_updated_at",
    coverageMethod: "report_date_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "marketing_leads",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "leadCreatedAt", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "marketing_leads",
        mode: "report_date",
        field: "leadCreatedAt",
        valueType: "date",
      },
    ],
    notes: "Some rows may be inferred from local ERP signals.",
  },
  {
    sourceKey: "orders",
    domain: "orders",
    businessImportance: "critical",
    packRelevance: ["director", "marketer", "data_quality", "mapping"],
    defaultMaxStalenessMinutes: 60,
    freshnessMethod: "max_updated_at",
    coverageMethod: "report_date_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "ordertest2",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "orderDate", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "ordertest2",
        mode: "report_date",
        field: "orderDate",
        valueType: "date",
      },
    ],
  },
  {
    sourceKey: "payments_or_order_payments",
    domain: "finance",
    businessImportance: "critical",
    packRelevance: ["director", "data_quality", "mapping"],
    defaultMaxStalenessMinutes: 120,
    freshnessMethod: "max_updated_at",
    coverageMethod: "report_date_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "ordertest2",
        filter: {
          $or: [
            { supplierPaidAt: { $exists: true } },
            { agentPaidAt: { $exists: true } },
            { realizedAt: { $exists: true } },
            { depositAmount: { $gt: 0 } },
            { manualPayment: { $gt: 0 } },
          ],
        },
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "orderDate", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "ordertest2",
        filter: {
          $or: [
            { supplierPaidAt: { $exists: true } },
            { agentPaidAt: { $exists: true } },
            { realizedAt: { $exists: true } },
            { depositAmount: { $gt: 0 } },
            { manualPayment: { $gt: 0 } },
          ],
        },
        mode: "report_date",
        field: "orderDate",
        valueType: "date",
      },
    ],
    notes: "Partial order-level payment evidence; no canonical payment ledger.",
  },
  {
    sourceKey: "finance",
    domain: "finance",
    businessImportance: "critical",
    packRelevance: ["director", "data_quality"],
    defaultMaxStalenessMinutes: 60,
    freshnessMethod: "max_updated_at",
    coverageMethod: "report_date_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "cashflowentries",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "date", kind: "record_date", valueType: "date" },
        ],
      },
      {
        collectionName: "cashflow_summary_snapshots",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "cashflowentries",
        mode: "report_date",
        field: "date",
        valueType: "date",
      },
    ],
    notes:
      "Local cashflow/snapshot activity only; no external accounting sync.",
  },
  {
    sourceKey: "loans_debt",
    domain: "finance",
    businessImportance: "critical",
    packRelevance: ["director", "data_quality"],
    defaultMaxStalenessMinutes: 1440,
    freshnessMethod: "max_updated_at",
    coverageMethod: "date_range_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "loancontracts",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
        ],
      },
      {
        collectionName: "loanrepayments",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "dueDate", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "loancontracts",
        mode: "date_range",
        startField: "startDate",
        endField: "endDate",
        valueType: "date",
      },
    ],
  },
  {
    sourceKey: "operations",
    domain: "operations",
    businessImportance: "important",
    packRelevance: ["director", "data_quality"],
    defaultMaxStalenessMinutes: 120,
    freshnessMethod: "max_updated_at",
    coverageMethod: "report_date_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "ordertest2",
        filter: { isActive: { $ne: false } },
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "orderDate", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "ordertest2",
        filter: { isActive: { $ne: false } },
        mode: "report_date",
        field: "orderDate",
        valueType: "date",
      },
    ],
    notes: "Current order status only; no durable SLA/status history.",
  },
  {
    sourceKey: "product_mapping",
    domain: "mapping",
    businessImportance: "critical",
    packRelevance: ["director", "marketer", "data_quality", "mapping"],
    defaultMaxStalenessMinutes: 1440,
    freshnessMethod: "max_updated_at",
    coverageMethod: "not_applicable",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "products",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
        ],
      },
      {
        collectionName: "productcategories",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
        ],
      },
      {
        collectionName: "adgroups",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
        ],
      },
    ],
  },
  {
    sourceKey: "inventory_profit",
    domain: "operations",
    businessImportance: "critical",
    packRelevance: ["director", "marketer", "data_quality", "mapping"],
    defaultMaxStalenessMinutes: 360,
    freshnessMethod: "max_updated_at",
    coverageMethod: "report_date_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "products",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
        ],
      },
      {
        collectionName: "inventorysummaries",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
        ],
      },
      {
        collectionName: "ordertest2",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "orderDate", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "ordertest2",
        filter: { isActive: { $ne: false } },
        mode: "report_date",
        field: "orderDate",
        valueType: "date",
      },
    ],
    notes:
      "Local product economics, order profit, and inventory-summary readiness for ads allocation only.",
  },
  {
    sourceKey: "supplier_safety",
    domain: "operations",
    businessImportance: "critical",
    packRelevance: ["director", "marketer", "data_quality", "mapping"],
    defaultMaxStalenessMinutes: 1440,
    freshnessMethod: "max_updated_at",
    coverageMethod: "date_range_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "supplierquotes",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "effectiveAt", kind: "record_date", valueType: "date" },
        ],
      },
      {
        collectionName: "purchaseorders",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "expectedDeliveryDate", kind: "record_date", valueType: "date" },
          { field: "receivedDate", kind: "record_date", valueType: "date" },
        ],
      },
      {
        collectionName: "supplierpayables",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
        ],
      },
      {
        collectionName: "supplierstatements",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "periodTo", kind: "record_date", valueType: "date" },
        ],
      },
      {
        collectionName: "ordertest2",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "orderDate", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "supplierstatements",
        mode: "date_range",
        startField: "periodFrom",
        endField: "periodTo",
        valueType: "date",
      },
      {
        collectionName: "ordertest2",
        filter: { supplierId: { $exists: true } },
        mode: "report_date",
        field: "orderDate",
        valueType: "date",
      },
    ],
    notes:
      "Local supplier quote, fulfillment, payment, and return/fault safety evidence for ads allocation only.",
  },
  {
    sourceKey: "decision_history",
    domain: "decision_history",
    businessImportance: "important",
    packRelevance: ["director", "data_quality", "decision_history"],
    defaultMaxStalenessMinutes: 1440,
    freshnessMethod: "max_updated_at",
    coverageMethod: "report_date_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "google_ads_action_execution_logs",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "executedAt", kind: "record_date", valueType: "date" },
        ],
      },
      {
        collectionName: "google_ads_action_evaluations",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "executedAt", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "google_ads_action_execution_logs",
        mode: "report_date",
        field: "executedAt",
        valueType: "date",
      },
      {
        collectionName: "google_ads_action_evaluations",
        mode: "report_date",
        field: "executedAt",
        valueType: "date",
      },
    ],
  },
  {
    sourceKey: "external_market",
    domain: "external",
    businessImportance: "optional",
    packRelevance: ["director", "marketer"],
    defaultMaxStalenessMinutes: null,
    freshnessMethod: "unsupported",
    coverageMethod: "unsupported",
    ...dbOnly,
    availability: "unsupported",
    notes: "No confirmed local external-market collection.",
  },
  {
    sourceKey: "supplier_settlement",
    domain: "finance",
    businessImportance: "important",
    packRelevance: ["director", "data_quality", "mapping"],
    defaultMaxStalenessMinutes: 1440,
    freshnessMethod: "max_updated_at",
    coverageMethod: "date_range_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "supplierpayables",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
        ],
      },
      {
        collectionName: "supplierstatements",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "periodTo", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "supplierstatements",
        mode: "date_range",
        startField: "periodFrom",
        endField: "periodTo",
        valueType: "date",
      },
    ],
    notes: "Criticality remains pending Director/BA approval.",
  },
  {
    sourceKey: "return_refund",
    domain: "operations",
    businessImportance: "important",
    packRelevance: ["director", "marketer", "data_quality", "mapping"],
    defaultMaxStalenessMinutes: 1440,
    freshnessMethod: "max_updated_at",
    coverageMethod: "report_date_count",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "returnrequests",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "createdAt", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "returnrequests",
        mode: "report_date",
        field: "createdAt",
        valueType: "date",
      },
    ],
  },
  {
    sourceKey: "customer_referral",
    domain: "mapping",
    businessImportance: "optional",
    packRelevance: ["director", "marketer", "data_quality", "mapping"],
    defaultMaxStalenessMinutes: null,
    freshnessMethod: "unsupported",
    coverageMethod: "unsupported",
    ...dbOnly,
    availability: "unsupported",
    notes: "No durable referral graph was confirmed.",
  },
  {
    sourceKey: "employee_activity_payroll",
    domain: "operations",
    businessImportance: "unsupported",
    packRelevance: ["director", "data_quality", "mapping"],
    defaultMaxStalenessMinutes: null,
    freshnessMethod: "unsupported",
    coverageMethod: "unsupported",
    ...dbOnly,
    availability: "unsupported",
    notes:
      "No confirmed unified attendance/work/activity/payroll reconciliation source.",
  },
  {
    sourceKey: "system_settings",
    domain: "system",
    businessImportance: "important",
    packRelevance: ["director", "data_quality"],
    defaultMaxStalenessMinutes: 1440,
    freshnessMethod: "static_config",
    coverageMethod: "not_applicable",
    ...dbOnly,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "system_settings",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
        ],
      },
    ],
    notes: "Absence is classified as not_configured, not fresh.",
  },
];

@Injectable()
export class SourceRegistryService {
  list(): SourceRegistryEntry[] {
    return structuredClone(SOURCES);
  }

  get(sourceKey: string): SourceRegistryEntry | undefined {
    const source = SOURCES.find(
      (candidate) => candidate.sourceKey === sourceKey,
    );
    return source ? structuredClone(source) : undefined;
  }
}
