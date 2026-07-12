import http from 'k6/http';
import { check, fail } from 'k6';

function normalizeRootBaseUrl(input) {
  const trimmed = String(input || '').trim().replace(/\/+$/, '');
  if (!trimmed) fail('BACKEND_BASE_URL is required');
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

function addDaysIso(dayIso, days) {
  const base = new Date(`${dayIso}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

const BASE_URL = normalizeRootBaseUrl(__ENV.BACKEND_BASE_URL || '');
const HEALTH_URL = String(__ENV.BACKEND_HEALTH_URL || `${BASE_URL}/health`).trim();
const DB_HEALTH_URL = String(__ENV.ANALYTICS_SOAK_DB_HEALTH_URL || `${BASE_URL}/api/health/db`).trim();
const EMAIL = String(__ENV.BACKEND_EMAIL || '').trim();
const PASSWORD = String(__ENV.BACKEND_PASSWORD || '').trim();
const ANALYTICS_READ_FIXTURE = String(__ENV.ANALYTICS_READ_FIXTURE || '').trim();
const MANIFEST_TEXT = ANALYTICS_READ_FIXTURE ? open(ANALYTICS_READ_FIXTURE) : '';
const MANIFEST = MANIFEST_TEXT ? JSON.parse(MANIFEST_TEXT) : null;
const SOAK_DURATION = String(__ENV.ANALYTICS_SOAK_DURATION || '2h').trim();

if (!EMAIL || !PASSWORD) fail('BACKEND_EMAIL and BACKEND_PASSWORD are required');
if (!ANALYTICS_READ_FIXTURE) fail('ANALYTICS_READ_FIXTURE is required');
if (!MANIFEST_TEXT || !MANIFEST) fail('ANALYTICS_READ_FIXTURE could not be opened or parsed');

export const options = {
  scenarios: {
    cached_dashboard_reads: {
      executor: 'constant-arrival-rate',
      exec: 'cachedDashboardReadsScenario',
      rate: Number(__ENV.ANALYTICS_SOAK_CACHED_RATE || 12),
      timeUnit: '1s',
      duration: SOAK_DURATION,
      preAllocatedVUs: 8,
      maxVUs: 32,
      gracefulStop: '30s',
    },
    refresh_dashboard_reads: {
      executor: 'constant-arrival-rate',
      exec: 'refreshDashboardReadsScenario',
      rate: Number(__ENV.ANALYTICS_SOAK_REFRESH_RATE || 1),
      timeUnit: '5s',
      duration: SOAK_DURATION,
      preAllocatedVUs: 4,
      maxVUs: 12,
      gracefulStop: '30s',
    },
    heavy_report_reads: {
      executor: 'constant-arrival-rate',
      exec: 'heavyReportReadsScenario',
      rate: Number(__ENV.ANALYTICS_SOAK_HEAVY_RATE || 1),
      timeUnit: '5s',
      duration: SOAK_DURATION,
      preAllocatedVUs: 12,
      maxVUs: 48,
      gracefulStop: '30s',
    },
    other_cost_write_churn: {
      executor: 'constant-arrival-rate',
      exec: 'otherCostWriteChurnScenario',
      rate: Number(__ENV.ANALYTICS_SOAK_WRITE_RATE || 1),
      timeUnit: '10s',
      duration: SOAK_DURATION,
      preAllocatedVUs: 4,
      maxVUs: 16,
      gracefulStop: '30s',
    },
    health_db_poll: {
      executor: 'constant-arrival-rate',
      exec: 'healthDbPollScenario',
      rate: Number(__ENV.ANALYTICS_SOAK_HEALTH_DB_RATE || 1),
      timeUnit: '30s',
      duration: SOAK_DURATION,
      preAllocatedVUs: 1,
      maxVUs: 2,
      gracefulStop: '30s',
    },
  },
  thresholds: {
    checks: ['rate==1.0'],
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<2500', 'p(99)<5000'],
    'http_req_duration{kind:cached}': ['p(95)<600', 'p(99)<1200'],
    'http_req_duration{kind:refresh}': ['p(95)<2200', 'p(99)<4000'],
    'http_req_duration{kind:heavy}': ['p(95)<3000', 'p(99)<5000'],
    'http_req_duration{kind:write}': ['p(95)<2500', 'p(99)<4500'],
    'http_req_duration{endpoint:financial_control_dashboard}': ['p(95)<800'],
    'http_req_duration{endpoint:financial_control_dashboard_refresh}': ['p(95)<2200'],
    'http_req_duration{endpoint:cashflow_dashboard_summary}': ['p(95)<800'],
    'http_req_duration{endpoint:ad_group_profit_report_performance}': ['p(95)<2500'],
    'http_req_duration{endpoint:return_report_product}': ['p(95)<2500'],
    'http_req_duration{endpoint:return_report_ad_group}': ['p(95)<2500'],
    'http_req_duration{endpoint:other_cost_create}': ['p(95)<1500'],
    'http_req_duration{endpoint:other_cost_delete}': ['p(95)<1500'],
    'http_req_duration{endpoint:other_cost_list}': ['p(95)<1000'],
    'http_req_duration{endpoint:health_db}': ['p(95)<500'],
    'http_req_duration{endpoint:health}': ['p(95)<250'],
    'http_req_duration{endpoint:auth_login}': ['p(95)<800'],
  },
};

function jsonHeaders(token) {
  const h = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function assertStatus(res, expected, label) {
  const ok = check(res, { [`${label} status is ${expected}`]: (r) => r.status === expected });
  if (!ok) fail(`${label} expected HTTP ${expected}, got ${res.status}: ${res.body}`);
}

function assertJsonField(res, label, predicate, message) {
  const ok = check(res, { [label]: predicate });
  if (!ok) fail(`${label} failed: ${message}. Response body: ${res.body}`);
}

function performLogin() {
  const login = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: jsonHeaders(), tags: { endpoint: 'auth_login', kind: 'cached' } },
  );
  assertStatus(login, 201, 'auth_login');
  const body = login.json();
  const token = body?.access_token || body?.accessToken || body?.token || body?.data?.access_token || body?.data?.accessToken;
  if (!token) fail(`auth_login returned no token: ${login.body}`);
  return token;
}

function healthPreflight() {
  const health = http.get(HEALTH_URL, { tags: { endpoint: 'health', kind: 'cached' } });
  assertStatus(health, 200, 'health_preflight');
}

function compareNumber(actual, expected, label) {
  const ok = check({ actual: Number(actual || 0), expected: Number(expected || 0) }, {
    [label]: (v) => v.actual === v.expected,
  });
  if (!ok) fail(`${label} mismatch: expected ${expected}, got ${actual}`);
}

function compareMaybeNull(actual, expected, label) {
  if (actual === null || expected === null) {
    const ok = check({ actual, expected }, { [label]: (v) => v.actual === v.expected });
    if (!ok) fail(`${label} mismatch: expected ${expected}, got ${actual}`);
    return;
  }
  compareNumber(actual, expected, label);
}

function compareFields(actual, expected, label, fields) {
  for (const field of fields) {
    compareMaybeNull(actual?.[field], expected?.[field], `${label}.${field}`);
  }
}

function fetchJson(path, token, tags) {
  const response = http.get(`${BASE_URL}${path}`, { headers: jsonHeaders(token), tags });
  assertStatus(response, 200, tags.endpoint);
  return response.json();
}

function sumRows(rows, fields) {
  const out = { rowCount: rows.length };
  for (const field of fields) out[field] = 0;
  for (const row of rows || []) {
    for (const field of fields) out[field] += Number(row?.[field] || 0);
  }
  return out;
}

function createOtherCostPayload(index) {
  const window = MANIFEST.window || {};
  const today = String(window.toDate || '').trim();
  const dueDate = addDaysIso(today, 7);
  const stamp = `${__VU}-${__ITER}-${Date.now()}-${index}`;
  return {
    date: today,
    dueDate,
    amount: 120000 + (__VU * 2000) + ((__ITER % 7) * 500) + (index * 100),
    category: 'other',
    notes: `LOAD-05 soak other-cost ${stamp}`,
    isConfirmed: false,
  };
}

export function setup() {
  healthPreflight();
  return { token: performLogin(), manifest: MANIFEST };
}

export function cachedDashboardReadsScenario(data) {
  const batch = http.batch([
    [
      'GET',
      `${BASE_URL}/api/financial-control/dashboard`,
      null,
      { headers: jsonHeaders(data.token), tags: { endpoint: 'financial_control_dashboard', kind: 'cached' } },
    ],
    [
      'GET',
      `${BASE_URL}/api/cashflow/dashboard/summary`,
      null,
      { headers: jsonHeaders(data.token), tags: { endpoint: 'cashflow_dashboard_summary', kind: 'cached' } },
    ],
  ]);

  assertStatus(batch[0], 200, 'financial_control_dashboard');
  assertStatus(batch[1], 200, 'cashflow_dashboard_summary');
  assertJsonField(batch[0], 'financial_control_dashboard returns object payload', (r) => typeof r.json() === 'object' && r.json() !== null, 'dashboard payload is empty or invalid');
  assertJsonField(batch[1], 'cashflow_dashboard_summary returns object payload', (r) => typeof r.json() === 'object' && r.json() !== null, 'cashflow summary payload is empty or invalid');
}

export function refreshDashboardReadsScenario(data) {
  const response = http.get(`${BASE_URL}/api/financial-control/dashboard?forceRefresh=true`, {
    headers: jsonHeaders(data.token),
    tags: { endpoint: 'financial_control_dashboard_refresh', kind: 'refresh' },
  });

  assertStatus(response, 200, 'financial_control_dashboard_refresh');
  assertJsonField(
    response,
    'financial_control_dashboard_refresh returns object payload',
    (r) => typeof r.json() === 'object' && r.json() !== null,
    'refresh dashboard payload is empty or invalid',
  );
}

export function heavyReportReadsScenario(data) {
  const w = data.manifest.window;
  const batch = http.batch([
    [
      'GET',
      `${BASE_URL}/api/ad-group-profit-report/performance?startDate=${encodeURIComponent(w.fromDate)}&endDate=${encodeURIComponent(w.toDate)}&minOrders=1`,
      null,
      { headers: jsonHeaders(data.token), tags: { endpoint: 'ad_group_profit_report_performance', kind: 'heavy' } },
    ],
    [
      'GET',
      `${BASE_URL}/api/return-report/product?fromDate=${encodeURIComponent(w.fromDate)}&toDate=${encodeURIComponent(w.toDate)}`,
      null,
      { headers: jsonHeaders(data.token), tags: { endpoint: 'return_report_product', kind: 'heavy' } },
    ],
    [
      'GET',
      `${BASE_URL}/api/return-report/ad-group?fromDate=${encodeURIComponent(w.fromDate)}&toDate=${encodeURIComponent(w.toDate)}`,
      null,
      { headers: jsonHeaders(data.token), tags: { endpoint: 'return_report_ad_group', kind: 'heavy' } },
    ],
  ]);

  for (const [index, label] of [
    [0, 'ad_group_profit_report_performance'],
    [1, 'return_report_product'],
    [2, 'return_report_ad_group'],
  ]) {
    assertStatus(batch[index], 200, label);
    assertJsonField(batch[index], `${label} returns collection payload`, (r) => Array.isArray(r.json()), `${label} payload is not an array`);
  }
}

export function otherCostWriteChurnScenario(data) {
  const payload = createOtherCostPayload(0);
  const createRes = http.post(`${BASE_URL}/api/other-cost`, JSON.stringify(payload), {
    headers: jsonHeaders(data.token),
    tags: { endpoint: 'other_cost_create', kind: 'write' },
  });

  assertStatus(createRes, 201, 'other_cost_create');
  const created = createRes.json();
  const costId = created?._id || created?.id || created?.data?._id || created?.data?.id;
  if (!costId) fail(`other_cost_create returned no id: ${createRes.body}`);

  const deleteRes = http.del(`${BASE_URL}/api/other-cost/${costId}`, null, {
    headers: jsonHeaders(data.token),
    tags: { endpoint: 'other_cost_delete', kind: 'write' },
  });

  assertStatus(deleteRes, 200, 'other_cost_delete');
  assertJsonField(
    deleteRes,
    'other_cost_delete returns object payload',
    (r) => typeof r.json() === 'object' && r.json() !== null,
    'delete response payload is empty or invalid',
  );
}

export function healthDbPollScenario() {
  const response = http.get(DB_HEALTH_URL, {
    tags: { endpoint: 'health_db', kind: 'cached' },
  });

  assertStatus(response, 200, 'health_db');
  assertJsonField(
    response,
    'health_db returns connected state',
    (r) => {
      const body = r.json();
      return body && body.status === 'ok' && Number(body.state) === 1;
    },
    'health_db did not report a connected Mongo state',
  );
}

export function teardown(data) {
  const expected = data.manifest.expected;
  const w = data.manifest.window;

  const financial = fetchJson('/api/financial-control/dashboard', data.token, { endpoint: 'financial_control_dashboard', kind: 'cached' });
  compareFields(financial, expected.financialControlDashboard, 'financialControlDashboard', ['bankBalance', 'committedCash', 'freeCash', 'monthlyBurn', 'runwayMonths', 'adsBudgetApproved', 'ownerWithdrawable', 'totalDebtOutstanding']);

  const cashflow = fetchJson('/api/cashflow/dashboard/summary', data.token, { endpoint: 'cashflow_dashboard_summary', kind: 'cached' });
  compareFields(cashflow, expected.cashflowSummary, 'cashflowSummary', ['bankBalance', 'committedCash', 'freeCash', 'adsFundBalance', 'cashflowSafetyIndex']);

  const perf = fetchJson(`/api/ad-group-profit-report/performance?startDate=${encodeURIComponent(w.fromDate)}&endDate=${encodeURIComponent(w.toDate)}&minOrders=1`, data.token, { endpoint: 'ad_group_profit_report_performance', kind: 'heavy' });
  compareNumber(perf.length, expected.adGroupPerformance.rowCount, 'adGroupPerformance.rowCount');
  compareFields(sumRows(perf, ['totalOrders', 'successOrders', 'returnOrders', 'totalRevenue', 'totalNetProfit', 'totalAdsSpent']), expected.adGroupPerformance.totals, 'adGroupPerformance.totals', ['totalOrders', 'successOrders', 'returnOrders', 'totalRevenue', 'totalNetProfit', 'totalAdsSpent']);
  for (const [key, rowExpected] of Object.entries(expected.adGroupPerformance.byAdGroupId)) {
    const actual = perf.find((row) => String(row.adGroupId || row.key || '') === key);
    if (!actual) fail(`adGroupPerformance missing row for ${key}`);
    compareFields(actual, rowExpected, `adGroupPerformance[${key}]`, ['totalOrders', 'successOrders', 'returnOrders', 'totalRevenue', 'totalNetProfit', 'totalAdsSpent', 'realizedProfit', 'pendingProfit', 'riskyProfit']);
  }

  const product = fetchJson(`/api/return-report/product?fromDate=${encodeURIComponent(w.fromDate)}&toDate=${encodeURIComponent(w.toDate)}`, data.token, { endpoint: 'return_report_product', kind: 'heavy' });
  compareNumber(product.length, expected.returnReportProduct.rowCount, 'returnReportProduct.rowCount');
  compareFields(sumRows(product, ['totalOrders', 'returnOrders', 'totalQty', 'returnQty', 'revenue', 'returnRevenue', 'cost', 'returnCost', 'cod', 'returnCod']), expected.returnReportProduct.totals, 'returnReportProduct.totals', ['totalOrders', 'returnOrders', 'totalQty', 'returnQty', 'revenue', 'returnRevenue', 'cost', 'returnCost', 'cod', 'returnCod']);
  for (const [key, rowExpected] of Object.entries(expected.returnReportProduct.byKey)) {
    const actual = product.find((row) => String(row.key || '') === key);
    if (!actual) fail(`returnReportProduct missing row for ${key}`);
    compareFields(actual, rowExpected, `returnReportProduct[${key}]`, ['totalOrders', 'returnOrders', 'totalQty', 'returnQty', 'revenue', 'returnRevenue', 'cost', 'returnCost', 'cod', 'returnCod']);
  }

  const adGroup = fetchJson(`/api/return-report/ad-group?fromDate=${encodeURIComponent(w.fromDate)}&toDate=${encodeURIComponent(w.toDate)}`, data.token, { endpoint: 'return_report_ad_group', kind: 'heavy' });
  compareNumber(adGroup.length, expected.returnReportAdGroup.rowCount, 'returnReportAdGroup.rowCount');
  compareFields(sumRows(adGroup, ['totalOrders', 'returnOrders', 'totalQty', 'returnQty', 'revenue', 'returnRevenue', 'cost', 'returnCost', 'cod', 'returnCod']), expected.returnReportAdGroup.totals, 'returnReportAdGroup.totals', ['totalOrders', 'returnOrders', 'totalQty', 'returnQty', 'revenue', 'returnRevenue', 'cost', 'returnCost', 'cod', 'returnCod']);
  for (const [key, rowExpected] of Object.entries(expected.returnReportAdGroup.byKey)) {
    const actual = adGroup.find((row) => String(row.key || '') === key);
    if (!actual) fail(`returnReportAdGroup missing row for ${key}`);
    compareFields(actual, rowExpected, `returnReportAdGroup[${key}]`, ['totalOrders', 'returnOrders', 'totalQty', 'returnQty', 'revenue', 'returnRevenue', 'cost', 'returnCost', 'cod', 'returnCod']);
  }

  const otherCosts = fetchJson(`/api/other-cost?from=${encodeURIComponent(w.fromDate)}&to=${encodeURIComponent(w.toDate)}`, data.token, { endpoint: 'other_cost_list', kind: 'teardown' });
  compareNumber(otherCosts.length, data.manifest.seedCounts.otherCostCount, 'otherCostList.rowCount');

  const dbHealthResponse = http.get(DB_HEALTH_URL, {
    headers: jsonHeaders(data.token),
    tags: { endpoint: 'health_db', kind: 'cached' },
  });
  assertStatus(dbHealthResponse, 200, 'health_db');
  const dbHealth = dbHealthResponse.json();
  compareNumber(dbHealth.state, 1, 'healthDb.state');
}

export function handleSummary(data) {
  const output = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      fixturePath: ANALYTICS_READ_FIXTURE,
      rootBaseUrl: BASE_URL,
      dbHealthUrl: DB_HEALTH_URL,
      soakDuration: SOAK_DURATION,
      window: MANIFEST.window,
      seedCounts: MANIFEST.seedCounts,
      metrics: data.metrics,
    },
    null,
    2,
  );

  const summaryPath = String(__ENV.ANALYTICS_SOAK_SUMMARY_PATH || __ENV.ANALYTICS_READ_SUMMARY_PATH || '').trim();
  if (!summaryPath) {
    return {
      stdout: `${output}\n`,
    };
  }

  return {
    [summaryPath]: `${output}\n`,
    stdout: `${output}\n`,
  };
}
