export const OPS_ACTION_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

export type OpsActionPriority = (typeof OPS_ACTION_PRIORITIES)[number];

export const OPS_ACTION_TYPES = [
  'SUPPLIER_OVERDUE_15PLUS',
  'SUPPLIER_OVER_THRESHOLD',
  'SUPPLIER_OPEN_STATEMENT',
  'SUPPLIER_AGING_8_14',
  'AGENT_CLAWBACK_OUTSTANDING',
  'AGENT_COMMISSION_DUE_14D',
  'AGENT_OVERDUE_15PLUS',
  'AGENT_BIWEEKLY_APPROACHING',
] as const;

export type OpsActionType = (typeof OPS_ACTION_TYPES)[number];

export interface OpsActionItem {
  actionType: OpsActionType;
  priority: OpsActionPriority;
  title: string;
  description: string;
  reason: string;
  linkTo?: string;
  amount?: number;
  count?: number;
  entityName?: string;
  entityId?: string;
  generatedAt: string;
}

export interface OpsActionsResponse {
  actions: OpsActionItem[];
  totalCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  asOf: string;
  dataSources: {
    supplierPayable: boolean;
    agentReceivable: boolean;
  };
}
