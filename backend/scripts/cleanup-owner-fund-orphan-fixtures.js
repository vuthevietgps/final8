#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const FAMILY_MODULE_OWNER_FUND_LOAN = 'module.owner-fund-loan';
const FAMILY_SYNTHETIC_EMERGENCY = 'synthetic.emergency-owner-fund';
const E2E_NOTE_PATTERN = /^E2E owner-fund note \d+$/;
const E2E_REASON_PATTERN = /^E2E owner-fund reason \d+$/;
const TXN_TEST_PATTERN = /^TXN-TEST-/;
const WITHDRAWAL_REFERENCE_PATTERN = /^WITHDRAWAL_/;
const SNAPSHOT_NOTE = 'Snapshot-scoped only. This helper only inspects orphan owner ids present in the provided audit JSON and only recognizes two exact fixture families encoded in this script: the module.owner-fund-loan bundle and a synthetic emergency bundle with explicit E2E-style marker strings. It does not claim that the synthetic emergency bundle came from any current active suite.';

function loadBackendEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    require('dotenv').config({ path: envPath });
  } catch {
    // Optional dependency path; ignore if dotenv is unavailable.
  }
}

function parseArgs(argv) {
  const args = {
    apply: false,
    mongoUri: process.env.MONGODB_URI || '',
    dbName: '',
    out: '',
    auditFile: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
      case '--apply':
        args.apply = true;
        break;
      case '--mongo-uri':
        args.mongoUri = argv[index + 1] || '';
        index += 1;
        break;
      case '--db-name':
        args.dbName = argv[index + 1] || '';
        index += 1;
        break;
      case '--out':
        args.out = argv[index + 1] || '';
        index += 1;
        break;
      case '--audit-file':
        args.auditFile = argv[index + 1] || '';
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${value}`);
    }
  }

  if (!args.mongoUri) {
    throw new Error('Missing --mongo-uri and MONGODB_URI is not set');
  }

  if (!args.auditFile) {
    throw new Error('Missing required --audit-file path');
  }

  return args;
}

function inferDbName(mongoUri, explicitDbName) {
  if (explicitDbName) {
    return explicitDbName;
  }

  try {
    const parsed = new URL(mongoUri);
    return parsed.pathname.replace(/^\//, '') || 'htxbachgia';
  } catch {
    return 'htxbachgia';
  }
}

function isCanonicalObjectIdString(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
}

function toIsoOrNull(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value)));
}

function sortById(rows) {
  return [...rows].sort((left, right) => String(left._id).localeCompare(String(right._id)));
}

function summarizeWithdrawal(row) {
  return {
    id: String(row._id),
    ownerId: row.ownerId === undefined || row.ownerId === null ? null : String(row.ownerId),
    status: row.status || null,
    amount: row.amount === undefined || row.amount === null ? null : row.amount,
    type: row.type || null,
    requestDate: toIsoOrNull(row.requestDate),
    approvedDate: toIsoOrNull(row.approvedDate),
    completedDate: toIsoOrNull(row.completedDate),
    reason: row.reason || null,
    notes: row.notes || null,
    bankAccount: row.bankAccount || null,
    bankName: row.bankName || null,
    bankAccountName: row.bankAccountName || null,
    transactionReference: row.transactionReference || null,
    createdAt: toIsoOrNull(row.createdAt),
    updatedAt: toIsoOrNull(row.updatedAt),
  };
}

function summarizeFundTransaction(row) {
  return {
    id: String(row._id),
    ownerId: row.ownerId === undefined || row.ownerId === null ? null : String(row.ownerId),
    type: row.type || null,
    category: row.category || null,
    amount: row.amount === undefined || row.amount === null ? null : row.amount,
    date: toIsoOrNull(row.date),
    description: row.description || null,
    notes: row.notes || null,
    referenceId: row.referenceId || null,
    reference: row.reference || null,
    referenceType: row.referenceType || null,
    bankAccount: row.bankAccount || null,
    bankName: row.bankName || null,
    createdAt: toIsoOrNull(row.createdAt),
    updatedAt: toIsoOrNull(row.updatedAt),
  };
}

function summarizeOwner(row) {
  return {
    id: String(row._id),
    name: row.name || null,
    email: row.email || null,
    phone: row.phone || null,
    isActive: row.isActive === undefined ? null : Boolean(row.isActive),
    createdAt: toIsoOrNull(row.createdAt),
    updatedAt: toIsoOrNull(row.updatedAt),
  };
}

function ownerIdFilter(ownerId) {
  return {
    $expr: {
      $eq: [{ $toString: '$ownerId' }, ownerId],
    },
  };
}

function ownerPrimaryKeyFilter(ownerId) {
  return {
    $expr: {
      $eq: [{ $toString: '$_id' }, ownerId],
    },
  };
}

function readAuditFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Audit file not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse audit file ${resolved}: ${error.message}`);
  }

  const ownerIds = uniqueStrings([
    ...(Array.isArray(parsed.orphanOwnerIdsSample) ? parsed.orphanOwnerIdsSample : []),
    ...Object.values(parsed.targets || {}).flatMap((target) => (
      Array.isArray(target && target.sampleOrphans)
        ? target.sampleOrphans.map((row) => row && row.ownerId)
        : []
    )),
  ]);

  if (ownerIds.length === 0 && parsed.orphanOwnerIdCount === 0) {
    return {
      file: resolved,
      startedAt: parsed.startedAt || null,
      finishedAt: parsed.finishedAt || null,
      reportedOrphanOwnerIdCount: 0,
      ownerIds: [],
    };
  }

  if (ownerIds.length === 0) {
    throw new Error(
      `Audit file ${resolved} does not contain sampled orphan owner ids from audit-owner-fund-orphan-owners.js`,
    );
  }

  if (
    Number.isFinite(parsed.orphanOwnerIdCount)
    && parsed.orphanOwnerIdCount > ownerIds.length
  ) {
    throw new Error(
      `Audit file ${resolved} is incomplete for cleanup: reported orphan count is ${parsed.orphanOwnerIdCount}, but only ${ownerIds.length} owner ids were present in the audit payload. Re-run the audit with a larger --sample-limit before cleanup.`,
    );
  }

  return {
    file: resolved,
    startedAt: parsed.startedAt || null,
    finishedAt: parsed.finishedAt || null,
    reportedOrphanOwnerIdCount: Number.isFinite(parsed.orphanOwnerIdCount)
      ? parsed.orphanOwnerIdCount
      : null,
    ownerIds,
  };
}

