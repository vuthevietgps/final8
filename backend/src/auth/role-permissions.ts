import { UserRole } from '../user/user.enum';

const AI_DATA_PACK_EXPORT_DIRECTOR_PERMISSIONS = [
  'ai-data-pack.export.cached.create',
  'ai-data-pack.export.official.create',
  'ai-data-pack.export.partial.create',
  'ai-data-pack.export.status.read',
  'ai-data-pack.export.audit.read',
  'ai-data-pack.export.sync-detail.read',
  'ai-data-pack.export.artifact.download',
  'ai-data-pack.export.artifact.download.cached',
  'ai-data-pack.export.artifact.download.official',
  'ai-data-pack.export.artifact.download.partial',
  'ai-data-pack.export.artifact.download.audit.read',
  'ai-data-pack.profile.director-full',
  'ai-data-pack.profile.director-redacted',
  'ai-data-pack.profile.manager-marketer',
  'ai-data-pack.profile.finance-operator',
  'ai-data-pack.profile.reviewer-partial',
  'ai-data-pack.profile.investor-redacted',
  'ai-data-pack.profile.external-consultant-redacted',
];

const AI_DATA_PACK_EXPORT_MANAGER_PERMISSIONS = [
  'ai-data-pack.export.cached.create',
  'ai-data-pack.export.partial.create',
  'ai-data-pack.export.status.read',
  'ai-data-pack.export.artifact.download',
  'ai-data-pack.export.artifact.download.cached',
  'ai-data-pack.export.artifact.download.partial',
  'ai-data-pack.profile.manager-marketer',
];

const AI_DATA_PACK_EXPORT_INVESTOR_PERMISSIONS = [
  'ai-data-pack.export.status.read',
  'ai-data-pack.profile.investor-redacted',
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [UserRole.DIRECTOR]: [
    'users', 'orders', 'orders-test2', 'pending-orders', 'products', 'product-categories',
    'delivery-status', 'production-status', 'order-status',
    'ad-accounts', 'ad-groups', 'advertising-costs', 'media', 'api-tokens',
    'labor-costs', 'other-costs', 'salary-config',
    'customers', 'purchase-costs', 'fanpages', 'openai-configs',
    'supplier-quotes.approve', 'orders.confirm-business',
    'quotes', 'reports', 'export', 'import', 'settings',
    'ads-budget', 'employee-ads-kpi', 'owner-fund', 'finance', 'finance.budget-buckets.manage',
    'finance.policy.manage', 'finance.loan.manage', 'finance.cashflow.manage',
    'order-update', 'chat-messages', 'ai-assistant',
    'google-ads.read', 'google-ads.plan', 'google-ads.approve', 'google-ads.execute',
    'google-ads.credentials.read', 'google-ads.credentials.write', 'google-ads.emergency-pause',
    'ai-data-pack.director.read', 'ai-data-pack.marketer.read', 'ai-data-pack.quality.read', 'ai-data-pack.mapping.read',
    ...AI_DATA_PACK_EXPORT_DIRECTOR_PERMISSIONS,
  ],
  [UserRole.MANAGER]: [
    'orders-test2', 'pending-orders', 'orders.confirm-business',
    'ad-accounts', 'ad-groups', 'advertising-costs', 'media', 'fanpages',
    'openai-configs', 'ads-budget', 'employee-ads-kpi',
    'chat-messages', 'reports', 'ai-assistant',
    'google-ads.read', 'google-ads.plan',
    'ai-data-pack.marketer.read', 'ai-data-pack.quality.read', 'ai-data-pack.mapping.read',
    ...AI_DATA_PACK_EXPORT_MANAGER_PERMISSIONS,
  ],
  [UserRole.EMPLOYEE]: [
    'orders-test2', 'order-update', 'chat-messages',
  ],
  [UserRole.INTERNAL_AGENT]: ['orders-test2'],
  [UserRole.EXTERNAL_AGENT]: ['orders-test2'],
  [UserRole.INTERNAL_SUPPLIER]: ['orders-test2'],
  [UserRole.EXTERNAL_SUPPLIER]: ['orders-test2'],
  [UserRole.INVESTOR]: [
    'finance',
    'reports',
    'ai-data-pack.director.read',
    'ai-data-pack.quality.read',
    'ai-data-pack.mapping.read',
    ...AI_DATA_PACK_EXPORT_INVESTOR_PERMISSIONS,
  ],
  [UserRole.LENDER]: ['finance'],
};

export function getPermissionsForRole(role?: string): string[] {
  const normalizedRole = String(role || '').toLowerCase();
  return ROLE_PERMISSIONS[normalizedRole] || [];
}
