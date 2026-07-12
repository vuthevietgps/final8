const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const LOCAL_MONGODB_URI = 'mongodb://127.0.0.1:27017/management-system';

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const index = trimmed.indexOf('=');
    if (index <= 0) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function resolveMongoUri() {
  if (process.env.MONGODB_URI && process.env.MONGODB_URI.trim()) {
    return process.env.MONGODB_URI.trim();
  }

  const repoRoot = path.resolve(__dirname, '..', '..');
  const candidates = [
    path.join(repoRoot, '.env'),
    path.join(repoRoot, 'backend', '.env'),
  ];

  for (const candidate of candidates) {
    const env = readEnvFile(candidate);
    if (env.MONGODB_URI && env.MONGODB_URI.trim()) {
      return env.MONGODB_URI.trim();
    }
  }

  return LOCAL_MONGODB_URI;
}

function parsePayload(arg) {
  if (!arg) {
    return {};
  }
  const json = Buffer.from(arg, 'base64').toString('utf8');
  return JSON.parse(json);
}

function objectId(value) {
  return new mongoose.Types.ObjectId(String(value));
}

async function getCollection(db, candidates) {
  const available = await db.listCollections().toArray();
  const names = new Set(available.map((item) => item.name));
  for (const candidate of candidates) {
    if (names.has(candidate)) {
      return db.collection(candidate);
    }
  }
  return db.collection(candidates[0]);
}

async function seedSessions(db, payload) {
  const collection = await getCollection(db, ['sessionlogs']);
  const now = new Date();
  const docs = (payload.sessions || []).map((session) => ({
    userId: objectId(payload.userId),
    userEmail: payload.userEmail,
    userName: payload.userName,
    userRole: payload.userRole,
    loginAt: new Date(session.loginAt),
    logoutAt: new Date(session.logoutAt),
    loginIp: session.loginIp || '127.0.0.1',
    createdAt: now,
    updatedAt: now,
  }));

  const result = docs.length > 0 ? await collection.insertMany(docs) : { insertedIds: {} };
  return {
    insertedCount: docs.length,
    insertedIds: Object.values(result.insertedIds || {}).map((id) => String(id)),
  };
}

async function cleanupArtifacts(db, payload) {
  const userObjectId = payload.userId ? objectId(payload.userId) : null;
  const otherCostIds = (payload.otherCostIds || []).filter(Boolean).map((id) => objectId(id));
  const start = payload.startDate ? new Date(payload.startDate) : null;
  const end = payload.endDate ? new Date(payload.endDate) : null;

  const sessionlogs = await getCollection(db, ['sessionlogs']);
  const laborcost = await getCollection(db, ['laborcost1', 'laborcost1s']);
  const laborstatements = await getCollection(db, ['laborstatements']);
  const salaryconfigs = await getCollection(db, ['salaryconfigs']);
  const othercosts = await getCollection(db, ['othercosts']);
  const users = await getCollection(db, ['users']);

  const summary = {
    sessionlogs: 0,
    laborcost: 0,
    laborstatements: 0,
    salaryconfigs: 0,
    othercosts: 0,
    users: 0,
  };

  if (userObjectId && start && end) {
    summary.sessionlogs = (await sessionlogs.deleteMany({
      userId: userObjectId,
      loginAt: { $gte: start, $lte: end },
    })).deletedCount || 0;

    summary.laborcost = (await laborcost.deleteMany({
      userId: userObjectId,
      date: { $gte: start, $lte: end },
    })).deletedCount || 0;
  }

  if (userObjectId) {
    summary.laborstatements = (await laborstatements.deleteMany({
      employeeId: userObjectId,
    })).deletedCount || 0;

    summary.salaryconfigs = (await salaryconfigs.deleteMany({
      userId: userObjectId,
    })).deletedCount || 0;
  }

  if (otherCostIds.length > 0) {
    summary.othercosts = (await othercosts.deleteMany({
      _id: { $in: otherCostIds },
    })).deletedCount || 0;
  }

  if (payload.removeUser && userObjectId) {
    summary.users = (await users.deleteMany({ _id: userObjectId })).deletedCount || 0;
  }

  return summary;
}

async function main() {
  const command = process.argv[2];
  const payload = parsePayload(process.argv[3]);
  const mongoUri = resolveMongoUri();

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    const db = mongoose.connection.db;
    let result;

    if (command === 'seed-sessions') {
      result = await seedSessions(db, payload);
    } else if (command === 'cleanup-artifacts') {
      result = await cleanupArtifacts(db, payload);
    } else {
      throw new Error(`Unsupported command: ${command}`);
    }

    process.stdout.write(JSON.stringify({ ok: true, result }));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});