async function loadCluster(db, ownerId) {
  const owners = await db.collection('owners')
    .find(ownerPrimaryKeyFilter(ownerId))
    .project({ _id: 1, name: 1, email: 1, phone: 1, isActive: 1, createdAt: 1, updatedAt: 1 })
    .toArray();

  const withdrawals = await db.collection('withdrawals')
    .find(ownerIdFilter(ownerId))
    .sort({ createdAt: 1, requestDate: 1, approvedDate: 1, completedDate: 1, _id: 1 })
    .toArray();

  const fundTransactions = await db.collection('fund_transactions')
    .find(ownerIdFilter(ownerId))
    .sort({ createdAt: 1, date: 1, _id: 1 })
    .toArray();

  return {
    ownerId,
    owners,
    withdrawals,
    fundTransactions,
  };
}

function matchModuleOwnerFundLoanBundle(withdrawals, fundTransactions) {
  const reasons = [];

  if (withdrawals.length !== 3) {
    reasons.push(`expected exactly 3 withdrawals, found ${withdrawals.length}`);
  }

  if (fundTransactions.length !== 2) {
    reasons.push(`expected exactly 2 fund_transactions, found ${fundTransactions.length}`);
  }

  const completedProfitRows = withdrawals.filter((row) => (
    row.status === 'completed'
    && row.type === 'profit_share'
    && row.amount === 5000000
    && row.bankAccount === '1234567890'
    && row.bankName === 'Vietcombank'
  ));
  if (completedProfitRows.length !== 1) {
    reasons.push(`expected exactly 1 completed profit_share withdrawal for 5000000, found ${completedProfitRows.length}`);
  }

  const rejectedEmergencyRows = withdrawals.filter((row) => (
    row.status === 'rejected'
    && row.type === 'emergency'
    && row.amount === 3000000
  ));
  if (rejectedEmergencyRows.length !== 1) {
    reasons.push(`expected exactly 1 rejected emergency withdrawal for 3000000, found ${rejectedEmergencyRows.length}`);
  }

  const cancelledAdvanceRows = withdrawals.filter((row) => (
    row.status === 'cancelled'
    && row.type === 'advance'
    && row.amount === 2000000
  ));
  if (cancelledAdvanceRows.length !== 1) {
    reasons.push(`expected exactly 1 cancelled advance withdrawal for 2000000, found ${cancelledAdvanceRows.length}`);
  }

  const capitalInRows = fundTransactions.filter((row) => (
    row.type === 'in'
    && row.category === 'capital_contribution'
    && row.amount === 50000000
    && row.description === 'Initial capital deposit for test'
  ));
  if (capitalInRows.length !== 1) {
    reasons.push(`expected exactly 1 capital_contribution transaction for 50000000, found ${capitalInRows.length}`);
  }

  const profitOutRows = fundTransactions.filter((row) => (
    row.type === 'out'
    && row.category === 'withdrawal_profit'
    && row.amount === 5000000
    && row.description === 'Rut loi nhuan thang 2'
    && row.notes === 'Approved by test'
    && TXN_TEST_PATTERN.test(row.reference || '')
  ));
  if (profitOutRows.length !== 1) {
    reasons.push(`expected exactly 1 withdrawal_profit fixture transaction, found ${profitOutRows.length}`);
  }

  if (reasons.length > 0) {
    return {
      matched: false,
      reasons,
    };
  }

  const completedProfit = completedProfitRows[0];
  const profitOut = profitOutRows[0];

  if ((profitOut.referenceId || '') !== String(completedProfit._id)) {
    reasons.push('profit withdrawal transaction referenceId does not match the completed withdrawal id');
  }

  if (reasons.length > 0) {
    return {
      matched: false,
      reasons,
    };
  }

  const orderedWithdrawals = sortById([
    completedProfitRows[0],
    rejectedEmergencyRows[0],
    cancelledAdvanceRows[0],
  ]);
  const orderedFundTransactions = sortById([
    capitalInRows[0],
    profitOutRows[0],
  ]);

  return {
    matched: true,
    family: FAMILY_MODULE_OWNER_FUND_LOAN,
    withdrawals: orderedWithdrawals,
    fundTransactions: orderedFundTransactions,
  };
}

