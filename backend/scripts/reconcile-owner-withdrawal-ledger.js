#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

function parseArgs(argv) {
  const args = {
    apply: false,
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/htxbachgia',
    dbName: '',
    out: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    switch (value) {
      case '--apply':
        args.apply = true;
        break;
      case '--mongo-uri':
        args.mongoUri = argv[++i];
        break;
      case '--db':
      case '--db-name':
        args.dbName = argv[++i];
        break;
      case '--out':
        args.out = argv[++i];
        break;
      default:
        break;
    }
  }

  return args;
}

function inferDbName(mongoUri, override) {
  if (override) {
    return override;
  }

  try {
    const parsed = new URL(mongoUri);
    const dbName = parsed.pathname.replace(/^\//, '').trim();
    if (dbName) {
      return dbName;
    }
  } catch (_) {}

  return 'htxbachgia';
}

function toDate(value, fallback) {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date;
}

function withdrawalEventDate(withdrawal) {
  const objectIdFallback = ObjectId.isValid(withdrawal._id)
    ? new ObjectId(withdrawal._id).getTimestamp()
    : new Date();
  return toDate(
    withdrawal.completedDate || withdrawal.approvedDate || withdrawal.requestDate || withdrawal.createdAt,
    objectIdFallback,
  );
}

function withdrawalCategory(type) {
  switch (type) {
    case 'emergency':
      return 'withdrawal_emergency';
    case 'advance':
      return 'withdrawal_advance';
    case 'profit_share':
    default:
      return 'withdrawal_profit';
  }
}

function stableKey(doc, date) {
  return `${date.toISOString()}::${String(doc._id || doc.referenceId || '')}`;
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  }
  return map;
}

async function auditDatabase(db) {
  const withdrawals = await db.collection('withdrawals')
    .find({ status: { $in: ['approved', 'completed'] } })
    .sort({ completedDate: 1, approvedDate: 1, requestDate: 1, createdAt: 1, _id: 1 })
    .toArray();

  const ownersById = new Map();
  const ownerIds = [...new Set(withdrawals.map((item) => String(item.ownerId)).filter(Boolean))]
    .filter((value) => ObjectId.isValid(value))
    .map((value) => new ObjectId(value));
  if (ownerIds.length > 0) {
    const owners = await db.collection('owners')
      .find({ _id: { $in: ownerIds } })
      .project({ name: 1, availableBalance: 1, totalWithdrawn: 1 })
      .toArray();
    for (const owner of owners) {
      ownersById.set(String(owner._id), owner);
    }
  }

  const anomalies = [];
  const missing = [];
  const duplicates = [];
  const referenceUpdates = [];

  for (const withdrawal of withdrawals) {
    const rows = await db.collection('fund_transactions')
      .find({ referenceId: String(withdrawal._id), referenceType: 'withdrawal' })
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .toArray();

    const auditRow = {
      withdrawalId: String(withdrawal._id),
      ownerId: String(withdrawal.ownerId),
      ownerName: ownersById.get(String(withdrawal.ownerId))?.name || null,
      status: withdrawal.status,
      amount: withdrawal.amount,
      type: withdrawal.type,
      requestDate: withdrawal.requestDate || null,
      approvedDate: withdrawal.approvedDate || null,
      completedDate: withdrawal.completedDate || null,
      createdAt: withdrawal.createdAt || null,
      transactionReference: withdrawal.transactionReference || null,
      txCount: rows.length,
    };

    if (rows.length === 0) {
      anomalies.push(auditRow);
      missing.push({ withdrawal, auditRow });
      continue;
    }

    if (rows.length > 1) {
      auditRow.rows = rows.map((row) => ({
        _id: String(row._id),
        amount: row.amount,
        type: row.type,
        category: row.category,
        reference: row.reference || null,
        date: row.date || null,
      }));
      anomalies.push(auditRow);
      duplicates.push({ withdrawal, auditRow, rows });
      continue;
    }

    const [row] = rows;
    const desiredReference = withdrawal.transactionReference || `WITHDRAWAL_${String(withdrawal._id)}`;
    if ((row.reference || '') !== desiredReference) {
      referenceUpdates.push({
        withdrawal,
        rowId: String(row._id),
        currentReference: row.reference || null,
        desiredReference,
      });
    }
  }

  const existingRows = await db.collection('fund_transactions')
    .find({
      $expr: {
        $in: [{ $toString: '$ownerId' }, ownerIds],
      },
    })
    .project({ _id: 1, ownerId: 1, type: 1, amount: 1, date: 1, createdAt: 1 })
    .toArray();

  const existingByOwner = groupBy(existingRows, (row) => String(row.ownerId));
  const missingByOwner = groupBy(missing, (row) => String(row.withdrawal.ownerId));
  const balanceAfterByWithdrawalId = new Map();
  const ownersMissingForBalance = [];

  for (const [ownerId, ownerMissingRows] of missingByOwner.entries()) {
    const owner = ownersById.get(ownerId);
    if (!owner) {
      ownersMissingForBalance.push(ownerId);
      continue;
    }

    const existingForOwner = existingByOwner.get(ownerId) || [];
    const eventRows = [];
    for (const row of existingForOwner) {
      const eventDate = toDate(row.date || row.createdAt, new Date());
      eventRows.push({
        kind: 'existing',
        key: stableKey(row, eventDate),
        delta: row.type === 'in' ? row.amount : -row.amount,
        date: eventDate,
      });
    }

    for (const item of ownerMissingRows) {
      const eventDate = withdrawalEventDate(item.withdrawal);
      eventRows.push({
        kind: 'missing',
        key: stableKey(item.withdrawal, eventDate),
        withdrawalId: String(item.withdrawal._id),
        delta: -(item.withdrawal.amount || 0),
        date: eventDate,
      });
    }

    eventRows.sort((left, right) => left.key.localeCompare(right.key));
    const netDelta = eventRows.reduce((sum, item) => sum + item.delta, 0);
    let runningBalance = (owner.availableBalance || 0) - netDelta;

    for (const item of eventRows) {
      runningBalance += item.delta;
      if (item.kind === 'missing') {
        balanceAfterByWithdrawalId.set(item.withdrawalId, runningBalance);
      }
    }
  }

  const totalMissingAmount = missing.reduce((sum, item) => sum + (item.withdrawal.amount || 0), 0);
  return {
    withdrawalsScanned: withdrawals.length,
    anomalyCount: anomalies.length,
    totalMissingAmount,
    missing,
    duplicates,
    referenceUpdates,
    balanceAfterByWithdrawalId,
    ownersMissingForBalance,
  };
}

