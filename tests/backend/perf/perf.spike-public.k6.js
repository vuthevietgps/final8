import http from 'k6/http';
import { check, fail } from 'k6';

const BASE_URL = String(__ENV.BACKEND_BASE_URL || '').trim().replace(/\/+$/, '');
const HEALTH_URL = String(__ENV.BACKEND_HEALTH_URL || `${BASE_URL}/health`).trim();
const EMAIL = String(__ENV.BACKEND_EMAIL || '').trim();
const PASSWORD = String(__ENV.BACKEND_PASSWORD || '').trim();
const ORDER_UPDATE_PREVIEW_FILE = String(__ENV.ORDER_UPDATE_PREVIEW_FILE || '').trim();
const ORDER_UPDATE_PREVIEW_EXPECTED_ROWS = Number(
  __ENV.ORDER_UPDATE_PREVIEW_EXPECTED_ROWS || __ENV.ORDER_UPDATE_PREVIEW_ROWS || '0',
);
const ORDER_UPDATE_PREVIEW_FILE_NAME =
  ORDER_UPDATE_PREVIEW_FILE.split(/[\\/]/).pop() || 'order-update-preview.xlsx';
const ORDER_UPDATE_PREVIEW_BYTES = ORDER_UPDATE_PREVIEW_FILE
  ? open(ORDER_UPDATE_PREVIEW_FILE, 'b')
  : null;
const WEBHOOK_PAGE_ID = String(__ENV.WEBHOOK_PAGE_ID || 'page-spike-1').trim();
const WEBHOOK_SENDER_PREFIX = String(__ENV.WEBHOOK_SENDER_PREFIX || 'user-spike').trim();

const WEBHOOK_VERIFY_TOKEN = String(
  __ENV.WEBHOOK_VERIFY_TOKEN || __ENV.MESSENGER_VERIFY_TOKEN || __ENV.FB_VERIFY_TOKEN || '',
).trim();
const WEBHOOK_VERIFY_PREFLIGHT = String(__ENV.WEBHOOK_VERIFY_PREFLIGHT || '').trim();
const WEBHOOK_VERIFY_CHALLENGE = String(
  __ENV.WEBHOOK_VERIFY_CHALLENGE || 'load-spike-webhook-challenge',
).trim();

if (!BASE_URL) {
  fail('BACKEND_BASE_URL is required');
}

if (!EMAIL || !PASSWORD) {
  fail('BACKEND_EMAIL and BACKEND_PASSWORD are required');
}

if (!ORDER_UPDATE_PREVIEW_FILE) {
  fail('ORDER_UPDATE_PREVIEW_FILE is required');
}

if (!ORDER_UPDATE_PREVIEW_BYTES) {
  fail('ORDER_UPDATE_PREVIEW_FILE could not be opened');
}

if (!Number.isFinite(ORDER_UPDATE_PREVIEW_EXPECTED_ROWS) || ORDER_UPDATE_PREVIEW_EXPECTED_ROWS <= 0) {
  fail('ORDER_UPDATE_PREVIEW_EXPECTED_ROWS must be a positive number');
}

export const options = {
  scenarios: {
    webhook_ack_spike: {
      executor: 'ramping-arrival-rate',
      exec: 'webhookAckScenario',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 50,
      stages: [
        { target: 8, duration: '10s' },
        { target: 24, duration: '15s' },
        { target: 40, duration: '10s' },
        { target: 16, duration: '10s' },
        { target: 0, duration: '15s' },
      ],
      gracefulStop: '10s',
    },
    advertising_cost_public_spike: {
      executor: 'ramping-arrival-rate',
      exec: 'advertisingCostPublicScenario',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 8,
      maxVUs: 30,
      stages: [
        { target: 4, duration: '10s' },
        { target: 16, duration: '15s' },
        { target: 24, duration: '10s' },
        { target: 10, duration: '10s' },
        { target: 0, duration: '15s' },
      ],
      gracefulStop: '10s',
    },
    order_update_preview_spike: {
      executor: 'ramping-arrival-rate',
      exec: 'orderUpdatePreviewScenario',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 6,
      maxVUs: 24,
      stages: [
        { target: 2, duration: '10s' },
        { target: 6, duration: '15s' },
        { target: 10, duration: '10s' },
        { target: 4, duration: '10s' },
        { target: 0, duration: '15s' },
      ],
      gracefulStop: '10s',
    },
    test_order2_list_spike: {
      executor: 'ramping-arrival-rate',
      exec: 'testOrder2ListScenario',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 8,
      maxVUs: 36,
      stages: [
        { target: 4, duration: '10s' },
        { target: 12, duration: '15s' },
        { target: 24, duration: '10s' },
        { target: 10, duration: '10s' },
        { target: 0, duration: '15s' },
      ],
      gracefulStop: '10s',
    },
  },
  thresholds: {
    checks: ['rate==1.0'],
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<1600', 'p(99)<3500'],
    'http_req_duration{endpoint:health}': ['p(95)<250'],
    'http_req_duration{endpoint:webhook_verify}': ['p(95)<400'],
    'http_req_duration{endpoint:webhook_ack}': ['p(95)<800'],
    'http_req_duration{endpoint:advertising_cost_public}': ['p(95)<900'],
    'http_req_duration{endpoint:order_update_preview}': ['p(95)<1800'],
    'http_req_duration{endpoint:test_order2_list}': ['p(95)<1200'],
  },
};

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

