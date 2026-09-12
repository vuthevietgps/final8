/* eslint-disable no-console */
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

const INDEXES = [
  ['ads_cost_refresh_jobs', { day: 1 }, { unique: true, name: 'uniq_ads_cost_refresh_day' }],
  ['ads_daily_spendings', { date: 1, snapshotId: 1 }, { unique: true, name: 'date_1_snapshotId_1' }],
  ['ad_group_daily_reports', { date: 1, adGroupId: 1 }, { unique: true, name: 'date_1_adGroupId_1' }],
  [
    'provider_connections',
    { kind: 1, scope: 1 },
    { unique: true, name: 'uniq_provider_connection_kind_scope' },
  ],
  [
    'provider_connections',
    { kind: 1, state: 1 },
    { name: 'idx_provider_connection_kind_state' },
  ],
  [
    'windsor_ads_resources',
    { connectionId: 1, resourceType: 1, accountId: 1, providerId: 1 },
    { unique: true, name: 'uniq_windsor_ads_resource_scope' },
  ],
  [
    'windsor_ads_daily_metrics',
    { connectionId: 1, date: 1, accountId: 1, campaignId: 1, adGroupId: 1 },
    { unique: true, name: 'uniq_windsor_ads_daily_metric_scope' },
  ],
  [
    'windsor_ads_daily_metrics',
    { connectionId: 1, lastSyncRunId: 1, date: 1 },
    { name: 'idx_windsor_ads_daily_metric_run_materialization' },
  ],
  [
    'windsor_ads_sync_runs',
    { runId: 1 },
    { unique: true, name: 'uniq_windsor_ads_sync_run_id' },
  ],
  [
    'advertisingcosts',
    { channel: 1, customerId: 1, adGroupId: 1, date: 1 },
    { unique: true, name: 'uniq_channel_customer_adGroup_date' },
  ],
  [
    'advertisingcosts',
    { sourceSystem: 1, sourceConnectionId: 1, date: -1 },
    { name: 'idx_advertising_cost_source_connection_date' },
  ],
  ['system_settings', { key: 1 }, { unique: true, name: 'uniq_system_settings_key' }],
  [
    'cashflow_summary_snapshots',
    { domain: 1, windowDays: 1 },
    { unique: true, name: 'uniq_cashflow_snapshot_domain_window' },
  ],
  [
    'cashflowentries',
    { idempotencyKey: 1 },
    {
      unique: true,
      partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      name: 'uniq_cashflow_idempotency_key',
    },
  ],
  [
    'loan_payments',
    { idempotencyKey: 1 },
    {
      unique: true,
      partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      name: 'uniq_loan_payment_idempotency_key',
    },
  ],
  [
    'loan_payments',
    { repaymentId: 1 },
    {
      unique: true,
      partialFilterExpression: { repaymentId: { $type: 'objectId' } },
      name: 'uniq_loan_payment_repayment',
    },
  ],
  [
    'fund_transactions',
    { idempotencyKey: 1 },
    {
      unique: true,
      partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      name: 'uniq_fund_transaction_idempotency_key',
    },
  ],
  [
    'owner_fund_accounts',
    { isActive: 1 },
    {
      unique: true,
      partialFilterExpression: { isActive: true },
      name: 'uniq_owner_fund_active_account',
    },
  ],
  [
    'google_ads_action_execution_logs',
    { idempotencyKey: 1 },
    {
      unique: true,
      partialFilterExpression: { idempotencyReserved: true },
      name: 'uniq_google_ads_reserved_idempotency_key',
    },
  ],
  [
    'google_ads_financial_execution_leases',
    { scope: 1 },
    { unique: true, name: 'uniq_google_ads_financial_execution_lease_scope' },
  ],
  [
    'google_ads_bidding_lifecycles',
    { customerId: 1, campaignId: 1 },
    { unique: true, name: 'uniq_google_ads_bidding_lifecycle_campaign' },
  ],
  [
    'google_ads_conversion_actions',
    { customerId: 1, conversionActionId: 1 },
    {
      unique: true,
      name: 'uniq_google_ads_conversion_action_customer_action',
    },
  ],
  [
    'google_ads_campaign_conversion_goals',
    { customerId: 1, campaignId: 1, category: 1, origin: 1 },
    { unique: true, name: 'uniq_google_ads_campaign_conversion_goal' },
  ],
  [
    'google_ads_conversion_goal_campaign_configs',
    { customerId: 1, campaignId: 1 },
    {
      unique: true,
      name: 'uniq_google_ads_conversion_goal_campaign_config',
    },
  ],
  [
    'meta_ads_action_plans',
    { planId: 1 },
    { unique: true, name: 'uniq_meta_ads_action_plan_id' },
  ],
  [
    'meta_ads_action_plans',
    { 'actions.actionId': 1 },
    { unique: true, name: 'uniq_meta_ads_action_id' },
  ],
  [
    'meta_ads_action_plans',
    { 'actions.idempotencyKey': 1 },
    { unique: true, name: 'uniq_meta_ads_action_idempotency_key' },
  ],
  [
    'meta_ads_execution_reservations',
    { idempotencyKey: 1 },
    { unique: true, name: 'uniq_meta_ads_execution_reservation_idempotency_key' },
  ],
  [
    'meta_ads_campaigns',
    { adAccountId: 1, campaignId: 1 },
    { unique: true, name: 'uniq_meta_ads_campaign_account_campaign' },
  ],
  [
    'meta_ads_ad_sets',
    { adAccountId: 1, adSetId: 1 },
    { unique: true, name: 'uniq_meta_ads_ad_set_account_ad_set' },
  ],
  [
    'meta_ads_ad_sets',
    { adAccountId: 1, campaignId: 1, status: 1, lastReadbackAt: -1 },
    { name: 'idx_meta_ads_ad_set_campaign_status_readback' },
  ],
  [
    'meta_ads_ad_creatives',
    { adAccountId: 1, creativeId: 1 },
    { unique: true, name: 'uniq_meta_ads_ad_creative_account_creative' },
  ],
  [
    'meta_ads_ad_creatives',
    { adAccountId: 1, lastReadbackAt: -1 },
    { name: 'idx_meta_ads_ad_creative_account_readback' },
  ],
  [
    'meta_ads_ads',
    { adAccountId: 1, adId: 1 },
    { unique: true, name: 'uniq_meta_ads_ad_account_ad' },
  ],
  [
    'meta_ads_ads',
    { adAccountId: 1, adSetId: 1, status: 1, lastReadbackAt: -1 },
    { name: 'idx_meta_ads_ad_ad_set_status_readback' },
  ],
  [
    'meta_ads_financial_execution_leases',
    { scope: 1 },
    { unique: true, name: 'uniq_meta_ads_financial_execution_lease_scope' },
  ],
  [
    'meta_ads_financial_execution_leases',
    { scope: 1, status: 1, leaseExpiresAt: 1 },
    { name: 'idx_meta_ads_financial_execution_lease' },
  ],
];

