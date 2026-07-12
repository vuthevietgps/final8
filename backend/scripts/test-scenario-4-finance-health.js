const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

function getStateFilePath(tag) {
  return path.join(__dirname, `.test-state-${tag}.json`);
}

function saveState(tag, state) {
  fs.writeFileSync(getStateFilePath(tag), JSON.stringify(state, null, 2), 'utf8');
}

function loadState(tag) {
  const stateFile = getStateFilePath(tag);
  if (!fs.existsSync(stateFile)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
}

function deleteState(tag) {
  const stateFile = getStateFilePath(tag);
  if (fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
  }
}

function mergeState(tag, patch) {
  const current = loadState(tag) || {};
  saveState(tag, { ...current, ...patch });
}

function loadMongoUri() {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return 'mongodb://127.0.0.1:27017/management-system';
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const line = envContent
    .split(/\r?\n/)
    .find((entry) => entry.startsWith('MONGODB_URI='));

  return line ? line.slice('MONGODB_URI='.length).trim() : 'mongodb://127.0.0.1:27017/management-system';
}

async function withDb(work) {
  await mongoose.connect(loadMongoUri());
  try {
    return await work(mongoose.connection.db);
  } finally {
    await mongoose.disconnect();
  }
}

async function createScenarioUser(db, { email, role, fullName, phone, tag }) {
  const existing = await db.collection('users').findOne({ email });
  if (existing) {
    return { doc: existing, created: false };
  }

  const now = new Date();
  const doc = {
    fullName,
    email,
    password: bcrypt.hashSync('123456', 12),
    phone,
    role,
    isActive: true,
    notes: `scenario-4-${tag}`,
    createdAt: now,
    updatedAt: now,
  };

  const inserted = await db.collection('users').insertOne(doc);
  return { doc: { ...doc, _id: inserted.insertedId }, created: true };
}

async function createScenarioAdAccount(db, tag) {
  const accountId = `scenario4-acc-${tag}`;
  const existing = await db.collection('adaccounts').findOne({ accountId });
  if (existing) {
    return { doc: existing, created: false };
  }

  const now = new Date();
  const doc = {
    name: `Scenario 4 Account ${tag}`,
    accountId,
    accountType: 'facebook',
    isActive: true,
    notes: `scenario-4-${tag}`,
    createdAt: now,
    updatedAt: now,
  };

  const inserted = await db.collection('adaccounts').insertOne(doc);
  return { doc: { ...doc, _id: inserted.insertedId }, created: true };
}

async function createScenarioFanpage(db, tag) {
  const pageId = `scenario4-fp-${tag}`;
  const existing = await db.collection('fanpages').findOne({ pageId });
  if (existing) {
    return { doc: existing, created: false };
  }

  const now = new Date();
  const doc = {
    pageId,
    name: `Scenario 4 Fanpage ${tag}`,
    accessToken: `scenario4-token-${tag}`,
    status: 'active',
    description: `scenario-4-${tag}`,
    subscribedWebhook: false,
    aiEnabled: false,
    timezone: 'Asia/Ho_Chi_Minh',
    createdAt: now,
    updatedAt: now,
  };

  const inserted = await db.collection('fanpages').insertOne(doc);
  return { doc: { ...doc, _id: inserted.insertedId }, created: true };
}

async function createScenarioAdGroup(db, { tag, agentId, adAccountId, fanpageId }) {
  const adGroupId = `scenario4-base-${tag}`;
  const existing = await db.collection('adgroups').findOne({ adGroupId });
  if (existing) {
    return { doc: existing, created: false };
  }

  const now = new Date();
  const doc = {
    name: `Scenario 4 Base ${tag}`,
    adGroupId,
    fanpageId,
    agentId,
    adAccountId,
    platform: 'facebook',
    isActive: true,
    notes: `scenario-4-${tag}`,
    dailyBudget: 1_000_000,
    createdAt: now,
    updatedAt: now,
  };

  const inserted = await db.collection('adgroups').insertOne(doc);
  return { doc: { ...doc, _id: inserted.insertedId }, created: true };
}

async function getContext(db, tag) {
  const supportState = {
    createdUserIds: [],
    createdAdAccountIds: [],
    createdFanpageIds: [],
    createdAdGroupIds: [],
  };

  const supplier = await createScenarioUser(db, {
    email: `scenario4-supplier-${tag}@test.com`,
    role: 'internal_supplier',
    fullName: `Scenario 4 Supplier ${tag}`,
    phone: '0999400001',
    tag,
  });
  if (supplier.created) {
    supportState.createdUserIds.push(String(supplier.doc._id));
  }

  const agent = await createScenarioUser(db, {
    email: `scenario4-agent-${tag}@test.com`,
    role: 'external_agent',
    fullName: `Scenario 4 Agent ${tag}`,
    phone: '0999400002',
    tag,
  });
  if (agent.created) {
    supportState.createdUserIds.push(String(agent.doc._id));
  }

  const adAccount = await createScenarioAdAccount(db, tag);
  if (adAccount.created) {
    supportState.createdAdAccountIds.push(String(adAccount.doc._id));
  }

  const fanpage = await createScenarioFanpage(db, tag);
  if (fanpage.created) {
    supportState.createdFanpageIds.push(String(fanpage.doc._id));
  }

  const adGroup = await createScenarioAdGroup(db, {
    tag,
    agentId: agent.doc._id,
    adAccountId: adAccount.doc._id,
    fanpageId: fanpage.doc._id,
  });
  if (adGroup.created) {
    supportState.createdAdGroupIds.push(String(adGroup.doc._id));
  }

  mergeState(tag, { supportState });

  return {
    adGroup: adGroup.doc,
    supplierId: supplier.doc._id,
    agentId: agent.doc._id,
  };
}

function buildBaseOrder(context, tag, sequence, overrides = {}) {
  const now = new Date();
  const orderDate = new Date(now);
  orderDate.setDate(now.getDate() - Math.min(sequence + 1, 10));

  return {
    customerName: `S4-${tag}-${sequence}`,
    serviceDetails: `scenario-4-${tag}`,
    adGroupId: context.adGroup.adGroupId,
    supplierId: context.supplierId,
    agentId: context.agentId,
    quantity: 1,
    totalPrice: 0,
    totalCost: 0,
    codAmount: 0,
    supplierAppliedPrice: 0,
    supplierQuote: 0,
    agentQuote: 0,
    grossProfit: 0,
    netProfit: 0,
    advertisingCost: 0,
    laborCostAllocation: 0,
    otherCostAllocation: 0,
    orderStatus: 'Giao thành công',
    supplierPaymentStatus: 'pending',
    agentPaymentStatus: 'pending',
    productionStatus: 'Hoàn thành',
    isActive: true,
    orderDate,
    agentEligibleAt: orderDate,
    createdAt: orderDate,
    updatedAt: now,
    ...overrides,
  };
}

async function setupScenario1(db, tag) {
  const context = await getContext(db, tag);
  const now = new Date();

  await db.collection('fundingsources').insertOne({
    name: `Scenario4 Buffer ${tag}`,
    type: 'internal',
    principal: 200_000_000,
    availableBalance: 200_000_000,
    status: 'active',
    notes: `scenario-4-${tag}`,
    createdAt: now,
    updatedAt: now,
  });

  const order = buildBaseOrder(context, tag, 1, {
    totalPrice: 30_000_000,
    totalCost: 30_000_000,
    codAmount: 5_100_000,
    supplierAppliedPrice: 3_000_000,
    supplierQuote: 3_000_000,
    agentQuote: 12_000_000,
    // Phase 1 asserts DSO > DPO via cashflow summary, which currently reads agentPaidAmount.
    agentPaidAmount: 6_900_000,
    grossProfit: 2_100_000,
    netProfit: 2_000_000,
  });

  await db.collection('ordertest2').insertOne(order);

  return {
    scenario: 'scenario1',
    tag,
    adGroupId: context.adGroup.adGroupId,
  };
}

async function setupScenario2(db, tag) {
  const context = await getContext(db, tag);
  const now = new Date();
  await db.collection('fundingsources').insertOne({
    name: `Scenario4 Buffer ${tag}`,
    type: 'internal',
    principal: 200_000_000,
    availableBalance: 200_000_000,
    status: 'active',
    notes: `scenario-4-${tag}`,
    createdAt: now,
    updatedAt: now,
  });

  const orders = [];

  const returnedCount = 100;
  const deliveredCount = 20;

  for (let index = 0; index < returnedCount + deliveredCount; index += 1) {
    const isReturned = index < returnedCount;
    orders.push(
      buildBaseOrder(context, tag, index + 1, {
        orderStatus: isReturned ? 'Hoàn hàng' : 'Giao thành công',
        totalPrice: 3_000_000,
        totalCost: 2_000_000,
        codAmount: isReturned ? 0 : 2_400_000,
        supplierAppliedPrice: 1_500_000,
        supplierQuote: 1_500_000,
        agentQuote: isReturned ? 0 : 200_000,
        grossProfit: isReturned ? -100_000 : 300_000,
        netProfit: isReturned ? -50_000 : 150_000,
        agentPaymentStatus: isReturned ? 'n/a' : 'pending',
        supplierPaymentStatus: 'pending',
      })
    );
  }

  await db.collection('ordertest2').insertMany(orders);

  return {
    scenario: 'scenario2',
    tag,
    adGroupId: context.adGroup.adGroupId,
  };
}

async function setupScenario3(db, tag) {
  const context = await getContext(db, tag);
  const now = new Date();

  const activeFundingSources = await db.collection('fundingsources')
    .find({
      status: 'active',
    })
    .project({ _id: 1, availableBalance: 1 })
    .toArray();

  if (activeFundingSources.length > 0) {
    mergeState(tag, {
      fundingSources: activeFundingSources.map((source) => ({
        id: String(source._id),
        availableBalance: source.availableBalance || 0,
      })),
      insertedFundingSourceId: null,
    });

    const [primarySource, ...secondarySources] = activeFundingSources;
    const updates = [
      {
        updateOne: {
          filter: { _id: primarySource._id },
          update: { $set: { availableBalance: 2_000_000, updatedAt: now } },
        },
      },
      ...secondarySources.map((source) => ({
        updateOne: {
          filter: { _id: source._id },
          update: { $set: { availableBalance: 0, updatedAt: now } },
        },
      })),
    ];

    await db.collection('fundingsources').bulkWrite(updates);
  } else {
    const insertedFundingSource = await db.collection('fundingsources').insertOne({
      name: `Scenario4 Bank ${tag}`,
      type: 'internal',
      principal: 2_000_000,
      availableBalance: 2_000_000,
      status: 'active',
      notes: `scenario-4-${tag}`,
      createdAt: now,
      updatedAt: now,
    });

    mergeState(tag, {
      fundingSources: [],
      insertedFundingSourceId: String(insertedFundingSource.insertedId),
    });

  }

  const clonedAdGroup = {
    ...context.adGroup,
    _id: new mongoose.Types.ObjectId(),
    adGroupId: `scenario4-${tag}`,
    name: `Scenario 4 Budget Lock ${tag}`,
    dailyBudget: 1_000_000,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('adgroups').insertOne(clonedAdGroup);
  const dailyReports = [];
  for (let offset = 0; offset < 30; offset += 1) {
    const reportDate = new Date(now);
    reportDate.setDate(now.getDate() - offset);
    dailyReports.push({
      date: reportDate.toISOString().slice(0, 10),
      adGroupId: clonedAdGroup.adGroupId,
      adGroupName: clonedAdGroup.name,
      platform: 'facebook',
      adsCost: 20_000_000,
      netProfit: 0,
      syncedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  await db.collection('ad_group_daily_reports').insertMany(dailyReports, { ordered: false });

  return {
    scenario: 'scenario3',
    tag,
    adGroupId: context.adGroup.adGroupId,
    previewAdGroupId: clonedAdGroup.adGroupId,
  };
}

async function teardownScenario3(db, tag) {
  const state = loadState(tag);

  if (!state) {
    return;
  }

  if (Array.isArray(state.fundingSources) && state.fundingSources.length > 0) {
    await db.collection('fundingsources').bulkWrite(
      state.fundingSources.map((source) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(source.id) },
          update: {
            $set: {
              availableBalance: source.availableBalance || 0,
              updatedAt: new Date(),
            },
          },
        },
      })),
    );

  }

  if (state.insertedFundingSourceId) {
    await db.collection('fundingsources').deleteOne({
      _id: new mongoose.Types.ObjectId(state.insertedFundingSourceId),
    });
  }

  deleteState(tag);
}

async function teardown(db, tag) {
  const prefix = `S4-${tag}`;
  const state = loadState(tag);
  await teardownScenario3(db, tag);

  await Promise.all([
    db.collection('ordertest2').deleteMany({ customerName: { $regex: `^${prefix}` } }),
    db.collection('fundingsources').deleteMany({ notes: `scenario-4-${tag}` }),
    db.collection('advertisingcosts').deleteMany({ customerId: `scenario-4-${tag}` }),
    db.collection('ad_group_daily_reports').deleteMany({ adGroupId: `scenario4-${tag}` }),
    db.collection('adgroups').deleteMany({ adGroupId: `scenario4-${tag}` }),
  ]);

  if (state?.supportState?.createdAdGroupIds?.length) {
    await db.collection('adgroups').deleteMany({
      _id: { $in: state.supportState.createdAdGroupIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });
  }

  if (state?.supportState?.createdFanpageIds?.length) {
    await db.collection('fanpages').deleteMany({
      _id: { $in: state.supportState.createdFanpageIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });
  }

  if (state?.supportState?.createdAdAccountIds?.length) {
    await db.collection('adaccounts').deleteMany({
      _id: { $in: state.supportState.createdAdAccountIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });
  }

  if (state?.supportState?.createdUserIds?.length) {
    await db.collection('users').deleteMany({
      _id: { $in: state.supportState.createdUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });
  }

  deleteState(tag);

  return { ok: true, tag };
}

async function main() {
  const action = process.argv[2];
  const scenario = process.argv[3];
  const tag = process.argv[4];

  if (!action || !tag) {
    throw new Error('Usage: node test-scenario-4-finance-health.js <setup|teardown> <scenario|all> <tag>');
  }

  const result = await withDb(async (db) => {
    if (action === 'setup') {
      if (scenario === 'scenario1') return setupScenario1(db, tag);
      if (scenario === 'scenario2') return setupScenario2(db, tag);
      if (scenario === 'scenario3') return setupScenario3(db, tag);
      throw new Error(`Unsupported scenario: ${scenario}`);
    }

    if (action === 'teardown') {
      return teardown(db, tag);
    }

    throw new Error(`Unsupported action: ${action}`);
  });

  process.stdout.write(JSON.stringify(result));
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
