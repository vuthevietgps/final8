import http from 'k6/http';
import { check, fail } from 'k6';

const BASE_URL = String(__ENV.BACKEND_BASE_URL || '').trim().replace(/\/+$/, '');
const EMAIL = __ENV.BACKEND_EMAIL;
const PASSWORD = __ENV.BACKEND_PASSWORD;

if (!BASE_URL) {
  fail('BACKEND_BASE_URL is required');
}

if (!EMAIL || !PASSWORD) {
  fail('BACKEND_EMAIL and BACKEND_PASSWORD are required');
}

export const options = {
  scenarios: {
    health_smoke: {
      executor: 'constant-arrival-rate',
      exec: 'healthScenario',
      rate: 4,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 8,
      maxVUs: 20,
      gracefulStop: '5s',
    },
    auth_login_smoke: {
      executor: 'constant-arrival-rate',
      exec: 'authLoginScenario',
      rate: 4,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 8,
      maxVUs: 20,
      gracefulStop: '5s',
    },
    auth_profile_smoke: {
      executor: 'constant-arrival-rate',
      exec: 'authProfileScenario',
      rate: 3,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 8,
      maxVUs: 20,
      gracefulStop: '5s',
    },
    financial_control_dashboard_smoke: {
      executor: 'constant-arrival-rate',
      exec: 'financialControlDashboardScenario',
      rate: 3,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 8,
      maxVUs: 20,
      gracefulStop: '5s',
    },
    funds_overview_smoke: {
      executor: 'constant-arrival-rate',
      exec: 'fundsOverviewScenario',
      rate: 3,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 8,
      maxVUs: 20,
      gracefulStop: '5s',
    },
    test_order2_list_smoke: {
      executor: 'constant-arrival-rate',
      exec: 'testOrder2ListScenario',
      rate: 3,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 8,
      maxVUs: 20,
      gracefulStop: '5s',
    },
  },
  thresholds: {
    checks: ['rate==1.0'],
    http_req_failed: ['rate==0'],
    http_req_duration: [
      'p(95)<800',
      'p(99)<1500',
    ],
    'http_req_duration{endpoint:health}': ['p(95)<250'],
    'http_req_duration{endpoint:auth_login}': ['p(95)<800'],
    'http_req_duration{endpoint:auth_profile}': ['p(95)<500'],
    'http_req_duration{endpoint:financial_control_dashboard}': ['p(95)<1200'],
    'http_req_duration{endpoint:funds_overview}': ['p(95)<1200'],
    'http_req_duration{endpoint:test_order2_list}': ['p(95)<1200'],
  },
};

function jsonHeaders(token) {
  const headers = {
    'Content-Type': 'application/json',
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

export function setup() {
  const health = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health' } });
  assertStatus(health, 200, 'health_preflight');
  return {
    token: performLogin(),
  };
}

export function healthScenario() {
  const health = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health' } });
  assertStatus(health, 200, 'health');
}

export function authLoginScenario() {
  performLogin();
}

export function authProfileScenario(data) {
  const profile = http.get(`${BASE_URL}/api/auth/profile`, {
    headers: jsonHeaders(data.token),
    tags: { endpoint: 'auth_profile' },
  });
  assertStatus(profile, 200, 'auth_profile');
  assertJsonField(
    profile,
    'auth_profile exposes identity',
    (r) => {
      const body = r.json();
      return Boolean(body?.email || body?.id || body?.sub || body?.user?.email || body?.user?.id);
    },
    'profile payload missing identity fields',
  );
}

export function financialControlDashboardScenario(data) {
  const dashboard = http.get(`${BASE_URL}/api/financial-control/dashboard`, {
    headers: jsonHeaders(data.token),
    tags: { endpoint: 'financial_control_dashboard' },
  });
  assertStatus(dashboard, 200, 'financial_control_dashboard');
  assertJsonField(
    dashboard,
    'financial_control_dashboard returns object payload',
    (r) => typeof r.json() === 'object' && r.json() !== null,
    'dashboard payload is empty or non-object',
  );
}

export function fundsOverviewScenario(data) {
  const funds = http.get(`${BASE_URL}/api/funds/overview`, {
    headers: jsonHeaders(data.token),
    tags: { endpoint: 'funds_overview' },
  });
  assertStatus(funds, 200, 'funds_overview');
  assertJsonField(
    funds,
    'funds_overview returns object payload',
    (r) => typeof r.json() === 'object' && r.json() !== null,
    'funds overview payload is empty or non-object',
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
        Array.isArray(body.data)
      );
    },
    'orders list missing pagination/data contract',
  );
}
