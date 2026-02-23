/**
 * Test script for Agent, Agent Quote, and Agent Receivable APIs
 */

const BASE_URL = 'http://localhost:3000/api';

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@dropshipping.com', password: '123456' })
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  return data.access_token;
}

async function test() {
  console.log('========================================');
  console.log('AGENT MENU CRUD TEST');
  console.log('========================================\n');

  const token = await login();
  console.log('✅ Login successful\n');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  let testResults = [];
  let agentId = null;
  let productId = null;
  let quoteId = null;

  // ============ AGENT TESTS ============
  console.log('--- Test 1: GET /api/users/agents ---');
  try {
    const res = await fetch(`${BASE_URL}/users/agents`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Agents found: ${data.length}`);
    if (data.length > 0) {
      agentId = data[0]._id;
      console.log(`First agent: ${data[0].fullName} (${data[0].role})`);
    }
    testResults.push({ test: 'GET /api/users/agents', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/users/agents', status: 'ERROR', ok: false });
  }

  console.log('\n--- Test 2: GET /api/users?role=internal_agent ---');
  try {
    const res = await fetch(`${BASE_URL}/users?role=internal_agent`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Internal agents: ${data.length}`);
    testResults.push({ test: 'GET /api/users?role=internal_agent', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/users?role=internal_agent', status: 'ERROR', ok: false });
  }

  console.log('\n--- Test 3: GET /api/users?role=external_agent ---');
  try {
    const res = await fetch(`${BASE_URL}/users?role=external_agent`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`External agents: ${data.length}`);
    testResults.push({ test: 'GET /api/users?role=external_agent', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/users?role=external_agent', status: 'ERROR', ok: false });
  }

  // Get a product for quote tests
  console.log('\n--- Getting products for quote test ---');
  try {
    const res = await fetch(`${BASE_URL}/products`, { headers });
    const data = await res.json();
    if (data.length > 0) {
      productId = data[0]._id;
      console.log(`Found product: ${data[0].name} (${productId})`);
    } else {
      console.log('⚠️ No products found');
    }
  } catch (e) {
    console.log('⚠️ Could not get products:', e.message);
  }

  // ============ QUOTE TESTS ============
  console.log('\n========================================');
  console.log('AGENT QUOTE TESTS');
  console.log('========================================');

  console.log('\n--- Test 4: GET /api/quotes ---');
  try {
    const res = await fetch(`${BASE_URL}/quotes`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Total quotes: ${data.length}`);
    testResults.push({ test: 'GET /api/quotes', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/quotes', status: 'ERROR', ok: false });
  }

  console.log('\n--- Test 5: GET /api/quotes/stats/summary ---');
  try {
    const res = await fetch(`${BASE_URL}/quotes/stats/summary`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Stats: Total=${data.total}, Approved=${data.approved}, Pending=${data.pending}`);
    }
    testResults.push({ test: 'GET /api/quotes/stats/summary', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/quotes/stats/summary', status: 'ERROR', ok: false });
  }

  if (productId && agentId) {
    console.log('\n--- Test 6: POST /api/quotes (Create) ---');
    const today = new Date();
    const validFrom = today.toISOString().split('T')[0];
    const validUntil = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    try {
      const res = await fetch(`${BASE_URL}/quotes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId,
          agentId,
          unitPrice: 120000,
          status: 'Chờ duyệt',
          validFrom,
          validUntil,
          notes: 'Test quote from API'
        })
      });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) {
        quoteId = data._id;
        console.log(`Created quote ID: ${quoteId}`);
        console.log(`Price: ${data.unitPrice?.toLocaleString()} VND`);
      } else {
        console.log('Response:', JSON.stringify(data));
      }
      testResults.push({ test: 'POST /api/quotes', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'POST /api/quotes', status: 'ERROR', ok: false });
    }

    if (quoteId) {
      console.log('\n--- Test 7: GET /api/quotes/:id ---');
      try {
        const res = await fetch(`${BASE_URL}/quotes/${quoteId}`, { headers });
        const data = await res.json();
        console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
        if (res.ok) {
          console.log(`Quote status: ${data.status}`);
        }
        testResults.push({ test: 'GET /api/quotes/:id', status: res.status, ok: res.ok });
      } catch (e) {
        console.log('❌ Error:', e.message);
        testResults.push({ test: 'GET /api/quotes/:id', status: 'ERROR', ok: false });
      }

      console.log('\n--- Test 8: PATCH /api/quotes/:id (Update) ---');
      try {
        const res = await fetch(`${BASE_URL}/quotes/${quoteId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            status: 'Đã duyệt',
            notes: 'Approved via API test'
          })
        });
        const data = await res.json();
        console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
        if (res.ok) {
          console.log(`Updated status: ${data.status}`);
        }
        testResults.push({ test: 'PATCH /api/quotes/:id', status: res.status, ok: res.ok });
      } catch (e) {
        console.log('❌ Error:', e.message);
        testResults.push({ test: 'PATCH /api/quotes/:id', status: 'ERROR', ok: false });
      }
    }

    console.log('\n--- Test 9: GET /api/quotes/agent/:agentId ---');
    try {
      const res = await fetch(`${BASE_URL}/quotes/agent/${agentId}`, { headers });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      console.log(`Quotes for agent: ${data.length}`);
      testResults.push({ test: 'GET /api/quotes/agent/:agentId', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'GET /api/quotes/agent/:agentId', status: 'ERROR', ok: false });
    }

    console.log('\n--- Test 10: GET /api/quotes/product/:productId ---');
    try {
      const res = await fetch(`${BASE_URL}/quotes/product/${productId}`, { headers });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      console.log(`Quotes for product: ${data.length}`);
      testResults.push({ test: 'GET /api/quotes/product/:productId', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'GET /api/quotes/product/:productId', status: 'ERROR', ok: false });
    }
  } else {
    console.log('\n⚠️ Skipping quote create tests (no product or agent)');
  }

  // ============ AGENT RECEIVABLE TESTS ============
  console.log('\n========================================');
  console.log('AGENT RECEIVABLE (HOA HỒNG) TESTS');
  console.log('========================================');

  console.log('\n--- Test 11: GET /api/agent-receivables/summary ---');
  try {
    const res = await fetch(`${BASE_URL}/agent-receivables/summary`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Summary rows: ${data.data?.length || 0}`);
    }
    testResults.push({ test: 'GET /api/agent-receivables/summary', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/agent-receivables/summary', status: 'ERROR', ok: false });
  }

  console.log('\n--- Test 12: GET /api/agent-receivables/statements ---');
  try {
    const res = await fetch(`${BASE_URL}/agent-receivables/statements`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Statements: ${data.length}`);
    testResults.push({ test: 'GET /api/agent-receivables/statements', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/agent-receivables/statements', status: 'ERROR', ok: false });
  }

  if (agentId) {
    console.log('\n--- Test 13: POST /api/agent-receivables/statements (Create) ---');
    const today = new Date();
    const periodFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const periodTo = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    
    try {
      const res = await fetch(`${BASE_URL}/agent-receivables/statements`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          agentId,
          periodFrom,
          periodTo,
          notes: 'Test statement from API'
        })
      });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) {
        console.log(`Statement ID: ${data._id}`);
        console.log(`Period: ${periodFrom} to ${periodTo}`);
        console.log(`Total Commission: ${data.totalCommission?.toLocaleString()} VND`);
      } else {
        console.log('Response:', JSON.stringify(data));
      }
      testResults.push({ test: 'POST /api/agent-receivables/statements', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'POST /api/agent-receivables/statements', status: 'ERROR', ok: false });
    }

    console.log('\n--- Test 14: GET /api/agent-receivables/summary?agentId=xxx ---');
    try {
      const res = await fetch(`${BASE_URL}/agent-receivables/summary?agentId=${agentId}`, { headers });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) {
        console.log(`Agent summary rows: ${data.data?.length || 0}`);
      }
      testResults.push({ test: 'GET /api/agent-receivables/summary?agentId', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'GET /api/agent-receivables/summary?agentId', status: 'ERROR', ok: false });
    }
  }

  // Cleanup: Delete test quote
  if (quoteId) {
    console.log('\n--- Cleanup: DELETE /api/quotes/:id ---');
    try {
      const res = await fetch(`${BASE_URL}/quotes/${quoteId}`, {
        method: 'DELETE',
        headers
      });
      console.log(`Delete status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      testResults.push({ test: 'DELETE /api/quotes/:id', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'DELETE /api/quotes/:id', status: 'ERROR', ok: false });
    }
  }

  // ============ SUMMARY ============
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  
  const passed = testResults.filter(t => t.ok).length;
  const failed = testResults.filter(t => !t.ok).length;
  
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${testResults.length}`);
  
  console.log('\nDetailed Results:');
  testResults.forEach(t => {
    console.log(`  ${t.ok ? '✅' : '❌'} ${t.test}: ${t.status}`);
  });
}

test().catch(console.error);
