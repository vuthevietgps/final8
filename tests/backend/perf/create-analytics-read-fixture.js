#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULTS = { groupCount: 24, ordersPerGroup: 8, returnEvery: 4, historyDays: 30, otherCostCount: 12 };

function rootBaseUrl(input) {
  const trimmed = String(input || '').trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('BACKEND_BASE_URL is required');
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

function intVal(input, fallback) {
  const parsed = Number.parseInt(String(input ?? fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isoDate(input) {
  return new Date(input).toISOString().slice(0, 10);
}

function headers(token) {
  const h = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function readJson(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function api(base, method, apiPath, opts = {}) {
  const url = apiPath.startsWith('http') ? apiPath : `${base}/api${apiPath}`;
  const res = await fetch(url, {
    method,
    headers: headers(opts.token),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const payload = await readJson(res);
  const expected = opts.expectedStatuses || [200, 201];
  if (!expected.includes(res.status)) {
    throw new Error(
      `${method} ${url} expected ${expected.join('/')} got ${res.status}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`,
    );
  }
  return payload;
}

function idOf(value) {
  return value && typeof value === 'object' ? String(value._id || value.id || '') : '';
}

function items(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && payload.data && Array.isArray(payload.data.items)) return payload.data.items;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
}

async function login(base, email, password) {
  const payload = await api(base, 'POST', '/auth/login', {
    body: { email, password },
    expectedStatuses: [200, 201],
  });
  const token =
    payload?.access_token ||
    payload?.accessToken ||
    payload?.token ||
    payload?.data?.access_token ||
    payload?.data?.accessToken;
  if (!token) throw new Error(`Login did not return a token: ${JSON.stringify(payload)}`);
  return { token, userId: String(payload?.user?.id || payload?.user?._id || payload?.data?.user?.id || payload?.data?.user?._id || '') };
}

async function resolveUsers(base, token) {
  const payload = await api(base, 'GET', '/users', { token, expectedStatuses: [200] });
  const users = items(payload);
  const supplier = users.find((u) => u.role === 'internal_supplier' || u.role === 'external_supplier');
  const agent = users.find((u) => u.role === 'external_agent');
  if (!supplier) throw new Error('Missing supplier fixture in /users');
  if (!agent) throw new Error('Missing external agent fixture in /users');
  return { supplierId: idOf(supplier), agentId: idOf(agent) };
}

async function resolveStatuses(base, token) {
  const payload = await api(base, 'GET', '/delivery-status', { token, expectedStatuses: [200] });
  const list = items(payload);
  const delivered = list.find((x) => x?.isFinal === true && x?.isReturnStatus !== true) || list.find((x) => /giao thanh cong/i.test(String(x?.name || '')));
  const returned = list.find((x) => x?.isReturnStatus === true) || list.find((x) => /hang hoan|hoan hang/i.test(String(x?.name || '')));
  return { delivered: String(delivered?.name || 'Giao thành công'), returned: String(returned?.name || 'Hàng hoàn') };
}

async function createCategory(base, token, name) {
  return idOf(await api(base, 'POST', '/product-category', { token, body: { name, description: 'LOAD-04 analytics read fixture', color: '#0F766E', isActive: true } }));
}

async function createProduct(base, token, categoryId, name, index) {
  return idOf(await api(base, 'POST', '/products', { token, body: { name, categoryId, status: 'active', color: index % 2 === 0 ? '#0EA5E9' : '#F97316', isReturnable: true, assumedReturnRatePercent: 15, importPrice: 42000 + index * 5000, shippingCost: 7000 + index * 1000, packagingCost: 3000 + index * 500, minStock: 0 } }));
}

async function createFanpage(base, token, name, index, runKey) {
  return idOf(await api(base, 'POST', '/fanpages', { token, body: { pageId: `analytics-read-page-${runKey}-${index}`, name, accessToken: `analytics-read-token-${runKey}-${index}`, status: 'active', timezone: 'Asia/Bangkok' } }));
}

async function createAdAccount(base, token, name, index, runKey) {
  return idOf(await api(base, 'POST', '/ad-accounts', { token, body: { name, accountId: `analytics-read-account-${runKey}-${index}`, accountType: 'facebook', managementMode: 'direct', isActive: true, tokenSource: 'manual' } }));
}

async function createAdGroup(base, token, deps, index) {
  return idOf(await api(base, 'POST', '/ad-groups', { token, body: { name: `Analytics Read Ad Group ${deps.runKey}-${index + 1}`, adGroupId: `analytics-read-ag-${deps.runKey}-${index + 1}`, platform: 'facebook', fanpageId: deps.fanpageId, productCategoryId: deps.categoryId, selectedProducts: [deps.productId], agentId: deps.agentId, adAccountId: deps.adAccountId, isActive: true, enableWebhook: false, autoControlEnabled: false, testingPhase: 'STABLE' } }));
}

async function createSupplierQuote(base, token, deps, index, orderDateIso) {
  return idOf(await api(base, 'POST', '/supplier-quotes', { token, body: { productId: deps.productId, supplierId: deps.supplierId, price: 42000 + index * 5000, currency: 'VND', effectiveAt: orderDateIso, isReturnableOverride: true, shippingFee: 7000 + index * 1000, returnFee: 4000 + index * 1000 } }));
}

async function createAgentQuote(base, token, deps, index, orderDateIso, validUntilIso) {
  return idOf(await api(base, 'POST', '/quotes', { token, body: { productId: deps.productId, agentId: deps.agentId, unitPrice: 78000 + index * 7000, status: 'approved', validFrom: orderDateIso, validUntil: validUntilIso } }));
}

async function createAdsCost(base, token, adGroupId, spentAmount, orderDateIso, index) {
  return idOf(await api(base, 'POST', '/advertising-cost', { token, body: { channel: 'facebook', date: orderDateIso, adGroupId, spentAmount, frequency: index + 1, impressions: 1000 + index * 100, clicks: 100 + index * 10, reach: 500 + index * 50, messagingConversationStarted7d: 20 + index, messagingFirstReply: 5 + index } }));
}

async function createCashflow(base, token, direction, amount, orderDateIso, index) {
  return idOf(await api(base, 'POST', '/finance/cashflows', { token, body: { direction, sourceType: 'owner_fund', amount, date: orderDateIso, category: direction === 'in' ? 'owner_fund_return' : 'owner_fund_transfer', description: `LOAD-04 ${direction} cashflow ${index + 1}` } }));
}

async function createOtherCost(base, token, amount, dateIso, dueDateIso, index) {
  return idOf(await api(base, 'POST', '/other-cost', {
    token,
    body: {
      date: dateIso,
      dueDate: dueDateIso,
      amount,
      category: index % 2 === 0 ? 'office-supplies' : 'other',
      notes: `LOAD-04 pending other-cost ${index + 1}`,
      isConfirmed: false,
    },
  }));
}

async function createOrder(base, token, body) {
  const payload = await api(base, 'POST', '/test-order2', { token, body, expectedStatuses: [200, 201] });
  const orderId = idOf(payload);
  if (!orderId) throw new Error(`Create order returned no id: ${JSON.stringify(payload)}`);
  return payload;
}

function sumRows(rows, fields) {
  const out = { rowCount: rows.length };
  for (const field of fields) out[field] = 0;
  for (const row of rows || []) for (const field of fields) out[field] += Number(row?.[field] || 0);
  return out;
}

function byKey(rows, keyField, fields) {
  const out = {};
  for (const row of rows) {
    const key = String(row?.[keyField] || row?.key || '');
    if (!key) continue;
    out[key] = {};
    for (const field of fields) out[key][field] = Number(row?.[field] || 0);
  }
  return out;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected}, got ${actual}`);
  }
}

async function seedGroup(base, token, root, index, statuses, quoteStartIso, quoteEndIso, returnEvery) {
  const categoryId = await createCategory(base, token, `Analytics Read Category ${root.runKey}-${index + 1}`);
  const productId = await createProduct(base, token, categoryId, `Analytics Read Product ${root.runKey}-${index + 1}`, index);
  const adGroupId = await createAdGroup(base, token, { categoryId, productId, fanpageId: root.fanpageId, adAccountId: root.adAccountId, agentId: root.agentId, runKey: root.runKey }, index);
  const supplierQuoteId = await createSupplierQuote(base, token, { productId, supplierId: root.supplierId }, index, quoteStartIso);
  const agentQuoteId = await createAgentQuote(base, token, { productId, agentId: root.agentId }, index, quoteStartIso, quoteEndIso);

  const adsDate = new Date(root.anchorDate.getTime() - (index % root.historyDays) * 24 * 60 * 60 * 1000);
  const advertisingCostId = await createAdsCost(base, token, adGroupId, 240000 + index * 120000, isoDate(adsDate), index);

  const orders = [];
  for (let orderIndex = 0; orderIndex < root.ordersPerGroup; orderIndex += 1) {
    const isReturn = (orderIndex + 1) % returnEvery === 0;
    const orderStatus = isReturn ? statuses.returned : statuses.delivered;
    const absoluteIndex = index * root.ordersPerGroup + orderIndex;
    const orderDate = new Date(root.anchorDate.getTime() - (absoluteIndex % root.historyDays) * 24 * 60 * 60 * 1000);
    const orderDateIso = isoDate(orderDate);
    const payload = await createOrder(base, token, {
      customerName: `Analytics Read Customer ${index + 1}-${orderIndex + 1}`,
      productId,
      quantity: (orderIndex % 2) + 1,
      agentId: root.agentId,
      adGroupId,
      productSource: 'marketing',
      supplierId: root.supplierId,
      supplierPriceLevel: 1,
      codAmount: 180000 + index * 30000 + orderIndex * 1500,
      orderStatus,
      productionStatus: 'Chua lam',
      orderDate: orderDateIso,
      receiverName: `Receiver ${index + 1}-${orderIndex + 1}`,
      receiverPhone: `090${String(1000000 + index * 100 + orderIndex).slice(-7)}`,
      receiverAddress: `QA Lane ${index + 1}-${orderIndex + 1}`,
    });
    orders.push({ orderId: idOf(payload), status: orderStatus, quantity: (orderIndex % 2) + 1, orderDate: orderDateIso });
  }

  return { categoryId, productId, adGroupId, supplierQuoteId, agentQuoteId, advertisingCostId, orders };
}

async function main() {
  const outputPath = process.argv[2] || process.env.ANALYTICS_READ_FIXTURE;
  if (!outputPath) throw new Error('Provide an output path as argv[2] or ANALYTICS_READ_FIXTURE');

  const base = rootBaseUrl(process.env.BACKEND_BASE_URL);
  const email = String(process.env.BACKEND_EMAIL || 'director@test.com').trim();
  const password = String(process.env.BACKEND_PASSWORD || '123456').trim();
  const groupCount = intVal(process.env.ANALYTICS_READ_GROUP_COUNT, DEFAULTS.groupCount);
  const ordersPerGroup = intVal(process.env.ANALYTICS_READ_ORDERS_PER_GROUP, DEFAULTS.ordersPerGroup);
  const returnEvery = intVal(process.env.ANALYTICS_READ_RETURN_EVERY, DEFAULTS.returnEvery);
  const historyDays = intVal(process.env.ANALYTICS_READ_HISTORY_DAYS, DEFAULTS.historyDays);
  const otherCostCount = intVal(process.env.ANALYTICS_READ_OTHER_COST_COUNT, DEFAULTS.otherCostCount);

  const anchorDate = new Date();
  const quoteStartDate = new Date(anchorDate.getTime() - (historyDays - 1) * 24 * 60 * 60 * 1000);
  const quoteEndDate = new Date(anchorDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const fromDateIso = isoDate(quoteStartDate);
  const toDateIso = isoDate(anchorDate);
  const quoteStartIso = fromDateIso;
  const quoteEndIso = isoDate(quoteEndDate);
  const suffix = anchorDate.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

  const { token, userId } = await login(base, email, password);
  const users = await resolveUsers(base, token);
  const statuses = await resolveStatuses(base, token);
  const fanpageId = await createFanpage(base, token, `Analytics Read Fanpage ${suffix}`, 1, suffix);
  const adAccountId = await createAdAccount(base, token, `Analytics Read Ad Account ${suffix}`, 1, suffix);

  const groups = [];
  for (let i = 0; i < groupCount; i += 1) {
    groups.push(await seedGroup(base, token, { supplierId: users.supplierId, agentId: users.agentId, fanpageId, adAccountId, ordersPerGroup, historyDays, anchorDate, runKey: suffix }, i, statuses, quoteStartIso, quoteEndIso, returnEvery));
  }

  await createCashflow(base, token, 'in', 1800000, toDateIso, 0);
  await createCashflow(base, token, 'out', 500000, toDateIso, 1);
  for (let index = 0; index < otherCostCount; index += 1) {
    const costDate = new Date(anchorDate.getTime() - (index % historyDays) * 24 * 60 * 60 * 1000);
    const dueDate = new Date(anchorDate.getTime() + ((index % 7) + 1) * 24 * 60 * 60 * 1000);
    await createOtherCost(base, token, 120000 + index * 3000, isoDate(costDate), isoDate(dueDate), index);
  }

  const performance = items(await api(base, 'GET', `/ad-group-profit-report/performance?startDate=${encodeURIComponent(fromDateIso)}&endDate=${encodeURIComponent(toDateIso)}&minOrders=1`, { token, expectedStatuses: [200] }));
  const returnProduct = items(await api(base, 'GET', `/return-report/product?fromDate=${encodeURIComponent(fromDateIso)}&toDate=${encodeURIComponent(toDateIso)}`, { token, expectedStatuses: [200] }));
  const returnAdGroup = items(await api(base, 'GET', `/return-report/ad-group?fromDate=${encodeURIComponent(fromDateIso)}&toDate=${encodeURIComponent(toDateIso)}`, { token, expectedStatuses: [200] }));
  const financial = await api(base, 'GET', '/financial-control/dashboard', { token, expectedStatuses: [200] });
  const cashflow = await api(base, 'GET', '/cashflow/dashboard/summary', { token, expectedStatuses: [200] });

  const expectedReturnCount = groups.reduce(
    (n, group) => n + group.orders.filter((o) => String(o.status || '') === String(statuses.returned || '')).length,
    0,
  );
  const performanceTotals = sumRows(performance, ['totalOrders', 'successOrders', 'returnOrders']);
  const returnProductTotals = sumRows(returnProduct, ['totalOrders', 'returnOrders']);
  const returnAdGroupTotals = sumRows(returnAdGroup, ['totalOrders', 'returnOrders']);
  assertEqual(performance.length, groupCount, 'performance rowCount');
  assertEqual(performanceTotals.totalOrders, groupCount * ordersPerGroup, 'performance totalOrders');
  assertEqual(performanceTotals.returnOrders, expectedReturnCount, 'performance returnOrders');
  assertEqual(returnProduct.length, groupCount, 'returnProduct rowCount');
  assertEqual(returnProductTotals.totalOrders, groupCount * ordersPerGroup, 'returnProduct totalOrders');
  assertEqual(returnProductTotals.returnOrders, expectedReturnCount, 'returnProduct returnOrders');
  assertEqual(returnAdGroup.length, groupCount, 'returnAdGroup rowCount');
  assertEqual(returnAdGroupTotals.totalOrders, groupCount * ordersPerGroup, 'returnAdGroup totalOrders');
  assertEqual(returnAdGroupTotals.returnOrders, expectedReturnCount, 'returnAdGroup returnOrders');

  const manifest = {
    generatedAt: new Date().toISOString(),
    rootBaseUrl: base,
    apiBaseUrl: `${base}/api`,
    healthUrl: `${base}/health`,
    auth: { userId, supplierId: users.supplierId, agentId: users.agentId, tokenReuse: true },
    window: { fromDate: fromDateIso, toDate: toDateIso, historyDays },
    selectors: { deliveredStatus: statuses.delivered, returnedStatus: statuses.returned },
    groups,
    expected: {
      financialControlDashboard: {
        bankBalance: Number(financial?.bankBalance || 0),
        committedCash: Number(financial?.committedCash || 0),
        freeCash: Number(financial?.freeCash || 0),
        monthlyBurn: Number(financial?.monthlyBurn || 0),
        runwayMonths: financial?.runwayMonths === null ? null : Number(financial?.runwayMonths || 0),
        adsBudgetApproved: Number(financial?.adsBudgetApproved || 0),
        ownerWithdrawable: Number(financial?.ownerWithdrawable || 0),
        totalDebtOutstanding: Number(financial?.totalDebtOutstanding || 0),
      },
      cashflowSummary: {
        bankBalance: Number(cashflow?.bankBalance || 0),
        committedCash: Number(cashflow?.committedCash || 0),
        freeCash: Number(cashflow?.freeCash || 0),
        adsFundBalance: Number(cashflow?.adsFundBalance || 0),
        cashflowSafetyIndex: Number(cashflow?.cashflowSafetyIndex || 0),
      },
      adGroupPerformance: {
        rowCount: performance.length,
        totals: sumRows(performance, ['totalOrders', 'successOrders', 'returnOrders', 'totalRevenue', 'totalNetProfit', 'totalAdsSpent']),
        byAdGroupId: byKey(performance, 'adGroupId', ['totalOrders', 'successOrders', 'returnOrders', 'totalRevenue', 'totalNetProfit', 'totalAdsSpent', 'realizedProfit', 'pendingProfit', 'riskyProfit']),
      },
      returnReportProduct: {
        rowCount: returnProduct.length,
        totals: sumRows(returnProduct, ['totalOrders', 'returnOrders', 'totalQty', 'returnQty', 'revenue', 'returnRevenue', 'cost', 'returnCost', 'cod', 'returnCod']),
        byKey: byKey(returnProduct, 'key', ['totalOrders', 'returnOrders', 'totalQty', 'returnQty', 'revenue', 'returnRevenue', 'cost', 'returnCost', 'cod', 'returnCod']),
      },
      returnReportAdGroup: {
        rowCount: returnAdGroup.length,
        totals: sumRows(returnAdGroup, ['totalOrders', 'returnOrders', 'totalQty', 'returnQty', 'revenue', 'returnRevenue', 'cost', 'returnCost', 'cod', 'returnCod']),
        byKey: byKey(returnAdGroup, 'key', ['totalOrders', 'returnOrders', 'totalQty', 'returnQty', 'revenue', 'returnRevenue', 'cost', 'returnCost', 'cod', 'returnCod']),
      },
    },
    seedCounts: {
      groupCount,
      ordersPerGroup,
      orderCount: groupCount * ordersPerGroup,
      returnCount: expectedReturnCount,
      advertisingCostCount: groupCount,
      cashflowCount: 2,
      otherCostCount,
    },
  };

  const resolved = path.resolve(String(outputPath));
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ ok: true, outputPath: resolved, seedCounts: manifest.seedCounts })}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  });
}