function extractTrailingNumber(value, prefix) {
  if (typeof value !== 'string') {
    return null;
  }

  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = value.match(new RegExp(`^${escapedPrefix}(\\d+)$`));
  return match ? match[1] : null;
}

function matchSyntheticEmergencyBundle(withdrawals, fundTransactions) {
  const reasons = [];

  if (withdrawals.length !== 1) {
    reasons.push(`expected exactly 1 withdrawal, found ${withdrawals.length}`);
  }

  if (fundTransactions.length !== 1) {
    reasons.push(`expected exactly 1 fund_transaction, found ${fundTransactions.length}`);
  }

  const withdrawalRows = withdrawals.filter((row) => (
    row.status === 'completed'
    && row.type === 'emergency'
    && row.amount === 120000
    && E2E_NOTE_PATTERN.test(row.notes || '')
  ));
  if (withdrawalRows.length !== 1) {
    reasons.push(`expected exactly 1 completed emergency withdrawal for 120000 with E2E note pattern, found ${withdrawalRows.length}`);
  }

  const transactionRows = fundTransactions.filter((row) => (
    row.type === 'out'
    && row.category === 'withdrawal_emergency'
    && row.amount === 120000
    && E2E_REASON_PATTERN.test(row.description || '')
    && E2E_NOTE_PATTERN.test(row.notes || '')
    && WITHDRAWAL_REFERENCE_PATTERN.test(row.reference || '')
  ));
  if (transactionRows.length !== 1) {
    reasons.push(`expected exactly 1 withdrawal_emergency fixture transaction, found ${transactionRows.length}`);
  }

  if (reasons.length > 0) {
    return {
      matched: false,
      reasons,
    };
  }

  const withdrawal = withdrawalRows[0];
  const transaction = transactionRows[0];
  const withdrawalNoteSuffix = extractTrailingNumber(withdrawal.notes, 'E2E owner-fund note ');
  const transactionNoteSuffix = extractTrailingNumber(transaction.notes, 'E2E owner-fund note ');
  const transactionReasonSuffix = extractTrailingNumber(transaction.description, 'E2E owner-fund reason ');

  if ((transaction.referenceId || '') !== String(withdrawal._id)) {
    reasons.push('E2E fund transaction referenceId does not match the withdrawal id');
  }

  if ((withdrawal.notes || '') !== (transaction.notes || '')) {
    reasons.push('E2E withdrawal notes and fund transaction notes do not match exactly');
  }

  if (!withdrawalNoteSuffix || withdrawalNoteSuffix !== transactionNoteSuffix || withdrawalNoteSuffix !== transactionReasonSuffix) {
    reasons.push('E2E note and reason suffixes do not align on the same generated value');
  }

  if (reasons.length > 0) {
    return {
      matched: false,
      reasons,
    };
  }

  return {
    matched: true,
    family: FAMILY_SYNTHETIC_EMERGENCY,
    withdrawals: [withdrawal],
    fundTransactions: [transaction],
  };
}

