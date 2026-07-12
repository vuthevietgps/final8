/* eslint-disable no-console */
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

const INDEXES = [
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
];

function same(value, expected) {
  return JSON.stringify(value || {}) === JSON.stringify(expected || {});
}

async function assertNoDuplicateIndexedValues(collection, keys, options) {
  if (!options.unique) return;
  const match = options.partialFilterExpression || {};
  const id = Object.fromEntries(Object.keys(keys).map((key) => [key, `$${key}`]));
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
