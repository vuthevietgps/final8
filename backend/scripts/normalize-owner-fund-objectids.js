#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const TARGETS = [
  { collection: 'withdrawals', field: 'ownerId' },
  { collection: 'withdrawals', field: 'approvedBy' },
  { collection: 'fund_transactions', field: 'ownerId' },
  { collection: 'fund_transactions', field: 'createdBy' },
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
    apply: false,
    mongoUri: process.env.MONGODB_URI || '',
    dbName: '',
    out: '',
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
      default:
        throw new Error(`Unknown argument: ${value}`);
    }
  }

  if (!args.mongoUri) {
    throw new Error('Missing --mongo-uri and MONGODB_URI is not set');
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

async function countDocuments(db, collection) {
  return db.collection(collection).countDocuments({});
}

async function typeBreakdown(db, collection, field) {
  const rows = await db.collection(collection).aggregate([
    { $match: { [field]: { $exists: true, $ne: null } } },
    { $project: { type: { $type: `$${field}` } } },
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();

  return rows.map((row) => ({
    type: row._id,
    count: row.count,
  }));
}

async function sampleUnexpectedTypes(db, collection, field) {
  const rows = await db.collection(collection).aggregate([
    { $match: { [field]: { $exists: true, $ne: null } } },
    { $project: { [field]: 1, valueType: { $type: `$${field}` } } },
    { $match: { valueType: { $nin: ['string', 'objectId'] } } },
    { $limit: 20 },
  ]).toArray();

  return rows.map((row) => ({
    id: String(row._id),
    type: row.valueType,
    value: row[field],
  }));
}

async function auditField(db, target) {
  const { collection, field } = target;
  const breakdown = await typeBreakdown(db, collection, field);
  const stringRows = await db.collection(collection)
    .find({ [field]: { $type: 'string' } })
    .project({ _id: 1, [field]: 1 })
    .toArray();

  const convertible = [];
  const invalid = [];

  for (const row of stringRows) {
    const value = row[field];
    if (isCanonicalObjectIdString(value)) {
      convertible.push({
        id: String(row._id),
        value,
      });
    } else {
      invalid.push({
        id: String(row._id),
        value,
      });
    }
  }

  const unexpectedTypeBreakdown = breakdown.filter((row) => !['string', 'objectId'].includes(row.type));
  const unexpectedTypeCount = unexpectedTypeBreakdown.reduce((sum, row) => sum + row.count, 0);
  const sampleUnexpectedTypesRows = unexpectedTypeCount > 0
    ? await sampleUnexpectedTypes(db, collection, field)
    : [];

  return {
    collection,
    field,
    typeBreakdown: breakdown,
    stringCount: stringRows.length,
    objectIdCount: breakdown.find((row) => row.type === 'objectId')?.count || 0,
    convertibleCount: convertible.length,
    invalidCount: invalid.length,
    unexpectedTypeBreakdown,
    unexpectedTypeCount,
    convertibleRows: convertible,
    sampleConvertible: convertible.slice(0, 20),
    sampleInvalid: invalid.slice(0, 20),
    sampleUnexpectedTypes: sampleUnexpectedTypesRows,
  };
}

async function auditDatabase(db) {
  const fieldAudits = [];
  for (const target of TARGETS) {
    // eslint-disable-next-line no-await-in-loop
    fieldAudits.push(await auditField(db, target));
  }

  const blockers = fieldAudits
    .filter((field) => field.invalidCount > 0 || field.unexpectedTypeCount > 0)
    .map((field) => {
      const blocker = {
        collection: field.collection,
        field: field.field,
      };

      if (field.invalidCount > 0) {
        blocker.invalidCount = field.invalidCount;
        blocker.sampleInvalid = field.sampleInvalid;
      }

      if (field.unexpectedTypeCount > 0) {
        blocker.unexpectedTypeCount = field.unexpectedTypeCount;
        blocker.unexpectedTypeBreakdown = field.unexpectedTypeBreakdown;
        blocker.sampleUnexpectedTypes = field.sampleUnexpectedTypes;
      }

      return blocker;
    });

  return {
    collections: {
      withdrawals: {
        total: await countDocuments(db, 'withdrawals'),
      },
      fund_transactions: {
        total: await countDocuments(db, 'fund_transactions'),
      },
    },
    fields: fieldAudits,
    blockers,
  };
}

function buildBulkOperations(fieldAudit) {
  const { field, convertibleCount, convertibleRows } = fieldAudit;
  if (convertibleCount === 0) {
    return [];
  }

  return convertibleRows.map((row) => ({
    updateOne: {
      filter: {
        _id: new ObjectId(row.id),
        [field]: row.value,
      },
      update: {
        $set: {
          [field]: new ObjectId(row.value),
        },
      },
    },
  }));
}

async function applyNormalization(db, audit) {
  const summary = {
    totalUpdatedCount: 0,
    fields: [],
  };

  for (const fieldAudit of audit.fields) {
    const operations = buildBulkOperations(fieldAudit);
    let modifiedCount = 0;

    if (operations.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      const result = await db.collection(fieldAudit.collection).bulkWrite(operations, { ordered: true });
      modifiedCount = result.modifiedCount || 0;
      summary.totalUpdatedCount += modifiedCount;
    }

    summary.fields.push({
      collection: fieldAudit.collection,
      field: fieldAudit.field,
      candidateCount: fieldAudit.convertibleCount,
      updatedCount: modifiedCount,
      invalidCount: fieldAudit.invalidCount,
    });
  }

  return summary;
}

function summarizeFields(fields) {
  const output = {};
  for (const field of fields) {
    output[`${field.collection}.${field.field}`] = {
      typeBreakdown: field.typeBreakdown,
      stringCount: field.stringCount,
      objectIdCount: field.objectIdCount,
      convertibleCount: field.convertibleCount,
      invalidCount: field.invalidCount,
      unexpectedTypeBreakdown: field.unexpectedTypeBreakdown,
      unexpectedTypeCount: field.unexpectedTypeCount,
      sampleConvertible: field.sampleConvertible,
      sampleInvalid: field.sampleInvalid,
      sampleUnexpectedTypes: field.sampleUnexpectedTypes,
    };
  }
  return output;
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
    const before = await auditDatabase(db);
    const summary = {
      startedAt: startedAt.toISOString(),
      finishedAt: null,
      mode: args.apply ? 'apply' : 'dry-run',
      mongoUri: args.mongoUri,
      dbName,
      before: {
        collections: before.collections,
        fields: summarizeFields(before.fields),
        blockerCount: before.blockers.length,
        blockers: before.blockers,
      },
      apply: {
        attempted: args.apply,
        blocked: false,
        blockedReason: null,
        totalUpdatedCount: 0,
        fields: [],
      },
      after: null,
    };

    if (before.blockers.length > 0) {
      summary.apply.blocked = true;
      summary.apply.blockedReason = 'invalid_objectid_strings_present';
    }

    if (args.apply && !summary.apply.blocked) {
      summary.apply = {
        ...summary.apply,
        ...(await applyNormalization(db, before)),
      };
    }

    const after = await auditDatabase(db);
    summary.after = {
      collections: after.collections,
      fields: summarizeFields(after.fields),
      blockerCount: after.blockers.length,
      blockers: after.blockers,
    };
    summary.finishedAt = new Date().toISOString();

    await writeOutput(args.out, summary);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

    const remainingConvertible = after.fields.some((field) => field.convertibleCount > 0);
    if (summary.apply.blocked || after.blockers.length > 0 || (args.apply && remainingConvertible)) {
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