function buildInsertDocuments(audit, now) {
  return audit.missing.map(({ withdrawal }) => {
    const ownerId = String(withdrawal.ownerId);
    const referenceId = String(withdrawal._id);
    const date = withdrawalEventDate(withdrawal);
    const balanceAfter = audit.balanceAfterByWithdrawalId.get(referenceId);
    const document = {
      ownerId: ObjectId.isValid(ownerId) ? new ObjectId(ownerId) : withdrawal.ownerId,
      type: 'out',
      category: withdrawalCategory(withdrawal.type),
      amount: withdrawal.amount,
      date,
      description: withdrawal.reason || 'Owner withdrawal approved',
      notes: withdrawal.notes || withdrawal.approvalNotes || undefined,
      referenceId,
      reference: withdrawal.transactionReference || `WITHDRAWAL_${referenceId}`,
      referenceType: 'withdrawal',
      createdBy: withdrawal.approvedBy || undefined,
      bankAccount: withdrawal.bankAccount || undefined,
      bankName: withdrawal.bankName || undefined,
      createdAt: now,
      updatedAt: now,
    };
    if (typeof balanceAfter === 'number' && Number.isFinite(balanceAfter)) {
      document.balanceAfter = balanceAfter;
    }
    return document;
  });
}

async function writeOutput(outPath, payload) {
  if (!outPath) {
    return;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbName = inferDbName(args.mongoUri, args.dbName);
  const client = new MongoClient(args.mongoUri);
  const startedAt = new Date();
  await client.connect();

  try {
    const db = client.db(dbName);
    const before = await auditDatabase(db);
    const summary = {
      startedAt: startedAt.toISOString(),
      finishedAt: null,
      mode: args.apply ? 'apply' : 'dry-run',
      mongoUri: args.mongoUri,
      dbName,
      before: {
        withdrawalsScanned: before.withdrawalsScanned,
        anomalyCount: before.anomalyCount,
        missingCount: before.missing.length,
        duplicateCount: before.duplicates.length,
        referenceUpdateCount: before.referenceUpdates.length,
        totalMissingAmount: before.totalMissingAmount,
        ownersMissingForBalance: before.ownersMissingForBalance,
        sampleMissing: before.missing.slice(0, 20).map((item) => item.auditRow),
      },
      apply: {
        attempted: args.apply,
        insertedCount: 0,
        updatedReferenceCount: 0,
        blocked: false,
        blockedReason: null,
      },
      after: null,
    };

    if (args.apply) {
      if (before.duplicates.length > 0) {
        summary.apply.blocked = true;
        summary.apply.blockedReason = 'duplicate_withdrawal_ledger_rows';
      } else {
        const now = new Date();
        const insertDocs = buildInsertDocuments(before, now);
        if (insertDocs.length > 0) {
          const insertResult = await db.collection('fund_transactions').insertMany(insertDocs, { ordered: true });
          summary.apply.insertedCount = Object.keys(insertResult.insertedIds || {}).length;
        }
        for (const item of before.referenceUpdates) {
          await db.collection('fund_transactions').updateOne(
            { _id: new ObjectId(item.rowId) },
            { $set: { reference: item.desiredReference, updatedAt: now } },
          );
          summary.apply.updatedReferenceCount += 1;
        }
      }
    }

    const after = await auditDatabase(db);
    summary.after = {
      withdrawalsScanned: after.withdrawalsScanned,
      anomalyCount: after.anomalyCount,
      missingCount: after.missing.length,
      duplicateCount: after.duplicates.length,
      referenceUpdateCount: after.referenceUpdates.length,
      totalMissingAmount: after.totalMissingAmount,
      ownersMissingForBalance: after.ownersMissingForBalance,
      sampleMissing: after.missing.slice(0, 20).map((item) => item.auditRow),
    };
    summary.finishedAt = new Date().toISOString();

    await writeOutput(args.out, summary);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

    if (summary.apply.blocked) {
      process.exitCode = 2;
      return;
    }
    if (args.apply && summary.after.anomalyCount > 0) {
      process.exitCode = 2;
      return;
    }
    process.exitCode = 0;
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  const payload = {
    startedAt: new Date().toISOString(),
    error: String(error && error.stack ? error.stack : error),
  };
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(1);
});