function buildCandidateSummary(cluster, familyMatch) {
  return {
    ownerId: cluster.ownerId,
    family: familyMatch.family,
    ownersFound: 0,
    withdrawals: familyMatch.withdrawals.map(summarizeWithdrawal),
    fundTransactions: familyMatch.fundTransactions.map(summarizeFundTransaction),
    candidateDocumentIds: {
      withdrawals: familyMatch.withdrawals.map((row) => String(row._id)),
      fund_transactions: familyMatch.fundTransactions.map((row) => String(row._id)),
    },
    candidateDocCount: {
      withdrawals: familyMatch.withdrawals.length,
      fund_transactions: familyMatch.fundTransactions.length,
      total: familyMatch.withdrawals.length + familyMatch.fundTransactions.length,
    },
  };
}

function classifyCluster(cluster) {
  if (cluster.owners.length > 0) {
    return {
      status: 'blocked',
      ownerId: cluster.ownerId,
      reason: 'owner_record_exists',
      owners: cluster.owners.map(summarizeOwner),
      withdrawals: cluster.withdrawals.map(summarizeWithdrawal),
      fundTransactions: cluster.fundTransactions.map(summarizeFundTransaction),
    };
  }

  const moduleMatch = matchModuleOwnerFundLoanBundle(cluster.withdrawals, cluster.fundTransactions);
  if (moduleMatch.matched) {
    return {
      status: 'eligible',
      ...buildCandidateSummary(cluster, moduleMatch),
    };
  }

  const syntheticEmergencyMatch = matchSyntheticEmergencyBundle(
    cluster.withdrawals,
    cluster.fundTransactions,
  );
  if (syntheticEmergencyMatch.matched) {
    return {
      status: 'eligible',
      ...buildCandidateSummary(cluster, syntheticEmergencyMatch),
    };
  }

  return {
    status: 'unknown',
    ownerId: cluster.ownerId,
    reason: 'unrecognized_fixture_cluster',
    withdrawals: cluster.withdrawals.map(summarizeWithdrawal),
    fundTransactions: cluster.fundTransactions.map(summarizeFundTransaction),
    recognition: {
      [FAMILY_MODULE_OWNER_FUND_LOAN]: moduleMatch.reasons,
      [FAMILY_SYNTHETIC_EMERGENCY]: syntheticEmergencyMatch.reasons,
    },
  };
}

function toObjectIds(ids) {
  return ids.map((id) => {
    if (!isCanonicalObjectIdString(id)) {
      throw new Error(`Expected canonical ObjectId string but received: ${id}`);
    }
    return new ObjectId(id);
  });
}

async function deleteEligibleClusters(db, eligibleClusters) {
  const withdrawalIds = eligibleClusters.flatMap((cluster) => cluster.candidateDocumentIds.withdrawals);
  const fundTransactionIds = eligibleClusters.flatMap((cluster) => cluster.candidateDocumentIds.fund_transactions);
  const expectedWithdrawalCount = withdrawalIds.length;
  const expectedFundTransactionCount = fundTransactionIds.length;

  let deletedFundTransactions = 0;
  if (fundTransactionIds.length > 0) {
    const fundTransactionResult = await db.collection('fund_transactions').deleteMany({
      _id: { $in: toObjectIds(fundTransactionIds) },
    });
    deletedFundTransactions = fundTransactionResult.deletedCount || 0;
    if (deletedFundTransactions !== expectedFundTransactionCount) {
      throw new Error(
        `Deleted ${deletedFundTransactions}/${expectedFundTransactionCount} expected fund_transactions documents`,
      );
    }
  }

  let deletedWithdrawals = 0;
  if (withdrawalIds.length > 0) {
    const withdrawalResult = await db.collection('withdrawals').deleteMany({
      _id: { $in: toObjectIds(withdrawalIds) },
    });
    deletedWithdrawals = withdrawalResult.deletedCount || 0;
    if (deletedWithdrawals !== expectedWithdrawalCount) {
      throw new Error(
        `Deleted ${deletedWithdrawals}/${expectedWithdrawalCount} expected withdrawals documents`,
      );
    }
  }

  return {
    withdrawals: deletedWithdrawals,
    fund_transactions: deletedFundTransactions,
    total: deletedWithdrawals + deletedFundTransactions,
  };
}