function multipartHeaders(token) {
  const headers = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function assertStatus(res, expected, label) {
  const ok = check(res, {
    [`${label} status is ${expected}`]: (r) => r.status === expected,
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
  const login = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: jsonHeaders(), tags: { endpoint: 'auth_login' } },
  );
  assertStatus(login, 201, 'auth_login');

  const loginBody = login.json();
  const token =
    loginBody?.access_token ||
    loginBody?.accessToken ||
    loginBody?.token ||
    loginBody?.data?.access_token ||
    loginBody?.data?.accessToken;
  if (!token) {
    fail(`auth_login returned no token: ${login.body}`);
  }

  return token;
}

function verifyWebhookChallenge() {
  if (!WEBHOOK_VERIFY_PREFLIGHT && !WEBHOOK_VERIFY_TOKEN) {
    return;
  }

  const verifyToken = WEBHOOK_VERIFY_TOKEN || 'dev-verify-token';
  const verifyUrl =
    `${BASE_URL}/api/webhook/messenger` +
    `?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}` +
    `&hub.challenge=${encodeURIComponent(WEBHOOK_VERIFY_CHALLENGE)}`;

  const verify = http.get(verifyUrl, { tags: { endpoint: 'webhook_verify' } });
  assertStatus(verify, 200, 'webhook_verify');

  const bodyText = verify.body ? String(verify.body).trim() : '';
  assertJsonField(
    verify,
    'webhook_verify returns challenge',
    () => bodyText === WEBHOOK_VERIFY_CHALLENGE,
    `expected challenge ${WEBHOOK_VERIFY_CHALLENGE}, got ${bodyText || '<empty>'}`,
  );
}

export function setup() {
  const health = http.get(HEALTH_URL, { tags: { endpoint: 'health' } });
  assertStatus(health, 200, 'health_preflight');

  verifyWebhookChallenge();

  return {
    token: performLogin(),
  };
}

export function webhookAckScenario() {
  const now = Date.now();
  const senderId = `${WEBHOOK_SENDER_PREFIX}-${__VU}-${__ITER}`;
  const payload = {
    object: 'page',
    entry: [
      {
        id: WEBHOOK_PAGE_ID,
        time: now,
        messaging: [
          {
            sender: { id: senderId },
            recipient: { id: WEBHOOK_PAGE_ID },
            timestamp: now,
            message: {
              mid: `mid-${__VU}-${__ITER}-${now}`,
              text: `spike-load-${__VU}-${__ITER}`,
            },
          },
        ],
      },
    ],
  };

  const ack = http.post(`${BASE_URL}/api/webhook/messenger`, JSON.stringify(payload), {
    headers: jsonHeaders(),
    tags: { endpoint: 'webhook_ack' },
  });
  assertStatus(ack, 200, 'webhook_ack');
  assertJsonField(
    ack,
    'webhook_ack returns accepted status',
    (r) => {
      const body = r.json();
      return body?.status === 'accepted';
    },
    'webhook ack payload is not accepted',
  );
}

export function advertisingCostPublicScenario() {
  const spent = http.get(`${BASE_URL}/api/advertising-cost-public/yesterday-spent`, {
    tags: { endpoint: 'advertising_cost_public' },
  });
  assertStatus(spent, 200, 'advertising_cost_public');
  assertJsonField(
    spent,
    'advertising_cost_public returns contract payload',
    (r) => {
      const body = r.json();
      return (
        typeof body === 'object' &&
        body !== null &&
        body.statusCode === 200 &&
        body.data !== undefined &&
        typeof body.data === 'object' &&
        body.data !== null &&
        Object.keys(body.data).length > 0
      );
    },
    'public advertising payload missing statusCode/data contract or seeded data',
  );
}

export function orderUpdatePreviewScenario(data) {
  const preview = http.post(
    `${BASE_URL}/api/order-update/preview`,
    {
      file: http.file(
        ORDER_UPDATE_PREVIEW_BYTES,
        ORDER_UPDATE_PREVIEW_FILE_NAME,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    },
    {
      headers: multipartHeaders(data.token),
      tags: { endpoint: 'order_update_preview' },
    },
  );
  assertStatus(preview, 200, 'order_update_preview');
  assertJsonField(
    preview,
    'order_update_preview exposes preview contract',
    (r) => {
      const body = r.json();
      return (
        typeof body === 'object' &&
        body !== null &&
        Array.isArray(body.sampleData) &&
        body.sampleData.length > 0 &&
        typeof body.mappingInfo === 'object' &&
        body.mappingInfo !== null &&
        typeof body.totalRows === 'number' &&
        body.totalRows === ORDER_UPDATE_PREVIEW_EXPECTED_ROWS
      );
    },
    `preview payload missing sampleData/mappingInfo or totalRows != ${ORDER_UPDATE_PREVIEW_EXPECTED_ROWS}`,
  );
}

export function testOrder2ListScenario(data) {
  const orders = http.get(`${BASE_URL}/api/test-order2?page=1&limit=20`, {
    headers: jsonHeaders(data.token),
    tags: { endpoint: 'test_order2_list' },
  });
  assertStatus(orders, 200, 'test_order2_list');
  assertJsonField(
    orders,
    'test_order2_list exposes pagination contract',
    (r) => {
      const body = r.json();
      return (
        typeof body === 'object' &&
        body !== null &&
        typeof body.pagination === 'object' &&
        body.pagination !== null &&
        body.pagination.page === 1 &&
        body.pagination.limit === 20 &&
        Array.isArray(body.data) &&
        body.data.length > 0
      );
    },
    'orders list missing pagination/data contract or returned no seeded rows',
  );
}
