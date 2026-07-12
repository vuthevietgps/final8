const path = require('path');
const { createRequire } = require('module');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const backendEnvPath = path.join(repoRoot, 'backend', '.env');
const backendRequire = createRequire(path.join(repoRoot, 'backend', 'package.json'));
const mongoose = backendRequire('mongoose');
const bcrypt = backendRequire('bcryptjs');
const dotenv = backendRequire('dotenv');

dotenv.config({ path: backendEnvPath });

function buildMongoUri() {
  const directUri = process.env.MONGODB_URI && process.env.MONGODB_URI.trim();
  if (directUri) {
    return directUri;
  }

  const host = process.env.DATABASE_HOST && process.env.DATABASE_HOST.trim();
  const port = process.env.DATABASE_PORT && process.env.DATABASE_PORT.trim();
  const name = process.env.DATABASE_NAME && process.env.DATABASE_NAME.trim();

  if (host && port && name) {
    return `mongodb://${host}:${port}/${name}`;
  }

  throw new Error(
    `Missing database configuration. Checked ${backendEnvPath} for MONGODB_URI or DATABASE_HOST/DATABASE_PORT/DATABASE_NAME.`,
  );
}

const regressionUsers = [
  {
    email: 'director@test.com',
    password: '123456',
    fullName: 'Regression Director',
    role: 'director',
    phone: '0900000001',
  },
  {
    email: 'manager@test.com',
    password: '123456',
    fullName: 'Regression Manager',
    role: 'manager',
    phone: '0900000002',
  },
  {
    email: 'employee@test.com',
    password: '123456',
    fullName: 'Regression Employee',
    role: 'employee',
    phone: '0900000003',
  },
  {
    email: 'external-agent@test.com',
    password: '123456',
    fullName: 'Regression External Agent',
    role: 'external_agent',
    phone: '0900000004',
  },
  {
    email: 'internal-agent@test.com',
    password: '123456',
    fullName: 'Regression Internal Agent',
    role: 'internal_agent',
    phone: '0900000005',
  },
  {
    email: 'internal-supplier@test.com',
    password: '123456',
    fullName: 'Regression Internal Supplier',
    role: 'internal_supplier',
    phone: '0900000006',
  },
  {
    email: 'external-supplier@test.com',
    password: '123456',
    fullName: 'Regression External Supplier',
    role: 'external_supplier',
    phone: '0900000007',
  },
];

async function upsertRegressionUsers() {
  const uri = buildMongoUri();
  await mongoose.connect(uri);

  const usersCollection = mongoose.connection.db.collection('users');
  const now = new Date();

  for (const user of regressionUsers) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await usersCollection.updateOne(
      { email: user.email },
      {
        $set: {
          fullName: user.fullName,
          email: user.email,
          password: passwordHash,
          phone: user.phone,
          role: user.role,
          isActive: true,
          allowedLoginIps: [],
          tokenVersion: 0,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );

    console.log(`[OK] ${user.email} -> ${user.role}`);
  }
}

async function main() {
  try {
    console.log(`[INFO] Loading backend env from ${backendEnvPath}`);
    await upsertRegressionUsers();
    console.log(`[DONE] Ensured ${regressionUsers.length} regression users`);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('[ERROR] Regression user setup failed');
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
