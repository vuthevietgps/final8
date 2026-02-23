/**
 * Test script for Supplier, Supplier Quote, and Supplier Payable APIs
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
  console.log('SUPPLIER MENU CRUD TEST');
  console.log('========================================\n');

  const token = await login();
  console.log('✅ Login successful\n');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  let testResults = [];
  let supplierId = null;
  let productId = null;
  let quoteId = null;

  // ============ SUPPLIER TESTS ============
  console.log('--- Test 1: GET /api/users/suppliers ---');
  try {
    const res = await fetch(`${BASE_URL}/users/suppliers`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Suppliers found: ${data.length}`);
    if (data.length > 0) {
      supplierId = data[0]._id;
      console.log(`First supplier: ${data[0].fullName} (${data[0].role})`);
    }
    testResults.push({ test: 'GET /api/users/suppliers', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/users/suppliers', status: 'ERROR', ok: false });
  }

  console.log('\n--- Test 2: GET /api/users/suppliers?active=true ---');
  try {
    const res = await fetch(`${BASE_URL}/users/suppliers?active=true`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Active suppliers: ${data.length}`);
    testResults.push({ test: 'GET /api/users/suppliers?active=true', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/users/suppliers?active=true', status: 'ERROR', ok: false });
  }

  console.log('\n--- Test 3: GET /api/users/suppliers?q=search ---');
  try {
    const res = await fetch(`${BASE_URL}/users/suppliers?q=ncc`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Suppliers matching 'ncc': ${data.length}`);
    testResults.push({ test: 'GET /api/users/suppliers?q=ncc', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/users/suppliers?q=ncc', status: 'ERROR', ok: false });
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
      console.log('⚠️ No products found, quote tests will be skipped');
    }
  } catch (e) {
    console.log('⚠️ Could not get products:', e.message);
  }

  // ============ SUPPLIER QUOTE TESTS ============
  console.log('\n========================================');
  console.log('SUPPLIER QUOTE TESTS');
  console.log('========================================');

  console.log('\n--- Test 4: GET /api/supplier-quotes ---');
  try {
    const res = await fetch(`${BASE_URL}/supplier-quotes`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Total quotes: ${data.data?.length || 0}`);
    testResults.push({ test: 'GET /api/supplier-quotes', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/supplier-quotes', status: 'ERROR', ok: false });
  }

  if (productId && supplierId) {
    console.log('\n--- Test 5: POST /api/supplier-quotes (Create) ---');
    try {
      const res = await fetch(`${BASE_URL}/supplier-quotes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId,
          supplierId,
          price: 50000,
          currency: 'VND',
          isReturnableOverride: true,
          shippingFee: 15000,
          returnFee: 20000,
          note: 'Test quote from API'
        })
      });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) {
        quoteId = data._id;
        console.log(`Created quote ID: ${quoteId}`);
      } else {
        console.log('Response:', JSON.stringify(data));
      }
      testResults.push({ test: 'POST /api/supplier-quotes', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'POST /api/supplier-quotes', status: 'ERROR', ok: false });
    }

    console.log('\n--- Test 6: GET /api/supplier-quotes/latest ---');
    try {
      const res = await fetch(`${BASE_URL}/supplier-quotes/latest?productId=${productId}&supplierId=${supplierId}`, { headers });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) {
        console.log(`Latest quote price: ${data.price?.toLocaleString()} ${data.currency}`);
      }
      testResults.push({ test: 'GET /api/supplier-quotes/latest', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'GET /api/supplier-quotes/latest', status: 'ERROR', ok: false });
    }

    console.log('\n--- Test 7: GET /api/supplier-quotes?productId=xxx ---');
    try {
      const res = await fetch(`${BASE_URL}/supplier-quotes?productId=${productId}`, { headers });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      console.log(`Quotes for product: ${data.data?.length || 0}`);
      testResults.push({ test: 'GET /api/supplier-quotes?productId', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'GET /api/supplier-quotes?productId', status: 'ERROR', ok: false });
    }
  } else {
    console.log('\n⚠️ Skipping quote create/latest tests (no product or supplier)');
  }

  // ============ SUPPLIER PAYABLE TESTS ============
  console.log('\n========================================');
  console.log('SUPPLIER PAYABLE TESTS');
  console.log('========================================');

  console.log('\n--- Test 8: GET /api/supplier-payables ---');
  try {
    const res = await fetch(`${BASE_URL}/supplier-payables`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Total payables: ${data.data?.length || 0}`);
    testResults.push({ test: 'GET /api/supplier-payables', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/supplier-payables', status: 'ERROR', ok: false });
  }

  console.log('\n--- Test 9: GET /api/supplier-payables/statements ---');
  try {
    const res = await fetch(`${BASE_URL}/supplier-payables/statements`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Total statements: ${data.length || 0}`);
    testResults.push({ test: 'GET /api/supplier-payables/statements', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/supplier-payables/statements', status: 'ERROR', ok: false });
  }

  if (supplierId) {
    console.log('\n--- Test 10: POST /api/supplier-payables/statements (Create) ---');
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    
    try {
      const res = await fetch(`${BASE_URL}/supplier-payables/statements`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          supplierId,
          from,
          to,
          notes: 'Test statement from API'
        })
      });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) {
        console.log(`Statement ID: ${data._id}`);
        console.log(`Period: ${from} to ${to}`);
        console.log(`Total Amount: ${data.totalAmount?.toLocaleString()} VND`);
      } else {
        console.log('Response:', JSON.stringify(data));
      }
      testResults.push({ test: 'POST /api/supplier-payables/statements', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'POST /api/supplier-payables/statements', status: 'ERROR', ok: false });
    }

    console.log('\n--- Test 11: GET /api/supplier-payables/statement/by-supplier ---');
    try {
      const res = await fetch(`${BASE_URL}/supplier-payables/statement/by-supplier?supplierId=${supplierId}`, { headers });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok && data) {
        console.log(`Statement summary: Total payables: ${data.payables?.length || 0}`);
      }
      testResults.push({ test: 'GET /api/supplier-payables/statement/by-supplier', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'GET /api/supplier-payables/statement/by-supplier', status: 'ERROR', ok: false });
    }
  }

  if (supplierId && productId) {
    console.log('\n--- Test 12: POST /api/supplier-payables (Create Payable) ---');
    try {
      const res = await fetch(`${BASE_URL}/supplier-payables`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          supplierId,
          supplierNameSnap: 'Test Supplier',
          items: [
            {
              productId,
              productNameSnap: 'Test Product',
              quantity: 10,
              unitPrice: 50000
            }
          ],
          currency: 'VND',
          notes: 'Test payable from API'
        })
      });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) {
        console.log(`Created payable ID: ${data._id}`);
        console.log(`Total Amount: ${data.totalAmount?.toLocaleString()} VND`);
      } else {
        console.log('Response:', JSON.stringify(data));
      }
      testResults.push({ test: 'POST /api/supplier-payables', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'POST /api/supplier-payables', status: 'ERROR', ok: false });
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