async function writeOutput(outPath, payload) {
  if (!outPath) {
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  loadBackendEnv();
  const args = parseArgs(process.argv.slice(2));
  const audit = readAuditFile(args.auditFile);
  const dbName = inferDbName(args.mongoUri, args.dbName);
  const client = new MongoClient(args.mongoUri);
  const startedAt = new Date();

  await client.connect();

  try {
    const db = client.db(dbName);
    const classifiedClusters = [];

    for (const ownerId of audit.ownerIds) {
      // eslint-disable-next-line no-await-in-loop
      const cluster = await loadCluster(db, ownerId);
      classifiedClusters.push(classifyCluster(cluster));
    }

    const eligibleClusters = classifiedClusters.filter((cluster) => cluster.status === 'eligible');
    const blockedClusters = classifiedClusters.filter((cluster) => cluster.status === 'blocked');
    const unknownClusters = classifiedClusters.filter((cluster) => cluster.status === 'unknown');

    const familyCounts = {
      [FAMILY_MODULE_OWNER_FUND_LOAN]: eligibleClusters.filter((cluster) => cluster.family === FAMILY_MODULE_OWNER_FUND_LOAN).length,
      [FAMILY_SYNTHETIC_EMERGENCY]: eligibleClusters.filter(
        (cluster) => cluster.family === FAMILY_SYNTHETIC_EMERGENCY,
      ).length,
    };

    const totalCandidateDocs = {
      withdrawals: eligibleClusters.reduce((sum, cluster) => sum + cluster.candidateDocCount.withdrawals, 0),
      fund_transactions: eligibleClusters.reduce((sum, cluster) => sum + cluster.candidateDocCount.fund_transactions, 0),
      total: eligibleClusters.reduce((sum, cluster) => sum + cluster.candidateDocCount.total, 0),
    };

    const summary = {
      startedAt: startedAt.toISOString(),
      finishedAt: null,
      mode: args.apply ? 'apply' : 'dry-run',
      mongoUri: args.mongoUri,
      dbName,
      audit: {
        file: audit.file,
        startedAt: audit.startedAt,
        finishedAt: audit.finishedAt,
        reportedOrphanOwnerIdCount: audit.reportedOrphanOwnerIdCount,
        loadedOwnerIdsFromAudit: audit.ownerIds.length,
        ownerIds: audit.ownerIds,
      },
      note: SNAPSHOT_NOTE,
      counts: {
        eligibleClusters: eligibleClusters.length,
        blockedClusters: blockedClusters.length,
        unknownClusters: unknownClusters.length,
        byFamily: familyCounts,
        totalCandidateDocs,
      },
      eligibleClusters,
      blockedClusters,
      unknownClusters,
      apply: {
        attempted: args.apply,
        blocked: false,
        blockedReason: null,
        deleted: {
          withdrawals: 0,
          fund_transactions: 0,
          total: 0,
        },
      },
    };

    if (args.apply && (blockedClusters.length > 0 || unknownClusters.length > 0)) {
      summary.apply.blocked = true;
      summary.apply.blockedReason = 'blocked_or_unknown_clusters_present';
    }

    if (args.apply && !summary.apply.blocked) {
      summary.apply.deleted = await deleteEligibleClusters(db, eligibleClusters);
    }

    summary.finishedAt = new Date().toISOString();
    await writeOutput(args.out, summary);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

    if (summary.apply.blocked) {
      process.exitCode = 2;
      return;
    }

    process.exitCode = 0;
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
});
