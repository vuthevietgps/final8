const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_PASSWORD = 'Seed!2026';
const DEFAULT_TAG = 'deep-test';
const FINAL_STATUSES = {
  delivered: 'Giao th\u00e0nh c\u00f4ng',
  returned: 'H\u00e0ng ho\u00e0n',
};
const PRODUCTION_DONE = '\u0110\u00e3 tr\u1ea3 k\u1ebft qu\u1ea3';
const PRODUCT_ACTIVE = 'Ho\u1ea1t \u0111\u1ed9ng';
const SNAPSHOT_KEYS = [
  { domain: 'labor', windowDays: 7 },
  { domain: 'labor', windowDays: 14 },
  { domain: 'labor', windowDays: 30 },
  { domain: 'ops', windowDays: 7 },
  { domain: 'ops', windowDays: 14 },
  { domain: 'ops', windowDays: 30 },
  { domain: 'agent', windowDays: 7 },
  { domain: 'agent', windowDays: 14 },
  { domain: 'agent', windowDays: 30 },
  { domain: 'supplier', windowDays: -1 },
];

function stateFilePath(tag) {
  return path.join(__dirname, `.deep-test-seed-state-${tag}.json`);
}

function loadState(tag) {
  const filePath = stateFilePath(tag);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveState(tag, state) {
  fs.writeFileSync(stateFilePath(tag), JSON.stringify(state, null, 2), 'utf8');
}

function deleteState(tag) {
  const filePath = stateFilePath(tag);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function loadMongoUri() {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  const candidates = [
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env'),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }
    const envContent = fs.readFileSync(candidate, 'utf8');
    const line = envContent
      .split(/\r?\n/)
      .find((entry) => entry.startsWith('MONGODB_URI='));
    if (line) {
      return line.slice('MONGODB_URI='.length).trim();
    }
  }

  return 'mongodb://127.0.0.1:27017/management-system';
}

function loadBaseUrl() {
  if (process.env.SEED_BASE_URL) {
    return process.env.SEED_BASE_URL.trim().replace(/\/$/, '');
  }

  const defaultPort = process.env.PORT ? Number(process.env.PORT) : 3000;
  return `http://127.0.0.1:${Number.isFinite(defaultPort) ? defaultPort : 3000}`;
}

function slugifyTag(tag) {
  return String(tag || DEFAULT_TAG)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || DEFAULT_TAG;
}

function toObjectId(value) {
  return value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value);
}

function isoDateOnly(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function shiftDays(value, deltaDays, hours = 10) {
  const date = new Date(value);
  date.setHours(hours, 0, 0, 0);
  date.setTime(date.getTime() + deltaDays * MS_PER_DAY);
  return date;
}

function valueOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function sumBy(items, iteratee) {
  return items.reduce((sum, item) => sum + iteratee(item), 0);
}

function addInserted(state, collection, docs) {
  const ids = docs
    .filter(Boolean)
    .map((doc) => (doc._id ? String(doc._id) : String(doc)));

  if (!state.inserted[collection]) {
    state.inserted[collection] = [];
  }

  state.inserted[collection].push(...ids);
}

async function withDb(work) {
  await mongoose.connect(loadMongoUri(), {
    serverSelectionTimeoutMS: 15000,
  });

  try {
    return await work(mongoose.connection.db);
  } finally {
    await mongoose.disconnect();
  }
}

function collectionMap(db) {
  return {
    users: db.collection('users'),
    categories: db.collection('productcategories'),
    products: db.collection('products'),
    fanpages: db.collection('fanpages'),
    adAccounts: db.collection('adaccounts'),
    adGroups: db.collection('adgroups'),
    orders: db.collection('ordertest2'),
    adsCosts: db.collection('advertisingcosts'),
    adGroupDailyReports: db.collection('ad_group_daily_reports'),
    laborCosts: db.collection('laborcost1'),
    laborStatements: db.collection('laborstatements'),
    otherCosts: db.collection('othercosts'),
    fundingSources: db.collection('fundingsources'),
    loanContracts: db.collection('loancontracts'),
    loanRepayments: db.collection('loanrepayments'),
    supplierPayables: db.collection('supplierpayables'),
    supplierStatements: db.collection('supplierstatements'),
    agentStatements: db.collection('agentstatements'),
    cashflowSnapshots: db.collection('cashflow_summary_snapshots'),
    capitalAllocationSnapshots: db.collection('capital_allocation_snapshots'),
    adsDailySpendings: db.collection('ads_daily_spendings'),
  };
}

function serializeSnapshotDoc(doc) {
  if (!doc) {
    return null;
  }
  return {
    _id: String(doc._id),
    domain: doc.domain,
    windowDays: doc.windowDays,
    data: doc.data,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
  };
}

async function capturePreviousSnapshots(collections) {
  const $or = SNAPSHOT_KEYS.map((key) => ({
    domain: key.domain,
    windowDays: key.windowDays,
  }));
  const existing = await collections.cashflowSnapshots.find({ $or }).toArray();
  return existing.map(serializeSnapshotDoc);
}

async function restoreSnapshots(collections, state) {
  const prior = Array.isArray(state.previousSnapshots) ? state.previousSnapshots : [];

  for (const key of SNAPSHOT_KEYS) {
    const priorDoc = prior.find(
      (doc) => doc.domain === key.domain && doc.windowDays === key.windowDays,
    );

    if (priorDoc) {
      await collections.cashflowSnapshots.replaceOne(
        { domain: priorDoc.domain, windowDays: priorDoc.windowDays },
        {
          _id: toObjectId(priorDoc._id),
          domain: priorDoc.domain,
          windowDays: priorDoc.windowDays,
          data: priorDoc.data,
          updatedAt: new Date(priorDoc.updatedAt),
        },
        { upsert: true },
      );
    } else {
      await collections.cashflowSnapshots.deleteOne({
        domain: key.domain,
        windowDays: key.windowDays,
      });
    }
  }
}

async function deleteInsertedDocs(collections, state) {
  const orderedCollections = [
    'adsDailySpendings',
    'capitalAllocationSnapshots',
    'cashflowSnapshots',
    'loanRepayments',
    'loanContracts',
    'agentStatements',
    'supplierStatements',
    'supplierPayables',
    'adGroupDailyReports',
    'adsCosts',
    'orders',
    'laborStatements',
    'laborCosts',
    'otherCosts',
    'adGroups',
    'adAccounts',
    'fanpages',
    'products',
    'categories',
    'fundingSources',
    'users',
  ];

  for (const key of orderedCollections) {
    const ids = Array.isArray(state.inserted[key]) ? state.inserted[key] : [];
    if (!ids.length || !collections[key]) {
      continue;
    }

    await collections[key].deleteMany({
      _id: {
        $in: ids.map((id) => toObjectId(id)),
      },
    });
  }
}

function makeSeedRefs(tag) {
  const slug = slugifyTag(tag);
  const noteTag = `DEEP-SEED:${slug}`;
  return {
    tag,
    slug,
    noteTag,
    emails: {
      director: `deep.director.${slug}@example.com`,
      manager: `deep.manager.${slug}@example.com`,
      employee: `deep.employee.${slug}@example.com`,
      agentAlpha: `deep.agent.alpha.${slug}@example.com`,
      agentBeta: `deep.agent.beta.${slug}@example.com`,
      agentInternal: `deep.agent.internal.${slug}@example.com`,
      supplierNorth: `deep.supplier.north.${slug}@example.com`,
      supplierSouth: `deep.supplier.south.${slug}@example.com`,
    },
    codes: {
      category: `DEEP-CAT-${slug}`.slice(0, 40),
      pageId: `DEEP-PAGE-${slug}`.slice(0, 50),
      accountId: `DEEP-ACC-${slug}`.slice(0, 50),
      adGroupAlpha: `DEEP-AG-A-${slug}`.slice(0, 50),
      adGroupBeta: `DEEP-AG-B-${slug}`.slice(0, 50),
      adGroupGamma: `DEEP-AG-C-${slug}`.slice(0, 50),
      supplierBatch: `DEEP-NCC-${slug}-PAID`,
      agentBatch: `DEEP-AGENT-${slug}-PAID`,
    },
  };
}

function buildUsers(refs, passwordHash) {
  const now = new Date();
  return {
    director: {
      _id: new mongoose.Types.ObjectId(),
      fullName: `Deep Seed Director ${refs.slug}`,
      email: refs.emails.director,
      password: passwordHash,
      phone: '0901000001',
      role: 'director',
      isActive: true,
      address: 'Seed Address 1',
      notes: refs.noteTag,
      createdAt: now,
      updatedAt: now,
    },
    manager: {
      _id: new mongoose.Types.ObjectId(),
      fullName: `Deep Seed Manager ${refs.slug}`,
      email: refs.emails.manager,
      password: passwordHash,
      phone: '0901000002',
      role: 'manager',
      isActive: true,
      address: 'Seed Address 2',
      notes: refs.noteTag,
      createdAt: now,
      updatedAt: now,
    },
    employee: {
      _id: new mongoose.Types.ObjectId(),
      fullName: `Deep Seed Employee ${refs.slug}`,
      email: refs.emails.employee,
      password: passwordHash,
      phone: '0901000003',
      role: 'employee',
      isActive: true,
      address: 'Seed Address 3',
      notes: refs.noteTag,
      createdAt: now,
      updatedAt: now,
    },
    agentAlpha: {
      _id: new mongoose.Types.ObjectId(),
      fullName: `Deep Seed Agent Alpha ${refs.slug}`,
      email: refs.emails.agentAlpha,
      password: passwordHash,
      phone: '0901000004',
      role: 'external_agent',
      isActive: true,
      notes: refs.noteTag,
      googleDriveLink: 'https://drive.google.com/seed-alpha',
      createdAt: now,
      updatedAt: now,
    },
    agentBeta: {
      _id: new mongoose.Types.ObjectId(),
      fullName: `Deep Seed Agent Beta ${refs.slug}`,
      email: refs.emails.agentBeta,
      password: passwordHash,
      phone: '0901000005',
      role: 'external_agent',
      isActive: true,
      notes: refs.noteTag,
      googleDriveLink: 'https://drive.google.com/seed-beta',
      createdAt: now,
      updatedAt: now,
    },
    agentInternal: {
      _id: new mongoose.Types.ObjectId(),
      fullName: `Deep Seed Agent Internal ${refs.slug}`,
      email: refs.emails.agentInternal,
      password: passwordHash,
      phone: '0901000006',
      role: 'internal_agent',
      isActive: true,
      notes: refs.noteTag,
      createdAt: now,
      updatedAt: now,
    },
    supplierNorth: {
      _id: new mongoose.Types.ObjectId(),
      fullName: `Deep Seed Supplier North ${refs.slug}`,
      email: refs.emails.supplierNorth,
      password: passwordHash,
      phone: '0901000007',
      role: 'external_supplier',
      isActive: true,
      notes: refs.noteTag,
      googleDriveLink: 'https://drive.google.com/seed-supplier-north',
      createdAt: now,
      updatedAt: now,
    },
    supplierSouth: {
      _id: new mongoose.Types.ObjectId(),
      fullName: `Deep Seed Supplier South ${refs.slug}`,
      email: refs.emails.supplierSouth,
      password: passwordHash,
      phone: '0901000008',
      role: 'external_supplier',
      isActive: true,
      notes: refs.noteTag,
      googleDriveLink: 'https://drive.google.com/seed-supplier-south',
      createdAt: now,
      updatedAt: now,
    },
  };
}

function buildCoreDocs(refs, users, baseDate) {
  const now = new Date();
  const category = {
    _id: new mongoose.Types.ObjectId(),
    name: `Deep Test Category ${refs.slug}`,
    description: `Seed category for ${refs.noteTag}`,
    color: '#2563EB',
    icon: 'box',
    isActive: true,
    order: 999,
    code: refs.codes.category,
    productCount: 3,
    notes: refs.noteTag,
    createdAt: now,
    updatedAt: now,
  };

  const productA = {
    _id: new mongoose.Types.ObjectId(),
    name: `Deep Returnable Product ${refs.slug}`,
    categoryId: category._id,
    importPrice: 210000,
    shippingCost: 25000,
    packagingCost: 15000,
    totalCost: 250000,
    minStock: 10,
    maxStock: 500,
    estimatedDeliveryDays: 4,
    usageDurationMonths: 12,
    status: PRODUCT_ACTIVE,
    color: '#0F766E',
    notes: refs.noteTag,
    resourceLink: '',
    isReturnable: true,
    assumedReturnRatePercent: 18,
    searchKeywords: ['deep', 'returnable', refs.slug],
    suppliers: [
      {
        supplierId: users.supplierNorth._id,
        price1: 250000,
        appliedLevel: 1,
        appliedPrice: 250000,
        priority: 1,
        isDefault: true,
      },
    ],
    sku: `DSPA-${refs.slug}`.slice(0, 30),
    createdAt: now,
    updatedAt: now,
  };

  const productB = {
    _id: new mongoose.Types.ObjectId(),
    name: `Deep Nonreturnable Product ${refs.slug}`,
    categoryId: category._id,
    importPrice: 360000,
    shippingCost: 40000,
    packagingCost: 30000,
    totalCost: 430000,
    minStock: 5,
    maxStock: 300,
    estimatedDeliveryDays: 5,
    usageDurationMonths: 18,
    status: PRODUCT_ACTIVE,
    color: '#C2410C',
    notes: refs.noteTag,
    resourceLink: '',
    isReturnable: false,
    assumedReturnRatePercent: 6,
    searchKeywords: ['deep', 'nonreturnable', refs.slug],
    suppliers: [
      {
        supplierId: users.supplierSouth._id,
        price1: 430000,
        appliedLevel: 1,
        appliedPrice: 430000,
        priority: 1,
        isDefault: true,
      },
    ],
    sku: `DSPB-${refs.slug}`.slice(0, 30),
    createdAt: now,
    updatedAt: now,
  };

  const fanpage = {
    _id: new mongoose.Types.ObjectId(),
    pageId: refs.codes.pageId,
    name: `Deep Seed Fanpage ${refs.slug}`,
    accessToken: `token-${refs.slug}`,
    status: 'active',
    connectedAt: now,
    lastRefreshAt: now,
    connectedBy: users.manager._id,
    defaultProductGroup: category._id,
    description: refs.noteTag,
    subscribedWebhook: false,
    aiEnabled: false,
    timezone: 'Asia/Bangkok',
    createdAt: now,
    updatedAt: now,
  };

  const adAccount = {
    _id: new mongoose.Types.ObjectId(),
    name: `Deep Seed Ad Account ${refs.slug}`,
    accountId: refs.codes.accountId,
    accountType: 'facebook',
    managementMode: 'bm',
    isActive: true,
    notes: refs.noteTag,
    description: refs.noteTag,
    currency: 'VND',
    timezoneId: 'Asia/Bangkok',
    businessName: `Deep Seed Business ${refs.slug}`,
    amountSpent: 0,
    tokenSource: 'manual',
    adsManagerUserId: users.manager._id,
    lastOperatorActivityAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const adGroups = {
    alpha: {
      _id: new mongoose.Types.ObjectId(),
      name: `Deep Alpha ${refs.slug}`,
      adGroupId: refs.codes.adGroupAlpha,
      fanpageId: fanpage._id,
      productCategoryId: category._id,
      selectedProducts: [productA._id],
      agentId: users.agentAlpha._id,
      adAccountId: adAccount._id,
      assignedEmployeeId: users.manager._id,
      description: refs.noteTag,
      platform: 'facebook',
      isActive: true,
      notes: refs.noteTag,
      dailyBudget: 420000,
      testingPhase: 'GROWTH',
      testingStartDate: shiftDays(baseDate, -10),
      createdAt: now,
      updatedAt: now,
    },
    beta: {
      _id: new mongoose.Types.ObjectId(),
      name: `Deep Beta ${refs.slug}`,
      adGroupId: refs.codes.adGroupBeta,
      fanpageId: fanpage._id,
      productCategoryId: category._id,
      selectedProducts: [productB._id],
      agentId: users.agentBeta._id,
      adAccountId: adAccount._id,
      assignedEmployeeId: users.manager._id,
      description: refs.noteTag,
      platform: 'facebook',
      isActive: true,
      notes: refs.noteTag,
      dailyBudget: 440000,
      testingPhase: 'TESTING',
      testingStartDate: shiftDays(baseDate, -8),
      createdAt: now,
      updatedAt: now,
    },
    gamma: {
      _id: new mongoose.Types.ObjectId(),
      name: `Deep Gamma ${refs.slug}`,
      adGroupId: refs.codes.adGroupGamma,
      fanpageId: fanpage._id,
      productCategoryId: category._id,
      selectedProducts: [productA._id],
      agentId: users.agentInternal._id,
      adAccountId: adAccount._id,
      assignedEmployeeId: users.employee._id,
      description: refs.noteTag,
      platform: 'facebook',
      isActive: true,
      notes: refs.noteTag,
      dailyBudget: 160000,
      testingPhase: 'STABLE',
      testingStartDate: shiftDays(baseDate, -20),
      createdAt: now,
      updatedAt: now,
    },
  };

  return {
    category,
    productA,
    productB,
    fanpage,
    adAccount,
    adGroups,
  };
}

function buildOrderDocs(refs, users, core, baseDate) {
  const paidSupplierBatch = refs.codes.supplierBatch;
  const paidAgentBatch = refs.codes.agentBatch;
  const orderSpecs = [
    {
      key: 'alpha-pending-both',
      daysAgo: 5,
      product: core.productA,
      adGroupId: core.adGroups.alpha.adGroupId,
      supplierId: users.supplierNorth._id,
      agentId: users.agentAlpha._id,
      quantity: 2,
      depositAmount: 0,
      codAmount: 960000,
      manualPayment: 0,
      supplierPrice: 250000,
      agentQuote: 380000,
      advertisingCost: 50000,
      laborCostAllocation: 20000,
      otherCostAllocation: 10000,
      orderStatus: FINAL_STATUSES.delivered,
      supplierPaymentStatus: 'pending',
      agentPaymentStatus: 'pending',
    },
    {
      key: 'alpha-supplier-paid',
      daysAgo: 4,
      product: core.productA,
      adGroupId: core.adGroups.alpha.adGroupId,
      supplierId: users.supplierNorth._id,
      agentId: users.agentAlpha._id,
      quantity: 1,
      depositAmount: 0,
      codAmount: 520000,
      manualPayment: 0,
      supplierPrice: 250000,
      agentQuote: 390000,
      advertisingCost: 35000,
      laborCostAllocation: 10000,
      otherCostAllocation: 5000,
      orderStatus: FINAL_STATUSES.delivered,
      supplierPaymentStatus: 'paid',
      agentPaymentStatus: 'pending',
      supplierPaidOffsetDays: 2,
    },
    {
      key: 'beta-return-loss',
      daysAgo: 4,
      product: core.productB,
      adGroupId: core.adGroups.beta.adGroupId,
      supplierId: users.supplierSouth._id,
      agentId: null,
      quantity: 1,
      depositAmount: 0,
      codAmount: 780000,
      manualPayment: 0,
      supplierPrice: 430000,
      agentQuote: 0,
      advertisingCost: 45000,
      laborCostAllocation: 15000,
      otherCostAllocation: 10000,
      orderStatus: FINAL_STATUSES.returned,
      supplierPaymentStatus: 'pending',
      agentPaymentStatus: 'n/a',
      forcedPaidToCompanyAmount: -430000,
    },
    {
      key: 'beta-realized-win',
      daysAgo: 3,
      product: core.productB,
      adGroupId: core.adGroups.beta.adGroupId,
      supplierId: users.supplierSouth._id,
      agentId: users.agentBeta._id,
      quantity: 1,
      depositAmount: 0,
      codAmount: 780000,
      manualPayment: 0,
      supplierPrice: 410000,
      agentQuote: 630000,
      advertisingCost: 70000,
      laborCostAllocation: 15000,
      otherCostAllocation: 15000,
      orderStatus: FINAL_STATUSES.delivered,
      supplierPaymentStatus: 'paid',
      agentPaymentStatus: 'paid',
      supplierPaidOffsetDays: 2,
      agentPaidOffsetDays: 3,
    },
    {
      key: 'alpha-return-realized',
      daysAgo: 3,
      product: core.productA,
      adGroupId: core.adGroups.alpha.adGroupId,
      supplierId: users.supplierNorth._id,
      agentId: null,
      quantity: 1,
      depositAmount: 0,
      codAmount: 520000,
      manualPayment: 0,
      supplierPrice: 250000,
      agentQuote: 0,
      advertisingCost: 20000,
      laborCostAllocation: 5000,
      otherCostAllocation: 5000,
      orderStatus: FINAL_STATUSES.returned,
      supplierPaymentStatus: 'paid',
      agentPaymentStatus: 'n/a',
      forcedPaidToCompanyAmount: -30000,
      supplierPaidOffsetDays: 3,
    },
    {
      key: 'gamma-internal-agent',
      daysAgo: 2,
      product: core.productA,
      adGroupId: core.adGroups.gamma.adGroupId,
      supplierId: users.supplierNorth._id,
      agentId: users.agentInternal._id,
      quantity: 2,
      depositAmount: 0,
      codAmount: 1040000,
      manualPayment: 0,
      supplierPrice: 250000,
      agentQuote: 0,
      advertisingCost: 60000,
      laborCostAllocation: 20000,
      otherCostAllocation: 10000,
      orderStatus: FINAL_STATUSES.delivered,
      supplierPaymentStatus: 'pending',
      agentPaymentStatus: 'n/a',
    },
    {
      key: 'beta-pending-both',
      daysAgo: 2,
      product: core.productB,
      adGroupId: core.adGroups.beta.adGroupId,
      supplierId: users.supplierSouth._id,
      agentId: users.agentBeta._id,
      quantity: 1,
      depositAmount: 0,
      codAmount: 820000,
      manualPayment: 0,
      supplierPrice: 430000,
      agentQuote: 650000,
      advertisingCost: 50000,
      laborCostAllocation: 25000,
      otherCostAllocation: 15000,
      orderStatus: FINAL_STATUSES.delivered,
      supplierPaymentStatus: 'pending',
      agentPaymentStatus: 'pending',
    },
    {
      key: 'alpha-realized-current',
      daysAgo: 1,
      product: core.productA,
      adGroupId: core.adGroups.alpha.adGroupId,
      supplierId: users.supplierNorth._id,
      agentId: users.agentAlpha._id,
      quantity: 1,
      depositAmount: 50000,
      codAmount: 480000,
      manualPayment: 20000,
      supplierPrice: 260000,
      agentQuote: 440000,
      advertisingCost: 35000,
      laborCostAllocation: 10000,
      otherCostAllocation: 10000,
      orderStatus: FINAL_STATUSES.delivered,
      supplierPaymentStatus: 'paid',
      agentPaymentStatus: 'paid',
      supplierPaidOffsetDays: 1,
      agentPaidOffsetDays: 2,
    },
    {
      key: 'beta-return-pending',
      daysAgo: 1,
      product: core.productB,
      adGroupId: core.adGroups.beta.adGroupId,
      supplierId: users.supplierSouth._id,
      agentId: null,
      quantity: 1,
      depositAmount: 0,
      codAmount: 780000,
      manualPayment: 0,
      supplierPrice: 430000,
      agentQuote: 0,
      advertisingCost: 40000,
      laborCostAllocation: 10000,
      otherCostAllocation: 10000,
      orderStatus: FINAL_STATUSES.returned,
      supplierPaymentStatus: 'pending',
      agentPaymentStatus: 'n/a',
      forcedPaidToCompanyAmount: -430000,
    },
    {
      key: 'beta-today-supplier-paid',
      daysAgo: 0,
      product: core.productB,
      adGroupId: core.adGroups.beta.adGroupId,
      supplierId: users.supplierSouth._id,
      agentId: users.agentBeta._id,
      quantity: 1,
      depositAmount: 0,
      codAmount: 840000,
      manualPayment: 0,
      supplierPrice: 420000,
      agentQuote: 680000,
      advertisingCost: 45000,
      laborCostAllocation: 20000,
      otherCostAllocation: 15000,
      orderStatus: FINAL_STATUSES.delivered,
      supplierPaymentStatus: 'paid',
      agentPaymentStatus: 'pending',
      supplierPaidOffsetDays: 0,
    },
  ];

  return orderSpecs.map((spec, index) => {
    const orderDate = shiftDays(baseDate, -spec.daysAgo, 11 + (index % 4));
    const revenue = valueOrZero(spec.depositAmount) + valueOrZero(spec.codAmount) + valueOrZero(spec.manualPayment);
    const productCostTotal = valueOrZero(spec.supplierPrice) * valueOrZero(spec.quantity);
    const expectedPaidToCompany = spec.forcedPaidToCompanyAmount !== undefined
      ? valueOrZero(spec.forcedPaidToCompanyAmount)
      : revenue - productCostTotal;
    const externalAgent = !!spec.agentId && String(spec.agentId) !== String(users.agentInternal._id);
    const agentCommissionDue = externalAgent
      ? Math.max(0, revenue - valueOrZero(spec.agentQuote) * valueOrZero(spec.quantity))
      : 0;
    const grossProfit = expectedPaidToCompany - agentCommissionDue;
    const netProfit =
      grossProfit -
      valueOrZero(spec.advertisingCost) -
      valueOrZero(spec.laborCostAllocation) -
      valueOrZero(spec.otherCostAllocation);
    const supplierPaidAt = spec.supplierPaymentStatus === 'paid'
      ? shiftDays(orderDate, valueOrZero(spec.supplierPaidOffsetDays), 15)
      : undefined;
    const agentPaidAt = spec.agentPaymentStatus === 'paid'
      ? shiftDays(orderDate, valueOrZero(spec.agentPaidOffsetDays), 16)
      : undefined;
    const supplierPaidAmount = spec.supplierPaymentStatus === 'paid'
      ? expectedPaidToCompany
      : undefined;
    const agentPaidAmount = spec.agentPaymentStatus === 'paid'
      ? agentCommissionDue
      : undefined;
    const isRealized = spec.supplierPaymentStatus === 'paid' && ['paid', 'n/a'].includes(spec.agentPaymentStatus);
    const realizedGrossProfit = isRealized
      ? valueOrZero(supplierPaidAmount) - valueOrZero(agentPaidAmount)
      : undefined;
    const realizedNetProfit = isRealized
      ? realizedGrossProfit -
        valueOrZero(spec.advertisingCost) -
        valueOrZero(spec.laborCostAllocation) -
        valueOrZero(spec.otherCostAllocation)
      : undefined;
    const agentPaymentDueDate = spec.agentPaymentStatus === 'pending'
      ? shiftDays(baseDate, spec.key === 'beta-today-supplier-paid' ? 14 : 4 + index, 9)
      : undefined;

    return {
      _id: new mongoose.Types.ObjectId(),
      productId: spec.product._id,
      productUsageDurationMonths: spec.product.usageDurationMonths,
      customerName: `Deep Seed Customer ${index + 1}`,
      quantity: spec.quantity,
      agentId: spec.agentId || undefined,
      adGroupId: spec.adGroupId,
      isActive: true,
      productionStatus: PRODUCTION_DONE,
      orderStatus: spec.orderStatus,
      serviceDetails: refs.noteTag,
      submitLink: '',
      trackingNumber: `DEEP-TRACK-${refs.slug}-${index + 1}`,
      depositAmount: spec.depositAmount,
      codAmount: spec.codAmount,
      manualPayment: spec.manualPayment,
      shippingFee: spec.orderStatus === FINAL_STATUSES.delivered ? 30000 : 0,
      returnFee: spec.orderStatus === FINAL_STATUSES.returned ? 30000 : 0,
      codCollectedBySupplier: spec.orderStatus === FINAL_STATUSES.delivered ? spec.codAmount : 0,
      supplierQuote: spec.supplierPrice,
      agentAppliedPrice: spec.agentQuote,
      agentQuoteSnapshotAt: orderDate,
      agentPaymentDueDate,
      agentQuote: spec.agentQuote,
      agentCommissionAmount: externalAgent ? agentCommissionDue : 0,
      productType: 'standard',
      supplierId: spec.supplierId,
      supplierPriceLevel: 1,
      supplierAppliedPrice: spec.supplierPrice,
      supplierQuoteSnapshotAt: orderDate,
      supplierShippingFeeSnapshot: 30000,
      supplierReturnFeeSnapshot: spec.orderStatus === FINAL_STATUSES.returned ? 30000 : 0,
      supplierIsReturnableSnapshot: !!spec.product.isReturnable,
      grossProfit,
      advertisingCost: spec.advertisingCost,
      laborCostAllocation: spec.laborCostAllocation,
      otherCostAllocation: spec.otherCostAllocation,
      netProfit,
      realizedGrossProfit,
      realizedNetProfit,
      realizedAt: isRealized ? (agentPaidAt || supplierPaidAt) : undefined,
      receiverName: `Receiver ${index + 1}`,
      receiverPhone: `09870000${String(index + 1).padStart(2, '0')}`,
      receiverAddress: `Deep Seed Address ${index + 1}`,
      orderDate,
      supplierPaymentStatus: spec.supplierPaymentStatus,
      supplierPaymentBatchId: spec.supplierPaymentStatus === 'paid' ? paidSupplierBatch : undefined,
      supplierPaidAt,
      supplierPaidAmount,
      supplierPaymentNote: spec.supplierPaymentStatus === 'paid' ? refs.noteTag : undefined,
      supplierPaymentAttachments: [],
      agentPaymentStatus: spec.agentPaymentStatus,
      agentPaymentBatchId: spec.agentPaymentStatus === 'paid' ? paidAgentBatch : undefined,
      agentPaidAt,
      agentPaidAmount,
      agentPaymentNote: spec.agentPaymentStatus === 'paid' ? refs.noteTag : undefined,
      agentPaymentAttachments: [],
      agentEligibleAt: orderDate,
      agentCommissionFinal: externalAgent ? agentCommissionDue : 0,
      confirmOverThreshold: false,
      paidToCompanyAmount: expectedPaidToCompany,
      productCostTotal,
      createdAt: orderDate,
      updatedAt: new Date(Math.max(orderDate.getTime(), Date.now())),
    };
  });
}

function buildAdvertisingCosts(refs, core, baseDate) {
  const groups = [
    {
      adGroup: core.adGroups.alpha,
      history: [
        { daysAgo: 7, spentAmount: 180000, netProfit: 140000 },
        { daysAgo: 6, spentAmount: 220000, netProfit: 190000 },
        { daysAgo: 5, spentAmount: 260000, netProfit: 250000 },
        { daysAgo: 4, spentAmount: 300000, netProfit: 320000 },
        { daysAgo: 3, spentAmount: 340000, netProfit: 390000 },
        { daysAgo: 2, spentAmount: 380000, netProfit: 450000 },
        { daysAgo: 1, spentAmount: 420000, netProfit: 520000 },
      ],
    },
    {
      adGroup: core.adGroups.beta,
      history: [
        { daysAgo: 7, spentAmount: 200000, netProfit: -20000 },
        { daysAgo: 6, spentAmount: 240000, netProfit: -30000 },
        { daysAgo: 5, spentAmount: 280000, netProfit: -60000 },
        { daysAgo: 4, spentAmount: 320000, netProfit: -90000 },
        { daysAgo: 3, spentAmount: 360000, netProfit: -120000 },
        { daysAgo: 2, spentAmount: 400000, netProfit: -150000 },
        { daysAgo: 1, spentAmount: 440000, netProfit: -190000 },
      ],
    },
    {
      adGroup: core.adGroups.gamma,
      history: [
        { daysAgo: 7, spentAmount: 100000, netProfit: 60000 },
        { daysAgo: 6, spentAmount: 110000, netProfit: 65000 },
        { daysAgo: 5, spentAmount: 120000, netProfit: 70000 },
        { daysAgo: 4, spentAmount: 130000, netProfit: 74000 },
        { daysAgo: 3, spentAmount: 140000, netProfit: 80000 },
        { daysAgo: 2, spentAmount: 150000, netProfit: 84000 },
        { daysAgo: 1, spentAmount: 160000, netProfit: 90000 },
      ],
    },
  ];

  const advertisingCosts = [];
  const adGroupDailyReports = [];

  for (const group of groups) {
    for (const item of group.history) {
      const targetDate = shiftDays(baseDate, -item.daysAgo, 12);
      const dateKey = isoDateOnly(targetDate);

      advertisingCosts.push({
        _id: new mongoose.Types.ObjectId(),
        channel: 'facebook',
        date: targetDate,
        adGroupId: group.adGroup.adGroupId,
        customerId: `${refs.slug}-${group.adGroup.adGroupId}-${dateKey}`,
        spentAmount: item.spentAmount,
        impressions: 10000 + item.daysAgo * 1000,
        clicks: 200 + item.daysAgo * 10,
        reach: 5000 + item.daysAgo * 400,
        cpm: 55000,
        cpc: 5500,
        createdAt: targetDate,
        updatedAt: targetDate,
      });

      adGroupDailyReports.push({
        _id: new mongoose.Types.ObjectId(),
        date: dateKey,
        adGroupId: group.adGroup.adGroupId,
        adGroupName: group.adGroup.name,
        platform: group.adGroup.platform,
        adsCost: item.spentAmount,
        netProfit: item.netProfit,
        syncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return { advertisingCosts, adGroupDailyReports };
}

function buildLaborData(refs, users, baseDate) {
  const openDueA = shiftDays(baseDate, 4, 9);
  const openDueB = shiftDays(baseDate, 12, 9);
  const closedPaidAt = shiftDays(baseDate, -6, 17);

  const laborCosts = [
    {
      _id: new mongoose.Types.ObjectId(),
      date: shiftDays(baseDate, -8, 0),
      userId: users.employee._id,
      startTime: '08:00',
      endTime: '12:00',
      workHours: 4,
      hourlyRate: 100000,
      cost: 400000,
      notes: refs.noteTag,
      paid: true,
      paidAt: closedPaidAt,
      paymentStatus: 'paid',
      createdAt: shiftDays(baseDate, -8, 18),
      updatedAt: shiftDays(baseDate, -8, 18),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      date: shiftDays(baseDate, -7, 0),
      userId: users.employee._id,
      startTime: '08:00',
      endTime: '13:00',
      workHours: 5,
      hourlyRate: 100000,
      cost: 500000,
      notes: refs.noteTag,
      paid: true,
      paidAt: closedPaidAt,
      paymentStatus: 'paid',
      createdAt: shiftDays(baseDate, -7, 18),
      updatedAt: shiftDays(baseDate, -7, 18),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      date: shiftDays(baseDate, -3, 0),
      userId: users.employee._id,
      startTime: '08:00',
      endTime: '13:00',
      workHours: 5,
      hourlyRate: 120000,
      cost: 600000,
      notes: refs.noteTag,
      paid: false,
      paymentStatus: 'in_statement',
      createdAt: shiftDays(baseDate, -3, 18),
      updatedAt: shiftDays(baseDate, -3, 18),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      date: shiftDays(baseDate, -2, 0),
      userId: users.employee._id,
      startTime: '08:00',
      endTime: '13:00',
      workHours: 5,
      hourlyRate: 120000,
      cost: 600000,
      notes: refs.noteTag,
      paid: false,
      paymentStatus: 'in_statement',
      createdAt: shiftDays(baseDate, -2, 18),
      updatedAt: shiftDays(baseDate, -2, 18),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      date: shiftDays(baseDate, -1, 0),
      userId: users.employee._id,
      startTime: '08:00',
      endTime: '14:00',
      workHours: 6,
      hourlyRate: 120000,
      cost: 720000,
      notes: refs.noteTag,
      paid: false,
      paymentStatus: 'in_statement',
      createdAt: shiftDays(baseDate, -1, 18),
      updatedAt: shiftDays(baseDate, -1, 18),
    },
  ];

  const closedStatement = {
    _id: new mongoose.Types.ObjectId(),
    employeeId: users.employee._id,
    periodFrom: startOfDay(shiftDays(baseDate, -10, 0)),
    periodTo: endOfDay(shiftDays(baseDate, -7, 0)),
    status: 'closed',
    openingBalance: 0,
    periodCost: 900000,
    totalWorkHours: 9,
    sessionCount: 2,
    attendanceBonus: 100000,
    kpiBonus: 0,
    punctualityBonus: 0,
    onTimeDays: 2,
    lateDays: 0,
    bonus: 0,
    deduction: 0,
    statementPaymentTotal: 1000000,
    closingBalance: 0,
    payments: [
      {
        amount: 1000000,
        paidAt: closedPaidAt,
        method: 'bank_transfer',
        reference: `LABOR-CLOSED-${refs.slug}`,
        notes: refs.noteTag,
        createdBy: refs.emails.director,
        documents: [],
      },
    ],
    laborCostIds: [laborCosts[0]._id, laborCosts[1]._id],
    confirmedAt: shiftDays(baseDate, -7, 19),
    confirmedBy: refs.emails.director,
    closedAt: closedPaidAt,
    closedBy: refs.emails.director,
    dueDate: shiftDays(baseDate, -6, 9),
    notes: refs.noteTag,
    createdAt: shiftDays(baseDate, -7, 19),
    updatedAt: closedPaidAt,
  };

  const openStatementA = {
    _id: new mongoose.Types.ObjectId(),
    employeeId: users.employee._id,
    periodFrom: startOfDay(shiftDays(baseDate, -3, 0)),
    periodTo: endOfDay(shiftDays(baseDate, -1, 0)),
    status: 'open',
    openingBalance: 0,
    periodCost: 1920000,
    totalWorkHours: 16,
    sessionCount: 3,
    attendanceBonus: 150000,
    kpiBonus: 100000,
    punctualityBonus: 0,
    onTimeDays: 3,
    lateDays: 0,
    bonus: 200000,
    deduction: 50000,
    statementPaymentTotal: 0,
    closingBalance: 2320000,
    payments: [],
    laborCostIds: [laborCosts[2]._id, laborCosts[3]._id, laborCosts[4]._id],
    confirmedAt: shiftDays(baseDate, -1, 19),
    confirmedBy: refs.emails.director,
    dueDate: openDueA,
    notes: refs.noteTag,
    createdAt: shiftDays(baseDate, -1, 19),
    updatedAt: shiftDays(baseDate, -1, 19),
  };

  const openStatementB = {
    _id: new mongoose.Types.ObjectId(),
    employeeId: users.employee._id,
    periodFrom: startOfDay(shiftDays(baseDate, 0, 0)),
    periodTo: endOfDay(shiftDays(baseDate, 1, 0)),
    status: 'draft',
    openingBalance: 0,
    periodCost: 1100000,
    totalWorkHours: 10,
    sessionCount: 2,
    attendanceBonus: 100000,
    kpiBonus: 0,
    punctualityBonus: 0,
    onTimeDays: 2,
    lateDays: 0,
    bonus: 50000,
    deduction: 0,
    statementPaymentTotal: 0,
    closingBalance: 1250000,
    payments: [],
    laborCostIds: [],
    dueDate: openDueB,
    notes: refs.noteTag,
    createdAt: shiftDays(baseDate, 0, 20),
    updatedAt: shiftDays(baseDate, 0, 20),
  };

  return {
    laborCosts,
    laborStatements: [closedStatement, openStatementA, openStatementB],
  };
}

function buildOtherCosts(refs, baseDate) {
  return [
    {
      _id: new mongoose.Types.ObjectId(),
      date: shiftDays(baseDate, -2, 10),
      dueDate: shiftDays(baseDate, -2, 10),
      amount: 2500000,
      category: 'rent',
      notes: `${refs.noteTag}: confirmed rent`,
      documentLink: '',
      isConfirmed: true,
      confirmedAt: shiftDays(baseDate, -2, 11),
      createdAt: shiftDays(baseDate, -2, 11),
      updatedAt: shiftDays(baseDate, -2, 11),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      date: shiftDays(baseDate, 0, 10),
      dueDate: shiftDays(baseDate, 3, 10),
      amount: 800000,
      category: 'internet',
      notes: `${refs.noteTag}: internet due in 3d`,
      documentLink: '',
      isConfirmed: false,
      createdAt: shiftDays(baseDate, 0, 11),
      updatedAt: shiftDays(baseDate, 0, 11),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      date: shiftDays(baseDate, 0, 10),
      dueDate: shiftDays(baseDate, 9, 10),
      amount: 1200000,
      category: 'packaging',
      notes: `${refs.noteTag}: packaging due in 9d`,
      documentLink: '',
      isConfirmed: false,
      createdAt: shiftDays(baseDate, 0, 11),
      updatedAt: shiftDays(baseDate, 0, 11),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      date: shiftDays(baseDate, 0, 10),
      dueDate: shiftDays(baseDate, 20, 10),
      amount: 600000,
      category: 'tools',
      notes: `${refs.noteTag}: tools due in 20d`,
      documentLink: '',
      isConfirmed: false,
      createdAt: shiftDays(baseDate, 0, 11),
      updatedAt: shiftDays(baseDate, 0, 11),
    },
  ];
}

function buildFundingAndDebt(refs, baseDate) {
  const now = new Date();
  const fundingSources = [
    {
      _id: new mongoose.Types.ObjectId(),
      name: `Deep Seed Bank ${refs.slug}`,
      type: 'bank_account',
      principal: 95000000,
      availableBalance: 95000000,
      initialAmount: 95000000,
      isActive: true,
      status: 'active',
      notes: refs.noteTag,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new mongoose.Types.ObjectId(),
      name: `Deep Seed Personal Capital ${refs.slug}`,
      type: 'personal_capital',
      principal: 120000000,
      availableBalance: 120000000,
      initialAmount: 120000000,
      isActive: true,
      status: 'active',
      notes: refs.noteTag,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const loanContract = {
    _id: new mongoose.Types.ObjectId(),
    name: `Deep Seed Loan ${refs.slug}`,
    lenderName: `Deep Seed Lender ${refs.slug}`,
    principal: 30000000,
    principalRemaining: 18000000,
    interestRate: 12,
    repaymentCycle: 'monthly',
    startDate: shiftDays(baseDate, -30, 10),
    endDate: shiftDays(baseDate, 180, 10),
    restricted: false,
    status: 'active',
    notes: refs.noteTag,
    disbursementStatus: 'fully',
    disbursedAmount: 30000000,
    disbursedDate: shiftDays(baseDate, -30, 11),
    totalPrincipalPaid: 12000000,
    totalInterestPaid: 450000,
    createdAt: shiftDays(baseDate, -30, 11),
    updatedAt: new Date(),
  };

  const loanRepayments = [
    {
      _id: new mongoose.Types.ObjectId(),
      loanId: loanContract._id,
      amountPrincipal: 7000000,
      amountInterest: 450000,
      dueDate: shiftDays(baseDate, -10, 10),
      paid: true,
      paidDate: shiftDays(baseDate, -10, 16),
      fundingSource: 'bank',
      referenceId: `DEBT-PAID-${refs.slug}`,
      notes: refs.noteTag,
      createdAt: shiftDays(baseDate, -10, 16),
      updatedAt: shiftDays(baseDate, -10, 16),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      loanId: loanContract._id,
      amountPrincipal: 5000000,
      amountInterest: 300000,
      dueDate: shiftDays(baseDate, 5, 10),
      paid: false,
      fundingSource: 'bank',
      referenceId: `DEBT-UPCOMING-A-${refs.slug}`,
      notes: refs.noteTag,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      loanId: loanContract._id,
      amountPrincipal: 5000000,
      amountInterest: 250000,
      dueDate: shiftDays(baseDate, 20, 10),
      paid: false,
      fundingSource: 'bank',
      referenceId: `DEBT-UPCOMING-B-${refs.slug}`,
      notes: refs.noteTag,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  return {
    fundingSources,
    loanContract,
    loanRepayments,
  };
}

function buildSupplierAndAgentStatements(refs, users, core, orders, baseDate) {
  const userById = new Map(
    Object.values(users).map((user) => [String(user._id), user]),
  );

  const positiveSupplierOrders = orders.filter(
    (order) => valueOrZero(order.paidToCompanyAmount) > 0,
  );
  const supplierPayables = positiveSupplierOrders.map((order) => {
    const totalAmount = valueOrZero(order.paidToCompanyAmount);
    const isPaid = order.supplierPaymentStatus === 'paid';
    const supplier = userById.get(String(order.supplierId));
    return {
      _id: new mongoose.Types.ObjectId(),
      supplierId: order.supplierId,
      supplierNameSnap: supplier?.fullName || 'Unknown Supplier',
      orderId: order._id,
      status: isPaid ? 'paid' : 'unpaid',
      items: [
        {
          productId: order.productId,
          productNameSnap:
            String(order.productId) === String(core.productA._id)
              ? core.productA.name
              : core.productB.name,
          quantity: valueOrZero(order.quantity),
          unitPrice: totalAmount / Math.max(1, valueOrZero(order.quantity)),
          amount: totalAmount,
        },
      ],
      totalAmount,
      amountPaid: isPaid ? totalAmount : 0,
      balance: isPaid ? 0 : totalAmount,
      currency: 'VND',
      dueDate: shiftDays(order.orderDate, 10, 9),
      notes: refs.noteTag,
      payments: isPaid
        ? [
            {
              amount: totalAmount,
              paidAt: order.supplierPaidAt || shiftDays(order.orderDate, 2, 15),
              method: 'bank_transfer',
              reference: `${refs.codes.supplierBatch}-${String(order._id).slice(-6)}`,
              notes: refs.noteTag,
              createdBy: refs.emails.director,
            },
          ]
        : [],
      createdAt: order.orderDate,
      updatedAt: order.updatedAt,
    };
  });

  const supplierGroups = new Map();
  for (const order of orders) {
    if (!order.supplierId) {
      continue;
    }
    const key = String(order.supplierId);
    if (!supplierGroups.has(key)) {
      supplierGroups.set(key, []);
    }
    supplierGroups.get(key).push(order);
  }

  const supplierStatements = [];
  for (const [supplierId, supplierOrders] of supplierGroups.entries()) {
    const supplier = userById.get(supplierId);
    const paidOrders = supplierOrders.filter(
      (order) =>
        valueOrZero(order.paidToCompanyAmount) > 0 &&
        order.supplierPaymentStatus === 'paid',
    );
    const pendingOrders = supplierOrders.filter(
      (order) =>
        valueOrZero(order.paidToCompanyAmount) > 0 &&
        order.supplierPaymentStatus === 'pending',
    );
    const adjustmentOrders = supplierOrders.filter(
      (order) => valueOrZero(order.paidToCompanyAmount) < 0,
    );

    if (paidOrders.length) {
      const periodPayables = sumBy(
        paidOrders,
        (order) => valueOrZero(order.paidToCompanyAmount),
      );
      const periodCodCollected = sumBy(
        paidOrders,
        (order) => valueOrZero(order.codCollectedBySupplier),
      );
      const lastPaidAt = paidOrders
        .map((order) => order.supplierPaidAt || order.updatedAt)
        .sort((left, right) => new Date(left) - new Date(right))
        .slice(-1)[0];
      const periodFrom = new Date(
        Math.min(...paidOrders.map((order) => new Date(order.orderDate).getTime())),
      );
      const periodTo = new Date(
        Math.max(...paidOrders.map((order) => new Date(order.orderDate).getTime())),
      );

      supplierStatements.push({
        _id: new mongoose.Types.ObjectId(),
        supplierId: toObjectId(supplierId),
        periodFrom: startOfDay(periodFrom),
        periodTo: endOfDay(periodTo),
        status: 'closed',
        openingBalance: 0,
        periodPayables,
        periodPayments: periodPayables,
        periodCodCollected,
        statementPaymentTotal: periodPayables,
        closingBalance: 0,
        netAfterCod: periodCodCollected,
        notes: `${refs.noteTag}: paid statement`,
        adjustments: 0,
        payments: [
          {
            amount: periodPayables,
            paidAt: lastPaidAt || shiftDays(baseDate, -2, 16),
            method: 'bank_transfer',
            reference: `${refs.codes.supplierBatch}-CLOSED`,
            notes: refs.noteTag,
            createdBy: refs.emails.director,
            documents: [],
          },
        ],
        supplierNameSnap: supplier?.fullName,
        createdAt: shiftDays(baseDate, -2, 18),
        updatedAt: lastPaidAt || shiftDays(baseDate, -2, 18),
      });
    }

    const periodPayables = sumBy(
      pendingOrders,
      (order) => valueOrZero(order.paidToCompanyAmount),
    );
    const adjustments = sumBy(
      adjustmentOrders,
      (order) => valueOrZero(order.paidToCompanyAmount),
    );
    const closingBalance = Math.max(0, periodPayables + adjustments);
    if (closingBalance > 0) {
      supplierStatements.push({
        _id: new mongoose.Types.ObjectId(),
        supplierId: toObjectId(supplierId),
        periodFrom: startOfDay(shiftDays(baseDate, -2, 0)),
        periodTo: endOfDay(shiftDays(baseDate, 2, 0)),
        status: 'open',
        openingBalance: 0,
        periodPayables,
        periodPayments: 0,
        periodCodCollected: sumBy(
          pendingOrders,
          (order) => valueOrZero(order.codCollectedBySupplier),
        ),
        statementPaymentTotal: 0,
        closingBalance,
        netAfterCod:
          sumBy(
            pendingOrders,
            (order) => valueOrZero(order.codCollectedBySupplier),
          ) - closingBalance,
        notes: `${refs.noteTag}: open statement`,
        adjustments,
        payments: [],
        supplierNameSnap: supplier?.fullName,
        createdAt: shiftDays(baseDate, 0, 18),
        updatedAt: shiftDays(baseDate, 0, 18),
      });
    }
  }

  const externalAgentOrders = orders.filter(
    (order) =>
      order.agentId &&
      ![null, undefined].includes(order.agentId) &&
      String(order.agentId) !== String(users.agentInternal._id),
  );
  const agentGroups = new Map();
  for (const order of externalAgentOrders) {
    const key = String(order.agentId);
    if (!agentGroups.has(key)) {
      agentGroups.set(key, []);
    }
    agentGroups.get(key).push(order);
  }

  const agentStatements = [];
  for (const [agentId, agentOrders] of agentGroups.entries()) {
    const agent = userById.get(agentId);
    const paidOrders = agentOrders.filter(
      (order) =>
        valueOrZero(order.agentCommissionAmount || order.agentCommissionFinal) > 0 &&
        order.agentPaymentStatus === 'paid',
    );
    const pendingOrders = agentOrders.filter(
      (order) =>
        valueOrZero(order.agentCommissionAmount || order.agentCommissionFinal) > 0 &&
        order.agentPaymentStatus === 'pending',
    );
    const clawbackOrders = agentOrders.filter(
      (order) =>
        order.orderStatus === FINAL_STATUSES.returned &&
        order.agentPaymentStatus === 'paid' &&
        valueOrZero(order.agentCommissionAmount || order.agentCommissionFinal) > 0,
    );

    if (paidOrders.length) {
      const amountPaid = sumBy(
        paidOrders,
        (order) => valueOrZero(order.agentPaidAmount || order.agentCommissionAmount || order.agentCommissionFinal),
      );
      const lastPaidAt = paidOrders
        .map((order) => order.agentPaidAt || order.updatedAt)
        .sort((left, right) => new Date(left) - new Date(right))
        .slice(-1)[0];
      const periodFrom = new Date(
        Math.min(...paidOrders.map((order) => new Date(order.orderDate).getTime())),
      );
      const periodTo = new Date(
        Math.max(...paidOrders.map((order) => new Date(order.orderDate).getTime())),
      );

      agentStatements.push({
        _id: new mongoose.Types.ObjectId(),
        agentId: toObjectId(agentId),
        periodFrom: startOfDay(periodFrom),
        periodTo: endOfDay(periodTo),
        status: 'closed',
        openingBalance: 0,
        periodReceivables: amountPaid,
        periodCollected: sumBy(
          paidOrders,
          (order) =>
            valueOrZero(order.depositAmount) +
            valueOrZero(order.codAmount) +
            valueOrZero(order.manualPayment),
        ),
        statementPaymentTotal: amountPaid,
        closingBalance: 0,
        netAfterDelivery: amountPaid,
        notes: `${refs.noteTag}: paid agent statement`,
        carryForwardAdjustment: 0,
        payments: [
          {
            amount: amountPaid,
            paidAt: lastPaidAt || shiftDays(baseDate, -2, 16),
            method: 'bank_transfer',
            reference: `${refs.codes.agentBatch}-CLOSED`,
            notes: refs.noteTag,
            createdBy: refs.emails.director,
            documents: [],
          },
        ],
        agentNameSnap: agent?.fullName,
        createdAt: shiftDays(baseDate, -2, 18),
        updatedAt: lastPaidAt || shiftDays(baseDate, -2, 18),
      });
    }

    const pendingReceivables = sumBy(
      pendingOrders,
      (order) => valueOrZero(order.agentCommissionAmount || order.agentCommissionFinal),
    );
    const carryForwardAdjustment = sumBy(
      clawbackOrders,
      (order) => valueOrZero(order.agentCommissionAmount || order.agentCommissionFinal),
    );
    const closingBalance = Math.max(0, pendingReceivables - carryForwardAdjustment);
    if (closingBalance > 0 || carryForwardAdjustment > 0) {
      agentStatements.push({
        _id: new mongoose.Types.ObjectId(),
        agentId: toObjectId(agentId),
        periodFrom: startOfDay(shiftDays(baseDate, -2, 0)),
        periodTo: endOfDay(shiftDays(baseDate, 5, 0)),
        status: 'open',
        openingBalance: 0,
        periodReceivables: pendingReceivables,
        periodCollected: sumBy(
          pendingOrders,
          (order) =>
            valueOrZero(order.depositAmount) +
            valueOrZero(order.codAmount) +
            valueOrZero(order.manualPayment),
        ),
        statementPaymentTotal: 0,
        closingBalance,
        netAfterDelivery: pendingReceivables,
        notes: `${refs.noteTag}: open agent statement`,
        carryForwardAdjustment,
        payments: [],
        agentNameSnap: agent?.fullName,
        createdAt: shiftDays(baseDate, 0, 18),
        updatedAt: shiftDays(baseDate, 0, 18),
      });
    }
  }

  return {
    supplierPayables,
    supplierStatements,
    agentStatements,
  };
}

function buildCapitalSnapshots(refs, core, orders, advertisingSeed, baseDate) {
  const ratio = {
    reinvestment: 0.45,
    safety: 0.25,
    personal: 0.2,
    longTerm: 0.1,
  };
  const snapshots = [];
  const adsDailySpendings = [];
  const days = [7, 6, 5, 4, 3, 2, 1];

  for (const daysAgo of days) {
    const targetDate = shiftDays(baseDate, -daysAgo, 8);
    const dateKey = isoDateOnly(targetDate);
    const realizedProfitToDate = sumBy(
      orders.filter(
        (order) =>
          order.realizedAt && isoDateOnly(order.realizedAt) <= dateKey,
      ),
      (order) => valueOrZero(order.realizedNetProfit),
    );
    const totalNetProfit = Math.max(0, realizedProfitToDate);
    const dailyAds = advertisingSeed.advertisingCosts.filter(
      (item) => isoDateOnly(item.date) === dateKey,
    );
    const totalAdsCost = sumBy(dailyAds, (item) => valueOrZero(item.spentAmount));

    const snapshot = {
      _id: new mongoose.Types.ObjectId(),
      date: targetDate,
      policyName: 'deep-seed-default',
      totalNetProfit,
      reinvestmentAmount: Math.round(totalNetProfit * ratio.reinvestment),
      safetyReserveAmount: Math.round(totalNetProfit * ratio.safety),
      personalIncomeAmount: Math.round(totalNetProfit * ratio.personal),
      longTermAssetAmount: Math.round(totalNetProfit * ratio.longTerm),
      reinvestmentRatio: ratio.reinvestment,
      safetyReserveRatio: ratio.safety,
      personalIncomeRatio: ratio.personal,
      longTermAssetRatio: ratio.longTerm,
      reinvestmentUsed: totalAdsCost,
      safetyReserveUsed: Math.round(totalNetProfit * ratio.safety * 0.08),
      personalIncomeWithdrawn: Math.round(totalNetProfit * ratio.personal * 0.3),
      longTermAssetInvested: Math.round(totalNetProfit * ratio.longTerm * 0.2),
      note: refs.noteTag,
      isAutoGenerated: true,
      createdAt: targetDate,
      updatedAt: targetDate,
    };
    snapshots.push(snapshot);

    adsDailySpendings.push({
      _id: new mongoose.Types.ObjectId(),
      date: dateKey,
      snapshotId: snapshot._id,
      totalAdsCost,
      breakdown: dailyAds.map((item) => ({
        adGroupId: item.adGroupId,
        adGroupName:
          item.adGroupId === core.adGroups.alpha.adGroupId
            ? core.adGroups.alpha.name
            : item.adGroupId === core.adGroups.beta.adGroupId
            ? core.adGroups.beta.name
            : core.adGroups.gamma.name,
        adsCost: valueOrZero(item.spentAmount),
      })),
      syncedAt: targetDate,
      source: 'manual',
      note: refs.noteTag,
      createdAt: targetDate,
      updatedAt: targetDate,
    });
  }

  return {
    capitalAllocationSnapshots: snapshots,
    adsDailySpendings,
  };
}

function buildCashflowSnapshots(
  refs,
  users,
  orders,
  laborData,
  otherCosts,
  supplierAgentData,
  baseDate,
) {
  const userById = new Map(
    Object.values(users).map((user) => [String(user._id), user]),
  );
  const today = startOfDay(baseDate);

  function withinWindow(dateValue, windowDays) {
    if (!dateValue) {
      return false;
    }
    const value = startOfDay(dateValue);
    const end = shiftDays(today, windowDays, 0);
    return value >= today && value <= end;
  }

  function buildDueByDay(items) {
    const map = new Map();
    for (const item of items) {
      if (!withinWindow(item.date, 7)) {
        continue;
      }
      const key = isoDateOnly(item.date);
      map.set(key, (map.get(key) || 0) + valueOrZero(item.amount));
    }
    return Array.from(map.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([date, amount]) => ({ date, amount }));
  }

  function laborSnapshot(windowDays) {
    const dueStatements = laborData.laborStatements.filter(
      (statement) =>
        ['open', 'draft'].includes(statement.status) &&
        valueOrZero(statement.closingBalance) > 0 &&
        withinWindow(statement.dueDate, windowDays),
    );
    return {
      totalPayrollDue14d: sumBy(
        dueStatements,
        (statement) => valueOrZero(statement.closingBalance),
      ),
      dueByDay7d: buildDueByDay(
        dueStatements.map((statement) => ({
          date: statement.dueDate,
          amount: valueOrZero(statement.closingBalance),
        })),
      ),
      byEmployee: dueStatements.map((statement) => ({
        employeeId: String(statement.employeeId),
        employeeName:
          userById.get(String(statement.employeeId))?.fullName || 'Unknown Employee',
        unpaid: valueOrZero(statement.closingBalance),
        nextDueDate: statement.dueDate ? isoDateOnly(statement.dueDate) : null,
      })),
      asOfDate: isoDateOnly(baseDate),
      generatedAt: new Date().toISOString(),
    };
  }

  function opsSnapshot(windowDays) {
    const dueCosts = otherCosts.filter(
      (item) =>
        !item.isConfirmed &&
        valueOrZero(item.amount) > 0 &&
        withinWindow(item.dueDate, windowDays),
    );
    const categoryMap = new Map();
    for (const item of dueCosts) {
      categoryMap.set(
        item.category,
        (categoryMap.get(item.category) || 0) + valueOrZero(item.amount),
      );
    }
    return {
      totalOpsDue14d: sumBy(dueCosts, (item) => valueOrZero(item.amount)),
      byCategory: Array.from(categoryMap.entries()).map(([category, due14d]) => ({
        category,
        due14d,
      })),
      dueByDay7d: buildDueByDay(
        dueCosts.map((item) => ({ date: item.dueDate, amount: item.amount })),
      ),
      asOfDate: isoDateOnly(baseDate),
      generatedAt: new Date().toISOString(),
    };
  }

  function agentSnapshot(windowDays) {
    const pendingOrders = orders.filter(
      (order) =>
        order.agentId &&
        String(order.agentId) !== String(users.agentInternal._id) &&
        order.agentPaymentStatus === 'pending' &&
        valueOrZero(order.agentCommissionAmount || order.agentCommissionFinal) > 0 &&
        withinWindow(order.agentPaymentDueDate, windowDays),
    );

    const byAgent = new Map();
    for (const order of pendingOrders) {
      const key = String(order.agentId);
      const current = byAgent.get(key) || {
        agentId: key,
        agentName: userById.get(key)?.fullName || 'Unknown Agent',
        unpaid: 0,
        due14d: 0,
        clawback: 0,
        nextDueDate: null,
        lastPaymentDate: null,
      };
      const amount = valueOrZero(order.agentCommissionAmount || order.agentCommissionFinal);
      current.unpaid += amount;
      current.due14d += amount;
      const nextDueDate = order.agentPaymentDueDate
        ? isoDateOnly(order.agentPaymentDueDate)
        : null;
      if (!current.nextDueDate || (nextDueDate && nextDueDate < current.nextDueDate)) {
        current.nextDueDate = nextDueDate;
      }
      byAgent.set(key, current);
    }

    const historicalPaidOrders = orders.filter(
      (order) =>
        order.agentId &&
        String(order.agentId) !== String(users.agentInternal._id) &&
        order.agentPaymentStatus === 'paid' &&
        order.agentPaidAt,
    );
    for (const paidOrder of historicalPaidOrders) {
      const key = String(paidOrder.agentId);
      const existing = byAgent.get(key) || {
        agentId: key,
        agentName: userById.get(key)?.fullName || 'Unknown Agent',
        unpaid: 0,
        due14d: 0,
        clawback: 0,
        nextDueDate: null,
        lastPaymentDate: null,
      };
      const lastPaymentDate = isoDateOnly(paidOrder.agentPaidAt);
      if (!existing.lastPaymentDate || lastPaymentDate > existing.lastPaymentDate) {
        existing.lastPaymentDate = lastPaymentDate;
      }
      byAgent.set(key, existing);
    }

    return {
      totalAgentDue14d: sumBy(
        pendingOrders,
        (order) => valueOrZero(order.agentCommissionAmount || order.agentCommissionFinal),
      ),
      byAgent: Array.from(byAgent.values()).sort((left, right) => right.unpaid - left.unpaid),
      dueByDay7d: buildDueByDay(
        pendingOrders.map((order) => ({
          date: order.agentPaymentDueDate,
          amount: valueOrZero(order.agentCommissionAmount || order.agentCommissionFinal),
        })),
      ),
      asOfDate: isoDateOnly(baseDate),
      generatedAt: new Date().toISOString(),
    };
  }

  function supplierSnapshot() {
    const openStatements = supplierAgentData.supplierStatements.filter(
      (statement) => statement.status === 'open' && valueOrZero(statement.closingBalance) > 0,
    );
    const expectedInflowByDay = openStatements.map((statement, index) => {
      const expectedDate = shiftDays(
        statement.periodTo || baseDate,
        3 + index,
        9,
      );
      const grossAmount = valueOrZero(statement.closingBalance);
      const riskAdjustment = Math.round(grossAmount * -0.08);
      const onTimeAdjustment = Math.round((grossAmount + riskAdjustment) * -0.05);
      return {
        date: isoDateOnly(expectedDate),
        grossAmount,
        riskAdjustment,
        onTimeAdjustment,
        netAmount: grossAmount + riskAdjustment + onTimeAdjustment,
        orderCount: 1,
      };
    });

    const totalCommissionGrossEarned = sumBy(
      orders.filter(
        (order) =>
          order.orderStatus === FINAL_STATUSES.delivered &&
          valueOrZero(order.paidToCompanyAmount) > 0,
      ),
      (order) => valueOrZero(order.paidToCompanyAmount),
    );
    const totalAdjustments = sumBy(
      orders.filter((order) => valueOrZero(order.paidToCompanyAmount) < 0),
      (order) => valueOrZero(order.paidToCompanyAmount),
    );
    const totalCommissionNetEarned =
      totalCommissionGrossEarned + totalAdjustments;
    const totalCommissionReceived = sumBy(
      supplierAgentData.supplierStatements,
      (statement) => valueOrZero(statement.statementPaymentTotal),
    );

    return {
      totalCommissionGrossEarned,
      totalAdjustments,
      totalCommissionNetEarned,
      totalCommissionReceived,
      totalCommissionUnreceived: Math.max(
        0,
        totalCommissionNetEarned - totalCommissionReceived,
      ),
      totalCommissionExpected7d: sumBy(
        expectedInflowByDay,
        (item) => valueOrZero(item.netAmount),
      ),
      expectedInflowByDay,
      grossEarned: totalCommissionGrossEarned,
      unreceived: Math.max(0, totalCommissionNetEarned - totalCommissionReceived),
      totalPaid: totalCommissionReceived,
      netAfterCod: totalCommissionNetEarned,
      asOfDate: isoDateOnly(baseDate),
      timezone: 'Asia/Bangkok',
      settlementCycleDays: 10,
      returnRate: 0.08,
      onTimeRate: 0.95,
      settlementProfile: {
        type: 'D_PLUS_N',
        cycleDays: 10,
      },
      generatedAt: new Date().toISOString(),
      totalStatements: supplierAgentData.supplierStatements.length,
      openStatements: openStatements.length,
    };
  }

  return [
    { domain: 'labor', windowDays: 7, data: laborSnapshot(7) },
    { domain: 'labor', windowDays: 14, data: laborSnapshot(14) },
    { domain: 'labor', windowDays: 30, data: laborSnapshot(30) },
    { domain: 'ops', windowDays: 7, data: opsSnapshot(7) },
    { domain: 'ops', windowDays: 14, data: opsSnapshot(14) },
    { domain: 'ops', windowDays: 30, data: opsSnapshot(30) },
    { domain: 'agent', windowDays: 7, data: agentSnapshot(7) },
    { domain: 'agent', windowDays: 14, data: agentSnapshot(14) },
    { domain: 'agent', windowDays: 30, data: agentSnapshot(30) },
    { domain: 'supplier', windowDays: -1, data: supplierSnapshot() },
  ];
}

function summarizeOrders(orders) {
  const deliveredOrders = orders.filter(
    (order) => order.orderStatus === FINAL_STATUSES.delivered,
  );
  const returnedOrders = orders.filter(
    (order) => order.orderStatus === FINAL_STATUSES.returned,
  );
  const realizedOrders = orders.filter((order) => !!order.realizedAt);
  const pendingSupplier = orders.filter(
    (order) => order.supplierPaymentStatus === 'pending',
  );
  const pendingAgent = orders.filter(
    (order) => order.agentPaymentStatus === 'pending',
  );

  return {
    totalOrders: orders.length,
    deliveredOrders: deliveredOrders.length,
    returnedOrders: returnedOrders.length,
    realizedOrders: realizedOrders.length,
    pendingSupplierOrders: pendingSupplier.length,
    pendingAgentOrders: pendingAgent.length,
    totalRevenue: sumBy(
      orders,
      (order) =>
        valueOrZero(order.depositAmount) +
        valueOrZero(order.codAmount) +
        valueOrZero(order.manualPayment),
    ),
    totalEstimatedNetProfit: sumBy(
      orders,
      (order) => valueOrZero(order.netProfit),
    ),
    totalRealizedNetProfit: sumBy(
      realizedOrders,
      (order) => valueOrZero(order.realizedNetProfit),
    ),
  };
}

async function setup(tag = DEFAULT_TAG) {
  const normalizedTag = slugifyTag(tag);
  if (loadState(normalizedTag)) {
    throw new Error(
      `Seed state for tag "${normalizedTag}" already exists. Run teardown first.`,
    );
  }

  const refs = makeSeedRefs(normalizedTag);
  const baseDate = startOfDay(new Date());
  const state = {
    tag: normalizedTag,
    createdAt: new Date().toISOString(),
    baseDate: baseDate.toISOString(),
    noteTag: refs.noteTag,
    inserted: {},
    previousSnapshots: [],
    credentials: {
      directorEmail: refs.emails.director,
      password: DEFAULT_PASSWORD,
    },
  };

  return withDb(async (db) => {
    const collections = collectionMap(db);
    state.previousSnapshots = await capturePreviousSnapshots(collections);
    saveState(normalizedTag, state);

    const cleanupOnFailure = async () => {
      await deleteInsertedDocs(collections, state);
      await restoreSnapshots(collections, state);
      deleteState(normalizedTag);
    };

    try {
      const conflictingUser = await collections.users.findOne({
        email: { $in: Object.values(refs.emails) },
      });
      if (conflictingUser) {
        throw new Error(
          `Existing user found for ${conflictingUser.email}. Use another tag or teardown old seed.`,
        );
      }

      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
      const users = buildUsers(refs, passwordHash);
      await collections.users.insertMany(Object.values(users), { ordered: true });
      addInserted(state, 'users', Object.values(users));
      saveState(normalizedTag, state);

      const core = buildCoreDocs(refs, users, baseDate);
      await collections.categories.insertOne(core.category);
      addInserted(state, 'categories', [core.category]);
      await collections.products.insertMany([core.productA, core.productB], { ordered: true });
      addInserted(state, 'products', [core.productA, core.productB]);
      await collections.fanpages.insertOne(core.fanpage);
      addInserted(state, 'fanpages', [core.fanpage]);
      await collections.adAccounts.insertOne(core.adAccount);
      addInserted(state, 'adAccounts', [core.adAccount]);
      await collections.adGroups.insertMany(Object.values(core.adGroups), {
        ordered: true,
      });
      addInserted(state, 'adGroups', Object.values(core.adGroups));
      saveState(normalizedTag, state);

      const orders = buildOrderDocs(refs, users, core, baseDate);
      await collections.orders.insertMany(orders, { ordered: true });
      addInserted(state, 'orders', orders);

      const advertisingSeed = buildAdvertisingCosts(refs, core, baseDate);
      await collections.adsCosts.insertMany(advertisingSeed.advertisingCosts, {
        ordered: true,
      });
      addInserted(state, 'adsCosts', advertisingSeed.advertisingCosts);
      await collections.adGroupDailyReports.insertMany(
        advertisingSeed.adGroupDailyReports,
        { ordered: true },
      );
      addInserted(state, 'adGroupDailyReports', advertisingSeed.adGroupDailyReports);

      const laborData = buildLaborData(refs, users, baseDate);
      await collections.laborCosts.insertMany(laborData.laborCosts, { ordered: true });
      addInserted(state, 'laborCosts', laborData.laborCosts);
      await collections.laborStatements.insertMany(laborData.laborStatements, {
        ordered: true,
      });
      addInserted(state, 'laborStatements', laborData.laborStatements);

      const otherCosts = buildOtherCosts(refs, baseDate);
      await collections.otherCosts.insertMany(otherCosts, { ordered: true });
      addInserted(state, 'otherCosts', otherCosts);

      const fundingData = buildFundingAndDebt(refs, baseDate);
      await collections.fundingSources.insertMany(fundingData.fundingSources, {
        ordered: true,
      });
      addInserted(state, 'fundingSources', fundingData.fundingSources);
      await collections.loanContracts.insertOne(fundingData.loanContract);
      addInserted(state, 'loanContracts', [fundingData.loanContract]);
      await collections.loanRepayments.insertMany(fundingData.loanRepayments, {
        ordered: true,
      });
      addInserted(state, 'loanRepayments', fundingData.loanRepayments);

      const supplierAgentData = buildSupplierAndAgentStatements(
        refs,
        users,
        core,
        orders,
        baseDate,
      );
      await collections.supplierPayables.insertMany(
        supplierAgentData.supplierPayables,
        { ordered: true },
      );
      addInserted(state, 'supplierPayables', supplierAgentData.supplierPayables);
      await collections.supplierStatements.insertMany(
        supplierAgentData.supplierStatements,
        { ordered: true },
      );
      addInserted(state, 'supplierStatements', supplierAgentData.supplierStatements);
      await collections.agentStatements.insertMany(
        supplierAgentData.agentStatements,
        { ordered: true },
      );
      addInserted(state, 'agentStatements', supplierAgentData.agentStatements);

      const capitalData = buildCapitalSnapshots(
        refs,
        core,
        orders,
        advertisingSeed,
        baseDate,
      );
      await collections.capitalAllocationSnapshots.insertMany(
        capitalData.capitalAllocationSnapshots,
        { ordered: true },
      );
      addInserted(
        state,
        'capitalAllocationSnapshots',
        capitalData.capitalAllocationSnapshots,
      );
      await collections.adsDailySpendings.insertMany(capitalData.adsDailySpendings, {
        ordered: true,
      });
      addInserted(state, 'adsDailySpendings', capitalData.adsDailySpendings);

      const snapshotDocs = buildCashflowSnapshots(
        refs,
        users,
        orders,
        laborData,
        otherCosts,
        supplierAgentData,
        baseDate,
      );
      for (const snapshot of snapshotDocs) {
        await collections.cashflowSnapshots.updateOne(
          { domain: snapshot.domain, windowDays: snapshot.windowDays },
          {
            $set: {
              domain: snapshot.domain,
              windowDays: snapshot.windowDays,
              data: snapshot.data,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              _id: new mongoose.Types.ObjectId(),
            },
          },
          { upsert: true },
        );
      }

      state.summary = {
        refs,
        orderSummary: summarizeOrders(orders),
        counts: {
          users: Object.keys(users).length,
          products: 2,
          adGroups: 3,
          advertisingCosts: advertisingSeed.advertisingCosts.length,
          adGroupDailyReports: advertisingSeed.adGroupDailyReports.length,
          laborStatements: laborData.laborStatements.length,
          otherCosts: otherCosts.length,
          supplierStatements: supplierAgentData.supplierStatements.length,
          agentStatements: supplierAgentData.agentStatements.length,
          capitalSnapshots: capitalData.capitalAllocationSnapshots.length,
          cashflowSnapshots: snapshotDocs.length,
        },
      };
      saveState(normalizedTag, state);

      return {
        tag: normalizedTag,
        refs,
        credentials: state.credentials,
        summary: state.summary,
      };
    } catch (error) {
      await cleanupOnFailure();
      throw error;
    }
  });
}

async function buildDbVerificationSummary(tag = DEFAULT_TAG) {
  const normalizedTag = slugifyTag(tag);
  const state = loadState(normalizedTag);
  if (!state) {
    throw new Error(`No seed state found for tag "${normalizedTag}".`);
  }

  return withDb(async (db) => {
    const collections = collectionMap(db);
    const noteTag = state.noteTag;

    const [
      users,
      orders,
      laborStatements,
      otherCosts,
      supplierStatements,
      agentStatements,
      capitalSnapshots,
      cashflowSnapshots,
      loanRepayments,
    ] = await Promise.all([
      collections.users.countDocuments({ notes: noteTag }),
      collections.orders
        .find({ serviceDetails: noteTag })
        .project({
          _id: 1,
          orderStatus: 1,
          supplierPaymentStatus: 1,
          agentPaymentStatus: 1,
          realizedAt: 1,
          productId: 1,
          adGroupId: 1,
        })
        .toArray(),
      collections.laborStatements.countDocuments({ notes: noteTag }),
      collections.otherCosts.countDocuments({ notes: { $regex: noteTag } }),
      collections.supplierStatements.countDocuments({ notes: { $regex: noteTag } }),
      collections.agentStatements.countDocuments({ notes: { $regex: noteTag } }),
      collections.capitalAllocationSnapshots.countDocuments({ note: noteTag }),
      collections.cashflowSnapshots
        .find({
          $or: SNAPSHOT_KEYS.map((key) => ({
            domain: key.domain,
            windowDays: key.windowDays,
          })),
        })
        .toArray(),
      collections.loanRepayments.find({ notes: noteTag }).toArray(),
    ]);

    const pendingSupplierOrders = orders.filter(
      (order) => order.supplierPaymentStatus === 'pending',
    ).length;
    const pendingAgentOrders = orders.filter(
      (order) => order.agentPaymentStatus === 'pending',
    ).length;
    const returnedOrders = orders.filter(
      (order) => order.orderStatus === FINAL_STATUSES.returned,
    ).length;
    const deliveredOrders = orders.filter(
      (order) => order.orderStatus === FINAL_STATUSES.delivered,
    ).length;
    const realizedOrders = orders.filter((order) => !!order.realizedAt).length;
    const distinctProducts = new Set(orders.map((order) => String(order.productId))).size;
    const distinctAdGroups = new Set(orders.map((order) => String(order.adGroupId))).size;
    const upcomingRepayments = loanRepayments.filter(
      (repayment) => !repayment.paid,
    ).length;

    return {
      tag: normalizedTag,
      users,
      orders: orders.length,
      deliveredOrders,
      returnedOrders,
      realizedOrders,
      pendingSupplierOrders,
      pendingAgentOrders,
      distinctProducts,
      distinctAdGroups,
      laborStatements,
      otherCosts,
      supplierStatements,
      agentStatements,
      capitalSnapshots,
      cashflowSnapshots: cashflowSnapshots.length,
      upcomingRepayments,
    };
  });
}

async function verifyApi(tag = DEFAULT_TAG) {
  const normalizedTag = slugifyTag(tag);
  const state = loadState(normalizedTag);
  if (!state) {
    throw new Error(`No seed state found for tag "${normalizedTag}".`);
  }

  const fetchImpl = global.fetch ? global.fetch.bind(global) : require('node-fetch');
  const baseUrl = loadBaseUrl();
  const apiBase = `${baseUrl}/api`;
  const refs = state.summary?.refs || makeSeedRefs(normalizedTag);
  const targetDate = isoDateOnly(state.baseDate);
  const fromDate = isoDateOnly(shiftDays(state.baseDate, -7, 0));

  async function requestJson(pathname, options = {}) {
    const response = await fetchImpl(`${apiBase}${pathname}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message =
        data && typeof data === 'object'
          ? JSON.stringify(data)
          : String(data || response.statusText);
      throw new Error(`${pathname} -> ${response.status} ${message}`);
    }

    return data;
  }

  const login = await requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: state.credentials.directorEmail,
      password: state.credentials.password,
    }),
  });

  if (!login?.access_token) {
    throw new Error('Login succeeded but access_token was missing.');
  }

  const authHeaders = {
    Authorization: `Bearer ${login.access_token}`,
  };

  const dailyProfit = await requestJson(
    `/test-order2/daily-profit-report?date=${targetDate}`,
    { headers: authHeaders },
  );
  const productProfit = await requestJson(
    `/test-order2/product-profit-report?from=${fromDate}&to=${targetDate}`,
    { headers: authHeaders },
  );
  const supplierPending = await requestJson(
    '/test-order2/payment-pending/supplier',
    { headers: authHeaders },
  );
  const agentPending = await requestJson(
    '/test-order2/payment-pending/agent',
    { headers: authHeaders },
  );
  const returnByAdGroup = await requestJson(
    `/return-report/ad-group?fromDate=${fromDate}&toDate=${targetDate}&adGroupId=${encodeURIComponent(refs.codes.adGroupBeta)}`,
    { headers: authHeaders },
  );
  const returnByProduct = await requestJson(
    `/return-report/product?fromDate=${fromDate}&toDate=${targetDate}&productId=${state.inserted.products[1]}`,
    { headers: authHeaders },
  );
  const adGroupDailyReport = await requestJson(
    `/ad-group-daily-report?fromDate=${fromDate}&toDate=${targetDate}&adGroupId=${encodeURIComponent(refs.codes.adGroupAlpha)}`,
    { headers: authHeaders },
  );
  const loanSummary = await requestJson('/finance/loans/summary', {
    headers: authHeaders,
  });
  const upcomingRepayments = await requestJson(
    '/finance/repayments/upcoming?days=30',
    { headers: authHeaders },
  );
  const moduleHealth = await requestJson('/financial-control/module-health', {
    headers: authHeaders,
  });

  let financialControl = null;
  let financialControlWarning = null;
  try {
    financialControl = await requestJson(
      '/financial-control/dashboard?forceRefresh=true',
      { headers: authHeaders },
    );
  } catch (error) {
    financialControlWarning = error.message;
  }

  const supplierPendingOrders = Array.isArray(supplierPending?.orders)
    ? supplierPending.orders
    : Array.isArray(supplierPending?.items)
    ? supplierPending.items
    : [];
  const agentPendingOrders = Array.isArray(agentPending?.orders)
    ? agentPending.orders
    : Array.isArray(agentPending?.items)
    ? agentPending.items
    : [];
  const seedSupplierOrders = supplierPendingOrders.filter(
    (order) =>
      order?.serviceDetails === refs.noteTag ||
      String(order?.trackingNumber || '').startsWith('DEEP-TRACK-'),
  );
  const seedAgentOrders = agentPendingOrders.filter(
    (order) =>
      order?.serviceDetails === refs.noteTag ||
      String(order?.trackingNumber || '').startsWith('DEEP-TRACK-'),
  );
  const productProfitProducts = Array.isArray(productProfit?.products)
    ? productProfit.products
    : [];
  const deepProducts = productProfitProducts.filter((product) =>
    String(product?.productName || '').includes(refs.slug),
  );
  const returnAdGroupRows = Array.isArray(returnByAdGroup) ? returnByAdGroup : [];
  const returnProductRows = Array.isArray(returnByProduct) ? returnByProduct : [];
  const adGroupDailyRows = Array.isArray(adGroupDailyReport?.rows)
    ? adGroupDailyReport.rows
    : Array.isArray(adGroupDailyReport?.data)
    ? adGroupDailyReport.data
    : Array.isArray(adGroupDailyReport?.details)
    ? adGroupDailyReport.details
    : Array.isArray(adGroupDailyReport)
    ? adGroupDailyReport
    : [];

  const apiSummary = {
    loginUser: login.user?.email || state.credentials.directorEmail,
    dailyProfitOrders: valueOrZero(dailyProfit?.estimated?.totalOrders),
    productProfitProducts: valueOrZero(productProfit?.totals?.totalProducts),
    deepProducts: deepProducts.length,
    pendingSupplierOrders: supplierPendingOrders.length,
    pendingAgentOrders: agentPendingOrders.length,
    seedSupplierOrders: seedSupplierOrders.length,
    seedAgentOrders: seedAgentOrders.length,
    returnAdGroupRows: returnAdGroupRows.length,
    returnProductRows: returnProductRows.length,
    adGroupDailyRows: adGroupDailyRows.length,
    loanContracts: valueOrZero(loanSummary?.totalContracts),
    upcomingRepayments: Array.isArray(upcomingRepayments)
      ? upcomingRepayments.length
      : valueOrZero(upcomingRepayments?.length),
    moduleHealthOverall: moduleHealth?.overall || 'unknown',
    financialControl,
    financialControlWarning,
  };

  if (apiSummary.dailyProfitOrders <= 0) {
    throw new Error('API verify failed: daily-profit-report returned no completed orders.');
  }
  if (apiSummary.deepProducts <= 0) {
    throw new Error('API verify failed: product-profit-report did not expose seeded product names.');
  }
  if (apiSummary.seedSupplierOrders <= 0) {
    throw new Error('API verify failed: supplier pending payment list did not include seeded orders.');
  }
  if (apiSummary.seedAgentOrders <= 0) {
    throw new Error('API verify failed: agent pending payment list did not include seeded orders.');
  }
  if (apiSummary.returnAdGroupRows <= 0 || apiSummary.returnProductRows <= 0) {
    throw new Error('API verify failed: return-report is still empty.');
  }
  if (apiSummary.adGroupDailyRows <= 0) {
    throw new Error('API verify failed: ad-group-daily-report returned no rows.');
  }
  if (apiSummary.loanContracts <= 0 || apiSummary.upcomingRepayments <= 0) {
    throw new Error('API verify failed: loan data is incomplete.');
  }
  if (!['ok', 'partial'].includes(apiSummary.moduleHealthOverall)) {
    throw new Error(
      `API verify failed: financial-control module health = ${apiSummary.moduleHealthOverall}`,
    );
  }

  return {
    baseUrl,
    apiSummary,
  };
}

async function verify(tag = DEFAULT_TAG) {
  const dbSummary = await buildDbVerificationSummary(tag);
  let api = null;
  let apiWarning = null;

  try {
    api = await verifyApi(tag);
  } catch (error) {
    apiWarning = error.message;
  }

  const checks = [
    ['users', dbSummary.users >= 8],
    ['orders', dbSummary.orders >= 8],
    ['returnedOrders', dbSummary.returnedOrders >= 2],
    ['pendingSupplierOrders', dbSummary.pendingSupplierOrders >= 2],
    ['pendingAgentOrders', dbSummary.pendingAgentOrders >= 1],
    ['distinctProducts', dbSummary.distinctProducts >= 2],
    ['distinctAdGroups', dbSummary.distinctAdGroups >= 3],
    ['laborStatements', dbSummary.laborStatements >= 2],
    ['supplierStatements', dbSummary.supplierStatements >= 2],
    ['agentStatements', dbSummary.agentStatements >= 2],
    ['capitalSnapshots', dbSummary.capitalSnapshots >= 7],
    ['cashflowSnapshots', dbSummary.cashflowSnapshots === SNAPSHOT_KEYS.length],
    ['upcomingRepayments', dbSummary.upcomingRepayments >= 2],
  ];
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name);
  if (failedChecks.length) {
    throw new Error(`DB verify failed: ${failedChecks.join(', ')}`);
  }

  return {
    dbSummary,
    api,
    apiWarning,
  };
}

async function teardown(tag = DEFAULT_TAG) {
  const normalizedTag = slugifyTag(tag);
  const state = loadState(normalizedTag);
  if (!state) {
    return {
      tag: normalizedTag,
      removed: false,
      message: 'No seed state found.',
    };
  }

  return withDb(async (db) => {
    const collections = collectionMap(db);
    await deleteInsertedDocs(collections, state);
    await restoreSnapshots(collections, state);
    deleteState(normalizedTag);
    return {
      tag: normalizedTag,
      removed: true,
      message: 'Seed data removed and snapshots restored.',
    };
  });
}

async function main() {
  const action = String(process.argv[2] || 'setup').trim().toLowerCase();
  const tag = process.argv[3] || DEFAULT_TAG;

  if (!['setup', 'verify', 'teardown'].includes(action)) {
    throw new Error(
      'Usage: node scripts/seed-deep-test-dataset.js <setup|verify|teardown> [tag]',
    );
  }

  let result;
  if (action === 'setup') {
    result = await setup(tag);
  } else if (action === 'verify') {
    result = await verify(tag);
  } else {
    result = await teardown(tag);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
