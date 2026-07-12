#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  orderGroupCount: 24,
  ordersPerGroup: 2,
  withdrawalCount: 24,
  returnCount: 24,
  otherCostCount: 24,
};

const LOAD03_ROOT_BASE_URL_MANIFEST_FIELDS = [
  'load03RootBaseUrl',
  'load03BaseUrl',
  'load03.rootBaseUrl',
  'load03.baseUrl',
  'perf.load03.rootBaseUrl',
  'perf.load03.baseUrl',
  'writeContentionRootBaseUrl',
  'writeContentionBaseUrl',
  'writeContention.rootBaseUrl',
  'writeContention.baseUrl',
  'perf.writeContention.rootBaseUrl',
  'perf.writeContention.baseUrl',
  'backendBaseUrl',
];

function normalizeRootBaseUrl(input) {
  const trimmed = String(input || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('BACKEND_BASE_URL is required');
  }

  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

function parsePositiveInt(input, fallback) {
  const parsed = Number.parseInt(String(input ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

let runtimeManifestCache;

function stripUtf8Bom(text) {
  return String(text || '').replace(/^\uFEFF/, '');
}

function getManifestField(source, fieldPath) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const segments = String(fieldPath || '').split('.');
  let current = source;
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return null;
    }
    current = current[segment];
  }

  if (current == null) {
    return null;
  }

  const trimmed = String(current).trim();
  return trimmed || null;
}

function getRuntimeManifest() {
  if (runtimeManifestCache !== undefined) {
    return runtimeManifestCache;
  }

  const manifestPath = String(process.env.BACKEND_RUNTIME_MANIFEST || '').trim();
  if (!manifestPath) {
    runtimeManifestCache = null;
    return runtimeManifestCache;
  }

  const resolvedPath = path.resolve(manifestPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`BACKEND_RUNTIME_MANIFEST not found: ${resolvedPath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(stripUtf8Bom(fs.readFileSync(resolvedPath, 'utf8')));
  } catch (error) {
    throw new Error(`BACKEND_RUNTIME_MANIFEST could not be parsed: ${resolvedPath}: ${error.message}`);
  }

  runtimeManifestCache = parsed;
  return runtimeManifestCache;
}

function pickRuntimeManifestField(fieldPaths) {
  const manifest = getRuntimeManifest();
  if (!manifest) {
    return null;
  }

  for (const fieldPath of fieldPaths) {
    const value = getManifestField(manifest, fieldPath);
    if (value) {
      return value;
    }
  }

  return null;
}

function resolveRootBaseUrl() {
  const explicitBaseUrl = String(process.env.BACKEND_BASE_URL || '').trim();
  if (explicitBaseUrl) {
    return normalizeRootBaseUrl(explicitBaseUrl);
  }

  const manifestBaseUrl = pickRuntimeManifestField(LOAD03_ROOT_BASE_URL_MANIFEST_FIELDS);
  if (manifestBaseUrl) {
    return normalizeRootBaseUrl(manifestBaseUrl);
  }

  throw new Error(
    `BACKEND_BASE_URL is required, or BACKEND_RUNTIME_MANIFEST must provide one of: ${LOAD03_ROOT_BASE_URL_MANIFEST_FIELDS.join(', ')}`,
  );
}

function getId(value) {
  if (!value || typeof value !== 'object') {
    return '';
  }
  return String(value._id || value.id || '');
}

function getCollectionItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload && payload.data && Array.isArray(payload.data.items)) {
    return payload.data.items;
  }
  if (payload && Array.isArray(payload.items)) {
    return payload.items;
  }
  return [];
}

function jsonHeaders(token) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

async function apiRequest(rootBaseUrl, method, apiPath, options = {}) {
  const url = apiPath.startsWith('http') ? apiPath : `${rootBaseUrl}/api${apiPath}`;
  const response = await fetch(url, {
    method,
    headers: jsonHeaders(options.token),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await parseResponse(response);
  const expectedStatuses = options.expectedStatuses || [200, 201];

  if (!expectedStatuses.includes(response.status)) {
    const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
    throw new Error(`${method} ${url} expected ${expectedStatuses.join('/')} but got ${response.status}: ${detail}`);
  }

  return payload;
}

async function login(rootBaseUrl, email, password) {
  const payload = await apiRequest(rootBaseUrl, 'POST', '/auth/login', {
    body: { email, password },
    expectedStatuses: [200, 201],
  });

  const token =
    payload?.access_token ||
    payload?.accessToken ||
    payload?.token ||
    payload?.data?.access_token ||
    payload?.data?.accessToken;

  if (!token) {
    throw new Error(`Login did not return an access token: ${JSON.stringify(payload)}`);
  }

  const directorUserId =
    String(payload?.user?._id || payload?.user?.id || payload?.data?.user?._id || payload?.data?.user?.id || '');

  return { token, directorUserId };
}

async function resolveUsers(rootBaseUrl, token) {
  const payload = await apiRequest(rootBaseUrl, 'GET', '/users', { token, expectedStatuses: [200] });
  const users = getCollectionItems(payload);

  const supplier = users.find((item) => item.role === 'internal_supplier' || item.role === 'external_supplier');
  const agent = users.find((item) => item.role === 'external_agent');

  if (!supplier) {
    throw new Error('Missing supplier fixture. Run tests/backend/setup/ensure-regression-users.js against the isolate Mongo first.');
  }

  if (!agent) {
    throw new Error('Missing external agent fixture. Run tests/backend/setup/ensure-regression-users.js against the isolate Mongo first.');
  }

  return {
    supplierId: getId(supplier),
    agentId: getId(agent),
  };
}

async function resolveCanonicalStatuses(rootBaseUrl, token) {
  const payload = await apiRequest(rootBaseUrl, 'GET', '/delivery-status', { token, expectedStatuses: [200] });
  const items = getCollectionItems(payload);

  const delivered = items.find((item) => item?.isFinal === true && item?.isReturnStatus !== true);
  const returned = items.find((item) => item?.isReturnStatus === true);

  return {
    deliveredStatus: String(delivered?.name || 'Giao th\u00e0nh c\u00f4ng'),
    returnedStatus: String(returned?.name || 'H\u00e0ng ho\u00e0n'),
  };
}

async function createCategory(rootBaseUrl, token, suffix) {
  const payload = await apiRequest(rootBaseUrl, 'POST', '/product-category', {
    token,
    body: {
      name: `Write Contention Category ${suffix}`,
      description: 'LOAD-03 write-heavy contention fixture',
      color: '#0F766E',
      isActive: true,
    },
  });

  return {
    categoryId: getId(payload),
  };
}

async function createProduct(rootBaseUrl, token, categoryId, suffix) {
  const payload = await apiRequest(rootBaseUrl, 'POST', '/products', {
    token,
    body: {
      name: `Write Contention Product ${suffix}`,
      categoryId,
      importPrice: 50000,
      shippingCost: 15000,
      packagingCost: 10000,
      isReturnable: true,
      minStock: 0,
    },
  });

  return {
    productId: getId(payload),
  };
}

async function createFanpage(rootBaseUrl, token, suffix) {
  const payload = await apiRequest(rootBaseUrl, 'POST', '/fanpages', {
    token,
    body: {
      name: `Write Contention Fanpage ${suffix}`,
      pageId: `wc-page-${suffix.toLowerCase()}`,
      accessToken: `wc-token-${suffix.toLowerCase()}`,
    },
  });

  return {
    fanpageId: getId(payload),
  };
}

async function createAdAccount(rootBaseUrl, token, suffix) {
  const payload = await apiRequest(rootBaseUrl, 'POST', '/ad-accounts', {
    token,
    body: {
      name: `Write Contention Ad Account ${suffix}`,
      accountId: `wc-aa-${suffix.toLowerCase()}`,
      accountType: 'facebook',
    },
  });

  return {
    adAccountId: getId(payload),
  };
}

async function createAdGroup(rootBaseUrl, token, dependencies, suffix) {
  const payload = await apiRequest(rootBaseUrl, 'POST', '/ad-groups', {
    token,
    body: {
      name: `Write Contention Group ${suffix}`,
      adGroupId: `wc-ag-${suffix.toLowerCase()}`,
      platform: 'facebook',
      fanpageId: dependencies.fanpageId,
      productCategoryId: dependencies.categoryId,
      selectedProducts: [dependencies.productId],
      agentId: dependencies.agentId,
      adAccountId: dependencies.adAccountId,
      isActive: true,
    },
  });

  return {
    adGroupId: getId(payload),
  };
}

async function createSupplierQuote(rootBaseUrl, token, supplierId, productId, todayIso) {
  const payload = await apiRequest(rootBaseUrl, 'POST', '/supplier-quotes', {
    token,
    body: {
      supplierId,
      productId,
      price: 50000,
      shippingFee: 30000,
      returnFee: 25000,
      effectiveAt: todayIso,
    },
  });

  return {
    supplierQuoteId: getId(payload),
  };
}

async function createAgentQuote(rootBaseUrl, token, agentId, productId, todayIso, nextQuarterIso) {
  const payload = await apiRequest(rootBaseUrl, 'POST', '/quotes', {
    token,
    body: {
      agentId,
      productId,
      unitPrice: 80000,
      status: 'approved',
      validFrom: todayIso,
      validUntil: nextQuarterIso,
      notes: 'LOAD-03 write contention agent quote',
    },
  });

  return {
    agentQuoteId: getId(payload),
  };
}

async function createOrder(rootBaseUrl, token, body) {
  const payload = await apiRequest(rootBaseUrl, 'POST', '/test-order2', {
    token,
    body,
  });

  const orderId = getId(payload);
  if (!orderId) {
    throw new Error(`Create order returned no id: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function patchOrderStatus(rootBaseUrl, token, orderId, statusName) {
  return apiRequest(rootBaseUrl, 'PATCH', `/test-order2/${orderId}`, {
    token,
    body: { orderStatus: statusName },
    expectedStatuses: [200],
  });
}

async function createOwner(rootBaseUrl, token, suffix) {
  const payload = await apiRequest(rootBaseUrl, 'POST', '/owner-fund/owners', {
    token,
    body: {
      name: `Write Contention Owner ${suffix}`,
      email: `write-contention-owner-${suffix.toLowerCase()}@test.com`,
      phone: '0907777000',
      profitSharePercentage: 35,
      bankAccount: '123456789',
      bankName: 'VCB',
      bankAccountName: 'WRITE CONTENTION OWNER',
      isActive: true,
      notes: 'LOAD-03 isolated owner fixture',
    },
  });

  const ownerId = getId(payload);
  if (!ownerId) {
    throw new Error(`Create owner returned no id: ${JSON.stringify(payload)}`);
  }

  return {
    ownerId,
  };
}

async function depositOwnerBalance(rootBaseUrl, token, ownerId, amount, todayIso) {
  await apiRequest(rootBaseUrl, 'POST', '/owner-fund/transactions', {
    token,
    body: {
      ownerId,
      type: 'in',
      category: 'capital_contribution',
      amount,
      date: todayIso,
      description: 'LOAD-03 owner seed deposit',
    },
  });
}

async function createWithdrawal(rootBaseUrl, token, ownerId, amount, index) {
  const payload = await apiRequest(rootBaseUrl, 'POST', '/owner-fund/withdrawals', {
    token,
    body: {
      ownerId,
      amount,
      type: index % 2 === 0 ? 'profit_share' : 'advance',
      reason: `LOAD-03 withdrawal ${index + 1}`,
      notes: `write-contention-${index + 1}`,
      bankAccount: '123456789',
      bankName: 'VCB',
      bankAccountName: 'WRITE CONTENTION OWNER',
    },
  });

  const withdrawalId = getId(payload);
  if (!withdrawalId) {
    throw new Error(`Create withdrawal returned no id: ${JSON.stringify(payload)}`);
  }

  return {
    withdrawalId,
    amount,
    approvalAttempts: [
      `WC-WD-A-${index + 1}`,
      `WC-WD-B-${index + 1}`,
    ],
  };
}

async function createReturnFixture(rootBaseUrl, token, common, index, returnedStatus, todayIso) {
  const order = await createOrder(rootBaseUrl, token, {
    customerName: `Write Contention Return ${index + 1}`,
    productId: common.productId,
    supplierId: common.supplierId,
    agentId: common.agentId,
    adGroupId: common.adGroupId,
    quantity: 1,
    codAmount: 150000 + index * 1000,
    orderDate: todayIso,
    productionStatus: 'Chua lam',
    orderStatus: 'Dang giao',
  });

  const orderId = getId(order);
  await patchOrderStatus(rootBaseUrl, token, orderId, returnedStatus);

  const returnRequest = await apiRequest(rootBaseUrl, 'POST', '/returns', {
    token,
    body: {
      orderId,
      supplierId: common.supplierId,
      reason: `LOAD-03 return resolve ${index + 1}`,
      items: [
        {
          productId: common.productId,
          quantityReturned: 1,
          notes: `return-item-${index + 1}`,
        },
      ],
    },
  });

  const requestId = getId(returnRequest);
  const itemId = String(returnRequest?.items?.[0]?._id || '');
  if (!requestId || !itemId) {
    throw new Error(`Create return request fixture missing ids: ${JSON.stringify(returnRequest)}`);
  }

  return {
    requestId,
    orderId,
    resolvePayload: {
      reason: `LOAD-03 resolve ${index + 1}`,
      items: [
        {
          itemId,
          decision: index % 2 === 0 ? 'restock' : 'scrap',
          quantity: 1,
          recoveryUnitCost: index % 2 === 0 ? 40000 : 0,
        },
      ],
    },
  };
}

async function createOtherCostFixture(rootBaseUrl, token, index, todayIso, dueDateIso) {
  const amount = 120000 + index * 500;
  const payload = await apiRequest(rootBaseUrl, 'POST', '/other-cost', {
    token,
    body: {
      date: todayIso,
      dueDate: dueDateIso,
      amount,
      category: 'other',
      notes: `LOAD-03 other cost ${index + 1}`,
      isConfirmed: false,
    },
  });

  const costId = getId(payload);
  if (!costId) {
    throw new Error(`Create other-cost fixture returned no id: ${JSON.stringify(payload)}`);
  }

  return {
    costId,
    amount,
  };
}

async function createPaymentOrderGroups(rootBaseUrl, token, common, groupCount, ordersPerGroup, deliveredStatus, todayIso) {
  const groups = [];

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const orderIds = [];
    for (let itemIndex = 0; itemIndex < ordersPerGroup; itemIndex += 1) {
      const sequence = groupIndex * ordersPerGroup + itemIndex + 1;
      const order = await createOrder(rootBaseUrl, token, {
        customerName: `Write Contention Payment ${sequence}`,
        productId: common.productId,
        supplierId: common.supplierId,
        agentId: common.agentId,
        adGroupId: common.adGroupId,
        quantity: 2,
        codAmount: 240000 + sequence * 1000,
        orderDate: todayIso,
        productionStatus: 'Chua lam',
        orderStatus: 'Chua co ma van don',
      });

      const orderId = getId(order);
      await patchOrderStatus(rootBaseUrl, token, orderId, deliveredStatus);
      orderIds.push(orderId);
    }

    groups.push({
      orderIds,
      supplierBatchId: `WC-SUP-${String(groupIndex + 1).padStart(3, '0')}`,
      agentBatchId: `WC-AGT-${String(groupIndex + 1).padStart(3, '0')}`,
    });
  }

  return groups;
}

function writeJson(outputPath, data) {
  const resolved = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return resolved;
}

async function main() {
  const outputPath = process.argv[2] || process.env.WRITE_CONTENTION_FIXTURE;
  if (!outputPath) {
    throw new Error('Provide an output path as argv[2] or WRITE_CONTENTION_FIXTURE');
  }

  const rootBaseUrl = resolveRootBaseUrl();
  const email = String(process.env.BACKEND_EMAIL || 'director@test.com').trim();
  const password = String(process.env.BACKEND_PASSWORD || '123456').trim();

  const orderGroupCount = parsePositiveInt(process.env.LOAD03_ORDER_GROUP_COUNT, DEFAULTS.orderGroupCount);
  const ordersPerGroup = parsePositiveInt(process.env.LOAD03_ORDERS_PER_GROUP, DEFAULTS.ordersPerGroup);
  const withdrawalCount = parsePositiveInt(process.env.LOAD03_WITHDRAWAL_COUNT, DEFAULTS.withdrawalCount);
  const returnCount = parsePositiveInt(process.env.LOAD03_RETURN_COUNT, DEFAULTS.returnCount);
  const otherCostCount = parsePositiveInt(process.env.LOAD03_OTHER_COST_COUNT, DEFAULTS.otherCostCount);

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const dueDateIso = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const nextQuarterIso = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const suffix = today.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

  const { token, directorUserId } = await login(rootBaseUrl, email, password);
  const users = await resolveUsers(rootBaseUrl, token);
  const statuses = await resolveCanonicalStatuses(rootBaseUrl, token);
  const category = await createCategory(rootBaseUrl, token, suffix);
  const product = await createProduct(rootBaseUrl, token, category.categoryId, suffix);
  const fanpage = await createFanpage(rootBaseUrl, token, suffix);
  const adAccount = await createAdAccount(rootBaseUrl, token, suffix);
  const adGroup = await createAdGroup(rootBaseUrl, token, {
    categoryId: category.categoryId,
    productId: product.productId,
    fanpageId: fanpage.fanpageId,
    adAccountId: adAccount.adAccountId,
    agentId: users.agentId,
  }, suffix);

  const supplierQuote = await createSupplierQuote(rootBaseUrl, token, users.supplierId, product.productId, todayIso);
  const agentQuote = await createAgentQuote(rootBaseUrl, token, users.agentId, product.productId, todayIso, nextQuarterIso);

  const common = {
    supplierId: users.supplierId,
    agentId: users.agentId,
    productId: product.productId,
    adGroupId: adGroup.adGroupId,
  };

  const paymentOrderGroups = await createPaymentOrderGroups(
    rootBaseUrl,
    token,
    common,
    orderGroupCount,
    ordersPerGroup,
    statuses.deliveredStatus,
    todayIso,
  );

  const returnFixtures = [];
  for (let index = 0; index < returnCount; index += 1) {
    returnFixtures.push(await createReturnFixture(rootBaseUrl, token, common, index, statuses.returnedStatus, todayIso));
  }

  const otherCostFixtures = [];
  for (let index = 0; index < otherCostCount; index += 1) {
    otherCostFixtures.push(await createOtherCostFixture(rootBaseUrl, token, index, todayIso, dueDateIso));
  }

  const owner = await createOwner(rootBaseUrl, token, suffix);
  let totalWithdrawalAmount = 0;
  const withdrawalAmounts = [];
  for (let index = 0; index < withdrawalCount; index += 1) {
    const amount = 180000 + index * 1000;
    totalWithdrawalAmount += amount;
    withdrawalAmounts.push(amount);
  }

  const ownerInitialBalance = totalWithdrawalAmount + 1000000;
  await depositOwnerBalance(rootBaseUrl, token, owner.ownerId, ownerInitialBalance, todayIso);

  const withdrawalFixtures = [];
  for (let index = 0; index < withdrawalCount; index += 1) {
    withdrawalFixtures.push(await createWithdrawal(rootBaseUrl, token, owner.ownerId, withdrawalAmounts[index], index));
  }

  const fixture = {
    generatedAt: new Date().toISOString(),
    rootBaseUrl,
    apiBaseUrl: `${rootBaseUrl}/api`,
    healthUrl: `${rootBaseUrl}/health`,
    directorUserId,
    deliveredStatus: statuses.deliveredStatus,
    returnedStatus: statuses.returnedStatus,
    dependencies: {
      supplierId: users.supplierId,
      agentId: users.agentId,
      categoryId: category.categoryId,
      productId: product.productId,
      fanpageId: fanpage.fanpageId,
      adAccountId: adAccount.adAccountId,
      adGroupId: adGroup.adGroupId,
      supplierQuoteId: supplierQuote.supplierQuoteId,
      agentQuoteId: agentQuote.agentQuoteId,
      ownerId: owner.ownerId,
    },
    paymentOrderGroups,
    withdrawalFixtures,
    returnFixtures,
    otherCostFixtures,
    expected: {
      orderGroupCount,
      ordersPerGroup,
      orderCount: orderGroupCount * ordersPerGroup,
      withdrawalCount,
      totalWithdrawalAmount,
      ownerInitialBalance,
      returnCount,
      otherCostCount,
      totalConfirmedOtherCostAmount: otherCostFixtures.reduce((sum, item) => sum + item.amount, 0),
    },
  };

  const resolvedOutputPath = writeJson(outputPath, fixture);
  process.stdout.write(`${JSON.stringify({ ok: true, outputPath: resolvedOutputPath, counts: fixture.expected })}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  });
}