function same(value, expected) {
  return JSON.stringify(value || {}) === JSON.stringify(expected || {});
}

async function assertNoDuplicateIndexedValues(collection, keys, options) {
  if (!options.unique) return;
  const match = options.partialFilterExpression || {};
  // Aggregation object keys cannot contain dots. Preserve the indexed field
  // expression, but use a safe alias for nested paths such as actions.actionId.
  const id = Object.fromEntries(Object.keys(keys).map((key, position) => [`key${position}`, `$${key}`]));
  const duplicates = await collection.aggregate([
    { $match: match },
    { $group: { _id: id, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  ]).toArray();
  if (duplicates.length) {
    throw new Error(`duplicate data blocks unique index ${options.name}`);
  }
}

async function main() {
  const uri = String(process.env.MONGODB_URI || '').trim();
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 2,
  });
  try {
    const db = mongoose.connection.db;
    let missingCount = 0;
    for (const [collectionName, keys, options] of INDEXES) {
      const collection = db.collection(collectionName);
      let current = [];
      try {
        current = await collection.indexes();
      } catch (error) {
        if (error?.codeName !== 'NamespaceNotFound') throw error;
      }
      const ready = current.some((index) => (
        same(index.key, keys)
        && Boolean(index.unique) === Boolean(options.unique)
        && same(index.partialFilterExpression, options.partialFilterExpression)
      ));
      if (ready) {
        console.log(`[OK] ${collectionName}.${options.name}`);
        continue;
      }
      console.log(`[MISSING] ${collectionName}.${options.name}`);
      missingCount += 1;
      if (!APPLY) continue;
      await assertNoDuplicateIndexedValues(collection, keys, options);
      await collection.createIndex(keys, options);
      console.log(`[CREATED] ${collectionName}.${options.name}`);
    }
    if (missingCount && !APPLY) {
      throw new Error(`${missingCount} required production indexes are missing`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  const safeMessage = String(error?.message || 'unknown error')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[REDACTED_MONGODB_URI]')
    .replace(/[^\s/:]+:[^\s@/]+@/g, '[REDACTED_CREDENTIAL]@');
  console.error(`[INDEX_READINESS_FAILED] ${safeMessage}`);
  process.exitCode = 1;
});
