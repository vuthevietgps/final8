export enum PlanType {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export interface PlanDefinition {
  maxUsers: number;
  modules: string[];
}

const STARTER_MODULES = [
  'user', 'product', 'product-category', 'customer', 'quote',
  'delivery-status', 'order-status', 'production-status',
  'other-cost', 'labor-cost1', 'salary-config', 'media', 'ad-account',
  'export-user', 'import-user',
];

const PROFESSIONAL_MODULES = [
  ...STARTER_MODULES,
  'test-order2', 'supplier-payable', 'supplier-quote',
  'pending-order', 'order-update', 'order-sheet-sync',
  'inventory', 'google-sync', 'return-request', 'return-report',
  'ad-group', 'advertising-cost', 'api-token', 'fanpage',
  'openai-config', 'chat-message', 'ai-operator', 'ai-marketing',
  'ad-group-profit-report', 'ad-report',
  'employee-ads-kpi', 'ads-alerts', 'agent-receivable', 'ops-action',
  'purchase',
];

export const PLAN_CONFIG: Record<PlanType, PlanDefinition> = {
  [PlanType.STARTER]: {
    maxUsers: 10,
    modules: STARTER_MODULES,
  },
  [PlanType.PROFESSIONAL]: {
    maxUsers: 30,
    modules: PROFESSIONAL_MODULES,
  },
  [PlanType.ENTERPRISE]: {
    maxUsers: Infinity,
    modules: ['*'],
  },
};

export function getCurrentPlan(): PlanType {
  const plan = process.env.PLAN_TYPE || PlanType.ENTERPRISE;
  if (Object.values(PlanType).includes(plan as PlanType)) {
    return plan as PlanType;
  }
  return PlanType.ENTERPRISE;
}

export function isModuleAllowed(moduleName: string): boolean {
  const plan = getCurrentPlan();
  const config = PLAN_CONFIG[plan];
  return config.modules.includes('*') || config.modules.includes(moduleName);
}
