import http from 'k6/http';
import exec from 'k6/execution';
import { check, fail } from 'k6';
import { Trend } from 'k6/metrics';

const LOAD03_ROOT_BASE_URL_MANIFEST_FIELDS = [
  'perfBackendBaseUrl',
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

const LOAD03_HEALTH_URL_MANIFEST_FIELDS = [
  'perfBackendHealthUrl',
  'load03HealthUrl',
  'load03.healthUrl',
  'perf.load03.healthUrl',
  'writeContentionHealthUrl',
  'writeContention.healthUrl',
  'perf.writeContention.healthUrl',
  'backendHealthUrl',
];

function normalizeRootBaseUrl(input) {
  const trimmed = String(input || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    fail('BACKEND_BASE_URL is required');
  }

  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

function parseFixture(pathValue) {
  if (!pathValue) {
    fail('WRITE_CONTENTION_FIXTURE is required');
  }

  return JSON.parse(open(pathValue));
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

function parseRuntimeManifest(pathValue) {
  if (!pathValue) {
    return null;
  }

  try {
    return JSON.parse(String(open(pathValue) || '').replace(/^\uFEFF/, ''));
  } catch (error) {
    fail(`BACKEND_RUNTIME_MANIFEST could not be opened or parsed: ${pathValue}: ${String(error)}`);
  }
}

function pickRuntimeManifestField(manifest, fieldPaths) {
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

function resolveRootBaseUrl(explicitBaseUrl, runtimeManifest) {
  const trimmedExplicitBaseUrl = String(explicitBaseUrl || '').trim();
  if (trimmedExplicitBaseUrl) {
    return normalizeRootBaseUrl(trimmedExplicitBaseUrl);
  }

  const manifestBaseUrl = pickRuntimeManifestField(runtimeManifest, LOAD03_ROOT_BASE_URL_MANIFEST_FIELDS);
  if (manifestBaseUrl) {
    return normalizeRootBaseUrl(manifestBaseUrl);
  }

  fail(
    `BACKEND_BASE_URL is required, or BACKEND_RUNTIME_MANIFEST must provide one of: ${LOAD03_ROOT_BASE_URL_MANIFEST_FIELDS.join(', ')}`,
  );
}

function resolveHealthUrl(explicitHealthUrl, runtimeManifest, rootBaseUrl) {
  const trimmedExplicitHealthUrl = String(explicitHealthUrl || '').trim();
  if (trimmedExplicitHealthUrl) {
    return trimmedExplicitHealthUrl;
  }

  const manifestHealthUrl = pickRuntimeManifestField(runtimeManifest, LOAD03_HEALTH_URL_MANIFEST_FIELDS);
  if (manifestHealthUrl) {
    return String(manifestHealthUrl).trim();
  }

  return `${rootBaseUrl}/health`;
}

function firstNonEmptyEnv(names) {
  for (const name of names) {
    const value = String(__ENV[name] || '').trim();
    if (value) {
      return value;
    }
  }

  return '';
}

const BACKEND_BASE_URL_ENV = firstNonEmptyEnv(['BACKEND_BASE_URL', 'PERF_BACKEND_BASE_URL']);
const BACKEND_HEALTH_URL_ENV = firstNonEmptyEnv(['BACKEND_HEALTH_URL', 'PERF_BACKEND_HEALTH_URL']);
const BACKEND_RUNTIME_MANIFEST_PATH = String(__ENV.BACKEND_RUNTIME_MANIFEST || '').trim();
const RUNTIME_MANIFEST =
  !BACKEND_BASE_URL_ENV || !BACKEND_HEALTH_URL_ENV
    ? parseRuntimeManifest(BACKEND_RUNTIME_MANIFEST_PATH)
    : null;
const ROOT_BASE_URL = resolveRootBaseUrl(BACKEND_BASE_URL_ENV, RUNTIME_MANIFEST);
const HEALTH_URL = resolveHealthUrl(BACKEND_HEALTH_URL_ENV, RUNTIME_MANIFEST, ROOT_BASE_URL);
const EMAIL = String(__ENV.BACKEND_EMAIL || 'director@test.com').trim();
const PASSWORD = String(__ENV.BACKEND_PASSWORD || '123456').trim();
const FIXTURE_PATH = String(__ENV.WRITE_CONTENTION_FIXTURE || '').trim();
const FIXTURE = parseFixture(FIXTURE_PATH);
const API_BASE_URL = `${ROOT_BASE_URL}/api`;

const ORDER_GROUP_COUNT = FIXTURE?.paymentOrderGroups?.length || 0;
const WITHDRAWAL_COUNT = FIXTURE?.withdrawalFixtures?.length || 0;
const RETURN_COUNT = FIXTURE?.returnFixtures?.length || 0;
const OTHER_COST_COUNT = FIXTURE?.otherCostFixtures?.length || 0;

if (!EMAIL || !PASSWORD) {
  fail('BACKEND_EMAIL and BACKEND_PASSWORD are required');
}

if (!ORDER_GROUP_COUNT || !WITHDRAWAL_COUNT || !RETURN_COUNT || !OTHER_COST_COUNT) {
  fail('WRITE_CONTENTION_FIXTURE is missing one or more resource pools');
}

export const options = {
  scenarios: {
    supplier_payment_batch_overlap: {
      executor: 'shared-iterations',
      exec: 'supplierPaymentBatchScenario',
      vus: 6,
      iterations: ORDER_GROUP_COUNT,
      maxDuration: '2m',
      gracefulStop: '10s',
    },
    agent_payment_batch_overlap: {
      executor: 'shared-iterations',
      exec: 'agentPaymentBatchScenario',
      vus: 6,
      iterations: ORDER_GROUP_COUNT,
      maxDuration: '2m',
      gracefulStop: '10s',
    },
    owner_withdrawal_approve_race: {
      executor: 'shared-iterations',
      exec: 'ownerWithdrawalApproveRaceScenario',
      vus: 6,
      iterations: WITHDRAWAL_COUNT,
      maxDuration: '2m',
      gracefulStop: '10s',
    },
    return_resolve_race: {
      executor: 'shared-iterations',
      exec: 'returnResolveRaceScenario',
      vus: 6,
      iterations: RETURN_COUNT,
      maxDuration: '2m',
      gracefulStop: '10s',
    },
    other_cost_confirm_write: {
      executor: 'shared-iterations',
      exec: 'otherCostConfirmScenario',
      vus: 6,
      iterations: OTHER_COST_COUNT,
      maxDuration: '2m',
      gracefulStop: '10s',
    },
  },
  thresholds: {
    checks: ['rate==1.0'],
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<2500', 'p(99)<5000'],
    'http_req_duration{endpoint:health}': ['p(95)<250'],
    'http_req_duration{endpoint:auth_login}': ['p(95)<900'],
    'http_req_duration{endpoint:supplier_payment_batch}': ['p(95)<2200'],
    'http_req_duration{endpoint:agent_payment_batch}': ['p(95)<2200'],
    'http_req_duration{endpoint:other_cost_confirm}': ['p(95)<1200'],
    owner_withdrawal_approve_commit_duration: ['p(95)<1800'],
    return_resolve_commit_duration: ['p(95)<2500'],
  },
};

const normalStatuses = http.expectedStatuses({ min: 200, max: 299 });
const raceStatuses = http.expectedStatuses({ min: 200, max: 299 }, { min: 400, max: 499 });
const ownerWithdrawalApproveCommitDuration = new Trend('owner_withdrawal_approve_commit_duration', true);
const ownerWithdrawalApproveRejectDuration = new Trend('owner_withdrawal_approve_reject_duration', true);
const returnResolveCommitDuration = new Trend('return_resolve_commit_duration', true);
const returnResolveRejectDuration = new Trend('return_resolve_reject_duration', true);

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

function assertStatus(res, expected, label) {
  const ok = check(res, {
    [`${label} status is ${expected}`]: (response) => response.status === expected,
  });

  if (!ok) {
    fail(`${label} expected HTTP ${expected}, got ${res.status}: ${res.body}`);
  }
}

function assertJsonField(res, label, predicate, failureMessage) {
  const ok = check(res, {
    [label]: predicate,
  });

  if (!ok) {
    fail(`${label} failed: ${failureMessage}. Response body: ${res.body}`);
  }
}

function performLogin() {
  const res = http.post(
    `${API_BASE_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    {
      headers: jsonHeaders(),
      responseCallback: normalStatuses,
      tags: { endpoint: 'auth_login' },
    },
  );

  assertStatus(res, 201, 'auth_login');
  const payload = res.json();
  const token =
    payload?.access_token ||
    payload?.accessToken ||
    payload?.token ||
    payload?.data?.access_token ||
    payload?.data?.accessToken;

  if (!token) {
    fail(`auth_login returned no token: ${res.body}`);
  }

  return token;
}

function getScenarioIndex(maxCount) {
  const index = exec.scenario.iterationInTest;
  if (index >= maxCount) {
    fail(`Scenario ${exec.scenario.name} requested index ${index}, but fixture has only ${maxCount} resources`);
  }
  return index;
}

function assertSingleWinnerRace(responses, label) {
  const successCount = responses.filter((response) => response.status >= 200 && response.status < 300).length;
  const failureCount = responses.filter((response) => response.status >= 400 && response.status < 500).length;

  const ok = check({ successCount, failureCount }, {
    [`${label} has exactly one winner`]: (result) => result.successCount === 1 && result.failureCount === 1,
  });

  if (!ok) {
    fail(`${label} expected exactly one 2xx and one 4xx, got statuses: ${responses.map((response) => response.status).join(', ')}`);
  }
}

function recordRaceDurations(responses, successTrend, rejectTrend) {
  for (const response of responses) {
    if (response.status >= 200 && response.status < 300) {
      successTrend.add(response.timings.duration);
      continue;
    }

    if (response.status >= 400 && response.status < 500) {
      rejectTrend.add(response.timings.duration);
    }
  }
}

function getOrder(orderId, token) {
  const res = http.get(`${API_BASE_URL}/test-order2/${orderId}`, {
    headers: jsonHeaders(token),
    responseCallback: normalStatuses,
    tags: { endpoint: 'test_order2_get' },
  });

  assertStatus(res, 200, `test_order2_get_${orderId}`);
  return res.json();
}

function getWithdrawal(withdrawalId, token) {
  const res = http.get(`${API_BASE_URL}/owner-fund/withdrawals/${withdrawalId}`, {
    headers: jsonHeaders(token),
    responseCallback: normalStatuses,
    tags: { endpoint: 'owner_withdrawal_get' },
  });

  assertStatus(res, 200, `owner_withdrawal_get_${withdrawalId}`);
  return res.json();
}

function getReturnRequest(requestId, token) {
  const res = http.get(`${API_BASE_URL}/returns/${requestId}`, {
    headers: jsonHeaders(token),
    responseCallback: normalStatuses,
    tags: { endpoint: 'return_request_get' },
  });

  assertStatus(res, 200, `return_request_get_${requestId}`);
  return res.json();
}

function getOtherCost(costId, token) {
  const res = http.get(`${API_BASE_URL}/other-cost/${costId}`, {
    headers: jsonHeaders(token),
    responseCallback: normalStatuses,
    tags: { endpoint: 'other_cost_get' },
  });

  assertStatus(res, 200, `other_cost_get_${costId}`);
  return res.json();
}

export function setup() {
  const health = http.get(HEALTH_URL, {
    responseCallback: normalStatuses,
    tags: { endpoint: 'health' },
  });
  assertStatus(health, 200, 'health_preflight');

  return {
    token: performLogin(),
    fixture: FIXTURE,
  };
}

export function supplierPaymentBatchScenario(data) {
  const index = getScenarioIndex(data.fixture.paymentOrderGroups.length);
  const group = data.fixture.paymentOrderGroups[index];

  const res = http.post(
    `${API_BASE_URL}/test-order2/supplier-payment-batch`,
    JSON.stringify({
      orderIds: group.orderIds,
      batchId: group.supplierBatchId,
      paidDate: new Date().toISOString(),
      note: `LOAD-03 supplier batch ${index + 1}`,
      confirmOverThreshold: false,
    }),
    {
      headers: jsonHeaders(data.token),
      responseCallback: normalStatuses,
      tags: { endpoint: 'supplier_payment_batch' },
    },
  );

  const statusOk = check(res, {
    'supplier_payment_batch returns 2xx': (response) => response.status >= 200 && response.status < 300,
  });
  if (!statusOk) {
    fail(`supplier_payment_batch failed for index ${index}: HTTP ${res.status} ${res.body}`);
  }

  assertJsonField(
    res,
    'supplier_payment_batch returns processed orderCount',
    (response) => Number(response.json()?.orderCount || 0) > 0,
    'supplier batch response missing positive orderCount',
  );
}

export function agentPaymentBatchScenario(data) {
  const index = getScenarioIndex(data.fixture.paymentOrderGroups.length);
  const group = data.fixture.paymentOrderGroups[index];

  const res = http.post(
    `${API_BASE_URL}/test-order2/agent-payment-batch`,
    JSON.stringify({
      orderIds: group.orderIds,
      batchId: group.agentBatchId,
      paidDate: new Date().toISOString(),
      note: `LOAD-03 agent batch ${index + 1}`,
    }),
    {
      headers: jsonHeaders(data.token),
      responseCallback: normalStatuses,
      tags: { endpoint: 'agent_payment_batch' },
    },
  );

  const statusOk = check(res, {
    'agent_payment_batch returns 2xx': (response) => response.status >= 200 && response.status < 300,
  });
  if (!statusOk) {
    fail(`agent_payment_batch failed for index ${index}: HTTP ${res.status} ${res.body}`);
  }

  assertJsonField(
    res,
    'agent_payment_batch returns processed orderCount',
    (response) => Number(response.json()?.orderCount || 0) > 0,
    'agent batch response missing positive orderCount',
  );
}

export function ownerWithdrawalApproveRaceScenario(data) {
  const index = getScenarioIndex(data.fixture.withdrawalFixtures.length);
  const fixture = data.fixture.withdrawalFixtures[index];
  const url = `${API_BASE_URL}/owner-fund/withdrawals/${fixture.withdrawalId}/approve`;

  const responses = http.batch([
    {
      method: 'POST',
      url,
      body: JSON.stringify({
        approvedBy: data.fixture.directorUserId,
        approvalNotes: `LOAD-03 approve A ${index + 1}`,
        transactionReference: fixture.approvalAttempts[0],
      }),
      params: {
        headers: jsonHeaders(data.token),
        responseCallback: raceStatuses,
        tags: { endpoint: 'owner_withdrawal_approve' },
      },
    },
    {
      method: 'POST',
      url,
      body: JSON.stringify({
        approvedBy: data.fixture.directorUserId,
        approvalNotes: `LOAD-03 approve B ${index + 1}`,
        transactionReference: fixture.approvalAttempts[1],
      }),
      params: {
        headers: jsonHeaders(data.token),
        responseCallback: raceStatuses,
        tags: { endpoint: 'owner_withdrawal_approve' },
      },
    },
  ]);

  recordRaceDurations(
    responses,
    ownerWithdrawalApproveCommitDuration,
    ownerWithdrawalApproveRejectDuration,
  );
  assertSingleWinnerRace(responses, `owner_withdrawal_approve_race_${index}`);
}

export function returnResolveRaceScenario(data) {
  const index = getScenarioIndex(data.fixture.returnFixtures.length);
  const fixture = data.fixture.returnFixtures[index];
  const url = `${API_BASE_URL}/returns/${fixture.requestId}/resolve`;
  const payload = JSON.stringify(fixture.resolvePayload);

  const responses = http.batch([
    {
      method: 'PATCH',
      url,
      body: payload,
      params: {
        headers: jsonHeaders(data.token),
        responseCallback: raceStatuses,
        tags: { endpoint: 'return_resolve' },
      },
    },
    {
      method: 'PATCH',
      url,
      body: payload,
      params: {
        headers: jsonHeaders(data.token),
        responseCallback: raceStatuses,
        tags: { endpoint: 'return_resolve' },
      },
    },
  ]);

  recordRaceDurations(
    responses,
    returnResolveCommitDuration,
    returnResolveRejectDuration,
  );
  assertSingleWinnerRace(responses, `return_resolve_race_${index}`);
}

export function otherCostConfirmScenario(data) {
  const index = getScenarioIndex(data.fixture.otherCostFixtures.length);
  const fixture = data.fixture.otherCostFixtures[index];

  const res = http.patch(
    `${API_BASE_URL}/other-cost/${fixture.costId}/confirm`,
    null,
    {
      headers: jsonHeaders(data.token),
      responseCallback: normalStatuses,
      tags: { endpoint: 'other_cost_confirm' },
    },
  );

  const statusOk = check(res, {
    'other_cost_confirm returns 2xx': (response) => response.status >= 200 && response.status < 300,
  });
  if (!statusOk) {
    fail(`other_cost_confirm failed for index ${index}: HTTP ${res.status} ${res.body}`);
  }

  assertJsonField(
    res,
    'other_cost_confirm returns confirmed state',
    (response) => response.json()?.isConfirmed === true,
    'other-cost confirm response missing isConfirmed=true',
  );
}

export function teardown(data) {
  const errors = [];

  for (const group of data.fixture.paymentOrderGroups) {
    for (const orderId of group.orderIds) {
      const order = getOrder(orderId, data.token);
      if (String(order?.supplierPaymentStatus) !== 'paid') {
        errors.push(`Order ${orderId} supplierPaymentStatus=${order?.supplierPaymentStatus}`);
      }
      if (String(order?.agentPaymentStatus) !== 'paid') {
        errors.push(`Order ${orderId} agentPaymentStatus=${order?.agentPaymentStatus}`);
      }
      if (String(order?.supplierPaymentBatchId || '') !== group.supplierBatchId) {
        errors.push(`Order ${orderId} supplierPaymentBatchId=${order?.supplierPaymentBatchId} expected ${group.supplierBatchId}`);
      }
      if (String(order?.agentPaymentBatchId || '') !== group.agentBatchId) {
        errors.push(`Order ${orderId} agentPaymentBatchId=${order?.agentPaymentBatchId} expected ${group.agentBatchId}`);
      }
    }
  }

  for (const fixture of data.fixture.withdrawalFixtures) {
    const withdrawal = getWithdrawal(fixture.withdrawalId, data.token);
    if (String(withdrawal?.status) !== 'approved') {
      errors.push(`Withdrawal ${fixture.withdrawalId} status=${withdrawal?.status}`);
    }
    const finalReference = String(withdrawal?.transactionReference || '');
    if (!fixture.approvalAttempts.includes(finalReference)) {
      errors.push(`Withdrawal ${fixture.withdrawalId} transactionReference=${finalReference}`);
    }
  }

  const owner = http.get(`${API_BASE_URL}/owner-fund/owners/${data.fixture.dependencies.ownerId}`, {
    headers: jsonHeaders(data.token),
    responseCallback: normalStatuses,
    tags: { endpoint: 'owner_get' },
  });
  assertStatus(owner, 200, 'owner_get');
  const ownerPayload = owner.json();
  const expectedBalance =
    Number(data.fixture.expected.ownerInitialBalance) - Number(data.fixture.expected.totalWithdrawalAmount);
  if (Number(ownerPayload?.availableBalance) !== expectedBalance) {
    errors.push(`Owner availableBalance=${ownerPayload?.availableBalance} expected ${expectedBalance}`);
  }

  for (const fixture of data.fixture.returnFixtures) {
    const request = getReturnRequest(fixture.requestId, data.token);
    if (String(request?.status) !== 'resolved') {
      errors.push(`Return request ${fixture.requestId} status=${request?.status}`);
    }
  }

  for (const fixture of data.fixture.otherCostFixtures) {
    const cost = getOtherCost(fixture.costId, data.token);
    if (cost?.isConfirmed !== true) {
      errors.push(`Other cost ${fixture.costId} isConfirmed=${cost?.isConfirmed}`);
    }
  }

  const costCashflow = http.get(`${API_BASE_URL}/other-cost/summary/cashflow?windowDays=30`, {
    headers: jsonHeaders(data.token),
    responseCallback: normalStatuses,
    tags: { endpoint: 'other_cost_cashflow_summary' },
  });
  assertStatus(costCashflow, 200, 'other_cost_cashflow_summary');
  const costSummary = costCashflow.json();
  if (Number(costSummary?.totalOpsPaid) !== Number(data.fixture.expected.totalConfirmedOtherCostAmount)) {
    errors.push(`Other-cost totalOpsPaid=${costSummary?.totalOpsPaid} expected ${data.fixture.expected.totalConfirmedOtherCostAmount}`);
  }
  if (Number(costSummary?.totalOpsUnpaid) !== 0) {
    errors.push(`Other-cost totalOpsUnpaid=${costSummary?.totalOpsUnpaid}`);
  }

  const dashboard = http.get(`${API_BASE_URL}/financial-control/dashboard?forceRefresh=true`, {
    headers: jsonHeaders(data.token),
    responseCallback: normalStatuses,
    tags: { endpoint: 'financial_control_dashboard' },
  });
  assertStatus(dashboard, 200, 'financial_control_dashboard_postload');
  if (typeof dashboard.json() !== 'object' || dashboard.json() === null) {
    errors.push('financial-control dashboard returned empty payload after LOAD-03');
  }

  const ok = check({ count: errors.length }, {
    'teardown verification has zero errors': (result) => result.count === 0,
  });
  if (!ok) {
    fail(`teardown verification failed: ${errors.join(' | ')}`);
  }
}

export function handleSummary(data) {
  const output = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      fixturePath: FIXTURE_PATH,
      rootBaseUrl: ROOT_BASE_URL,
      scenarios: {
        paymentOrderGroups: ORDER_GROUP_COUNT,
        withdrawals: WITHDRAWAL_COUNT,
        returns: RETURN_COUNT,
        otherCosts: OTHER_COST_COUNT,
      },
      metrics: data.metrics,
    },
    null,
    2,
  );

  const summaryPath = String(__ENV.WRITE_CONTENTION_SUMMARY_PATH || '').trim();
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
