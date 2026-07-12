#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const TARGETS = [
  { collection: 'withdrawals', field: 'ownerId' },
  { collection: 'fund_transactions', field: 'ownerId' },
];

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
    mongoUri: process.env.MONGODB_URI || '',
    dbName: '',
    out: '',
    sampleLimit: 20,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    switch (value) {
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
      case '--sample-limit':
        args.sampleLimit = Number.parseInt(argv[index + 1] || '20', 10);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${value}`);
    }
  }

  if (!args.mongoUri) {
    throw new Error('Missing --mongo-uri and MONGODB_URI is not set');
  }

  if (!Number.isFinite(args.sampleLimit) || args.sampleLimit <= 0) {
    throw new Error(`Invalid --sample-limit value: ${args.sampleLimit}`);
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

async function loadOwnerIds(db) {
  const rows = await db.collection('owners')
    .find({}, { projection: { _id: 1 } })
    .toArray();

  return new Set(rows.map((row) => String(row._id)));
}

async function countDocuments(db, collection) {
  return db.collection(collection).countDocuments({});
}

async function auditTarget(db, ownerIds, target, sampleLimit) {
  const { collection, field } = target;
  const rows = await db.collection(collection).aggregate([
    { $match: { [field]: { $exists: true, $ne: null } } },
    { $project: { ownerIdString: { $toString: `$${field}` } } },
    { $group: { _id: '$ownerIdString', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]).toArray();

  const orphanRows = rows.filter((row) => !ownerIds.has(row._id));
  const orphanIds = orphanRows.map((row) => row._id);

  let sampleDocuments = [];
  if (orphanIds.length > 0) {
    sampleDocuments = await db.collection(collection).aggregate([
      { $match: { [field]: { $exists: true, $ne: null } } },
      { $addFields: { ownerIdString: { $toString: `$${field}` } } },
      { $match: { ownerIdString: { $in: orphanIds.slice(0, sampleLimit) } } },
      { $sort: { ownerIdString: 1, createdAt: -1, date: -1, requestDate: -1 } },
      { $limit: sampleLimit },
      {
        $project: {
          _id: 1,
          ownerIdString: 1,
          status: 1,
          amount: 1,
          type: 1,
          category: 1,
          requestDate: 1,
          approvedDate: 1,
          completedDate: 1,
          date: 1,
          referenceId: 1,
          reference: 1,
          referenceType: 1,
          description: 1,
          bankAccount: 1,
          bankName: 1,
          bankAccountName: 1,
          notes: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]).toArray();
  }

  return {
    collection,
    field,
    totalDistinctOwnerRefs: rows.length,
    orphanDistinctOwnerRefs: orphanRows.length,
    orphanDocumentCount: orphanRows.reduce((sum, row) => sum + row.count, 0),
    sampleOrphans: orphanRows.slice(0, sampleLimit).map((row) => ({
      ownerId: row._id,
      count: row.count,
    })),
    sampleDocuments: sampleDocuments.map((row) => ({
      id: String(row._id),
      ownerId: row.ownerIdString,
      status: row.status || null,
      amount: row.amount || null,
      type: row.type || null,
      category: row.category || null,
      requestDate: row.requestDate || null,
      approvedDate: row.approvedDate || null,
      completedDate: row.completedDate || null,
      date: row.date || null,
      referenceId: row.referenceId || null,
      reference: row.reference || null,
      referenceType: row.referenceType || null,
      description: row.description || null,
      bankAccount: row.bankAccount || null,
      bankName: row.bankName || null,
      bankAccountName: row.bankAccountName || null,
      notes: row.notes || null,
      createdAt: row.createdAt || null,
      updatedAt: row.updatedAt || null,
    })),
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
  const dbName = inferDbName(args.mongoUri, args.dbName);
  const client = new MongoClient(args.mongoUri);
  const startedAt = new Date();
  await client.connect();

  try {
    const db = client.db(dbName);
    const ownerIds = await loadOwnerIds(db);
    const targetSummaries = [];

    for (const target of TARGETS) {
      // eslint-disable-next-line no-await-in-loop
      targetSummaries.push(await auditTarget(db, ownerIds, target, args.sampleLimit));
    }

    const orphanOwnerIds = Array.from(new Set(
      targetSummaries.flatMap((summary) => summary.sampleOrphans.map((row) => row.ownerId)),
    ));

    const result = {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      mongoUri: args.mongoUri,
      dbName,
      ownersTotal: await countDocuments(db, 'owners'),
      orphanOwnerIdCount: Array.from(new Set(
        targetSummaries.flatMap((summary) => summary.sampleOrphans.map((row) => row.ownerId)),
      )).length,
      orphanOwnerIdsSample: orphanOwnerIds.slice(0, args.sampleLimit),
      targets: Object.fromEntries(targetSummaries.map((summary) => [
        summary.collection,
        {
          field: summary.field,
          totalDistinctOwnerRefs: summary.totalDistinctOwnerRefs,
          orphanDistinctOwnerRefs: summary.orphanDistinctOwnerRefs,
          orphanDocumentCount: summary.orphanDocumentCount,
          sampleOrphans: summary.sampleOrphans,
          sampleDocuments: summary.sampleDocuments,
        },
      ])),
      note: 'Audit only. No owner records are reconstructed because child rows do not contain authoritative owner identity fields.',
    };

    await writeOutput(args.out, result);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
});
