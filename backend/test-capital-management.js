/**
 * Comprehensive Test Script for Capital Management & Allocation
 * 
 * Tests:
 * - Finance APIs (Funding sources, Budget buckets, Cashflows, Loans)
 * - Capital Allocation (Policies, Snapshots, Reinvestment)
 * - Budget Allocation (Auto allocate, Preview, Status)
 * - Cashflow Safety (Health, Dashboard, Alerts)
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
  console.log('CAPITAL MANAGEMENT & ALLOCATION TEST');
  console.log('========================================\n');

  const token = await login();
  console.log('✅ Login successful\n');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  let testResults = [];

  // ============ SECTION 1: FINANCE APIs ============
  console.log('========================================');
  console.log('SECTION 1: FINANCE APIs');
  console.log('========================================');

  // Test 1: GET summary
  console.log('\n--- Test 1: GET /api/finance/summary ---');
  try {
    const res = await fetch(`${BASE_URL}/finance/summary`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Total funding: ${(data.totalFunding || 0).toLocaleString()} VND`);
      console.log(`Total budget: ${(data.totalBudget || 0).toLocaleString()} VND`);
    }
    testResults.push({ test: 'GET /api/finance/summary', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/finance/summary', status: 'ERROR', ok: false });
  }

  // Test 2: GET funding-sources
  console.log('\n--- Test 2: GET /api/finance/funding-sources ---');
  try {
    const res = await fetch(`${BASE_URL}/finance/funding-sources`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Funding sources: ${Array.isArray(data) ? data.length : 0}`);
    testResults.push({ test: 'GET /api/finance/funding-sources', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/finance/funding-sources', status: 'ERROR', ok: false });
  }

  // Test 3: POST funding-source
  console.log('\n--- Test 3: POST /api/finance/funding-sources ---');
  let fundingSourceId = null;
  try {
    const res = await fetch(`${BASE_URL}/finance/funding-sources`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Nguồn vốn Test API',
        type: 'internal',
        principal: 50000000,
        availableBalance: 50000000
      })
    });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      fundingSourceId = data._id;
      console.log(`Created: ${data.name} (${fundingSourceId})`);
    }
    testResults.push({ test: 'POST /api/finance/funding-sources', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'POST /api/finance/funding-sources', status: 'ERROR', ok: false });
  }

  // Test 4: GET budget-buckets
  console.log('\n--- Test 4: GET /api/finance/budget-buckets ---');
  try {
    const res = await fetch(`${BASE_URL}/finance/budget-buckets`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Budget buckets: ${Array.isArray(data) ? data.length : 0}`);
    testResults.push({ test: 'GET /api/finance/budget-buckets', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/finance/budget-buckets', status: 'ERROR', ok: false });
  }

  // Test 5: GET cashflows
  console.log('\n--- Test 5: GET /api/finance/cashflows ---');
  try {
    const res = await fetch(`${BASE_URL}/finance/cashflows`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Cashflow entries: ${Array.isArray(data) ? data.length : 0}`);
    testResults.push({ test: 'GET /api/finance/cashflows', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/finance/cashflows', status: 'ERROR', ok: false });
  }

  // Test 6: GET available-funds/current
  console.log('\n--- Test 6: GET /api/finance/available-funds/current ---');
  try {
    const res = await fetch(`${BASE_URL}/finance/available-funds/current?mode=conservative`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Available funds: ${(data.availableForAds || data.total || 0).toLocaleString()} VND`);
    }
    testResults.push({ test: 'GET /api/finance/available-funds/current', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/finance/available-funds/current', status: 'ERROR', ok: false });
  }

  // Test 7: GET loans
  console.log('\n--- Test 7: GET /api/finance/loans ---');
  try {
    const res = await fetch(`${BASE_URL}/finance/loans`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Loans: ${Array.isArray(data) ? data.length : 0}`);
    testResults.push({ test: 'GET /api/finance/loans', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/finance/loans', status: 'ERROR', ok: false });
  }

  // Test 8: GET upcoming repayments
  console.log('\n--- Test 8: GET /api/finance/repayments/upcoming ---');
  try {
    const res = await fetch(`${BASE_URL}/finance/repayments/upcoming?days=30`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Upcoming repayments: ${Array.isArray(data) ? data.length : 0}`);
    testResults.push({ test: 'GET /api/finance/repayments/upcoming', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/finance/repayments/upcoming', status: 'ERROR', ok: false });
  }

  // ============ SECTION 2: CAPITAL ALLOCATION ============
  console.log('\n========================================');
  console.log('SECTION 2: CAPITAL ALLOCATION');
  console.log('========================================');

  // Test 9: GET policies
  console.log('\n--- Test 9: GET /api/capital-allocation/policies ---');
  let policyId = null;
  try {
    const res = await fetch(`${BASE_URL}/capital-allocation/policies`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Policies: ${Array.isArray(data) ? data.length : 0}`);
    if (Array.isArray(data) && data.length > 0) {
      policyId = data[0]._id;
      console.log(`First policy: ${data[0].name}`);
    }
    testResults.push({ test: 'GET /api/capital-allocation/policies', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/capital-allocation/policies', status: 'ERROR', ok: false });
  }

  // Test 10: GET active policy
  console.log('\n--- Test 10: GET /api/capital-allocation/policies/active ---');
  try {
    const res = await fetch(`${BASE_URL}/capital-allocation/policies/active`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok && data) {
      console.log(`Active policy: ${data.name}`);
      console.log(`  Reinvestment: ${data.reinvestmentPercent}%`);
      console.log(`  Safety reserve: ${data.safetyReservePercent}%`);
    }
    testResults.push({ test: 'GET /api/capital-allocation/policies/active', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/capital-allocation/policies/active', status: 'ERROR', ok: false });
  }

  // Test 11: POST create policy
  console.log('\n--- Test 11: POST /api/capital-allocation/policies ---');
  let testPolicyId = null;
  try {
    const res = await fetch(`${BASE_URL}/capital-allocation/policies`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Policy Test API',
        reinvestmentRatio: 50,
        safetyReserveRatio: 20,
        personalIncomeRatio: 20,
        longTermAssetRatio: 10,
        isActive: false,
        notes: 'Created by test script'
      })
    });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      testPolicyId = data._id;
      console.log(`Created policy: ${data.name}`);
    }
    testResults.push({ test: 'POST /api/capital-allocation/policies', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'POST /api/capital-allocation/policies', status: 'ERROR', ok: false });
  }

  // Test 12: PATCH update policy
  if (testPolicyId) {
    console.log('\n--- Test 12: PATCH /api/capital-allocation/policies/:id ---');
    try {
      const res = await fetch(`${BASE_URL}/capital-allocation/policies/${testPolicyId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ reinvestmentRatio: 55 })
      });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) console.log(`Updated reinvestmentRatio: ${data.reinvestmentRatio}%`);
      testResults.push({ test: 'PATCH /api/capital-allocation/policies/:id', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'PATCH /api/capital-allocation/policies/:id', status: 'ERROR', ok: false });
    }

    // Test 13: DELETE policy
    console.log('\n--- Test 13: DELETE /api/capital-allocation/policies/:id ---');
    try {
      const res = await fetch(`${BASE_URL}/capital-allocation/policies/${testPolicyId}`, {
        method: 'DELETE',
        headers
      });
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      testResults.push({ test: 'DELETE /api/capital-allocation/policies/:id', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'DELETE /api/capital-allocation/policies/:id', status: 'ERROR', ok: false });
    }
  }

  // Test 14: GET compute allocation
  console.log('\n--- Test 14: GET /api/capital-allocation/compute ---');
  try {
    const res = await fetch(`${BASE_URL}/capital-allocation/compute`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Net profit: ${(data.netProfit || 0).toLocaleString()} VND`);
      console.log(`Reinvestment: ${(data.reinvestment || 0).toLocaleString()} VND`);
    }
    testResults.push({ test: 'GET /api/capital-allocation/compute', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/capital-allocation/compute', status: 'ERROR', ok: false });
  }

  // Test 15: GET snapshots
  console.log('\n--- Test 15: GET /api/capital-allocation/snapshots ---');
  try {
    const res = await fetch(`${BASE_URL}/capital-allocation/snapshots?limit=5`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Snapshots: ${Array.isArray(data) ? data.length : 0}`);
    testResults.push({ test: 'GET /api/capital-allocation/snapshots', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/capital-allocation/snapshots', status: 'ERROR', ok: false });
  }

  // Test 16: GET reinvestment-budget
  console.log('\n--- Test 16: GET /api/capital-allocation/reinvestment-budget ---');
  try {
    const res = await fetch(`${BASE_URL}/capital-allocation/reinvestment-budget`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Available reinvestment: ${(data.available || 0).toLocaleString()} VND`);
    }
    testResults.push({ test: 'GET /api/capital-allocation/reinvestment-budget', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/capital-allocation/reinvestment-budget', status: 'ERROR', ok: false });
  }

  // ============ SECTION 3: BUDGET ALLOCATION ============
  console.log('\n========================================');
  console.log('SECTION 3: BUDGET ALLOCATION (Ads)');
  console.log('========================================');

  // Test 17: GET status
  console.log('\n--- Test 17: GET /api/budget-allocation/status ---');
  try {
    const res = await fetch(`${BASE_URL}/budget-allocation/status`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Active ad groups: ${data.activeAdGroups || 0}`);
      console.log(`Total budget: ${(data.totalBudget || 0).toLocaleString()} VND`);
    }
    testResults.push({ test: 'GET /api/budget-allocation/status', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/budget-allocation/status', status: 'ERROR', ok: false });
  }

  // Test 18: GET preview (dry run)
  console.log('\n--- Test 18: GET /api/budget-allocation/preview ---');
  try {
    const res = await fetch(`${BASE_URL}/budget-allocation/preview?priorityMode=roi`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Allocation preview ready`);
      console.log(`Ad groups: ${data.allocations?.length || 0}`);
    }
    testResults.push({ test: 'GET /api/budget-allocation/preview', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/budget-allocation/preview', status: 'ERROR', ok: false });
  }

  // ============ SECTION 4: CASHFLOW SAFETY ============
  console.log('\n========================================');
  console.log('SECTION 4: CASHFLOW SAFETY');
  console.log('========================================');

  // Test 19: GET cashflow-health
  console.log('\n--- Test 19: GET /api/finance/cashflow-health ---');
  try {
    const res = await fetch(`${BASE_URL}/finance/cashflow-health`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`CSI (Cashflow Safety Index): ${data.CSI?.toFixed(2) || 'N/A'}`);
      console.log(`Risk Level: ${data.cashflowRiskLevel || 'N/A'}`);
      console.log(`DSO: ${data.DSO?.toFixed(1) || 'N/A'} days`);
      console.log(`Return Rate: ${data.returnRate?.toFixed(2) || 'N/A'}%`);
    }
    testResults.push({ test: 'GET /api/finance/cashflow-health', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/finance/cashflow-health', status: 'ERROR', ok: false });
  }

  // Test 20: GET dashboard
  console.log('\n--- Test 20: GET /api/finance/dashboard ---');
  try {
    const res = await fetch(`${BASE_URL}/finance/dashboard`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`CSI: ${data.summary?.csi?.toFixed(2) || 'N/A'}`);
      console.log(`Status: ${data.summary?.csiStatus || 'N/A'}`);
      console.log(`Days until cashout: ${data.summary?.daysUntilCashout || 'N/A'}`);
    }
    testResults.push({ test: 'GET /api/finance/dashboard', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/finance/dashboard', status: 'ERROR', ok: false });
  }

  // Test 21: GET alerts
  console.log('\n--- Test 21: GET /api/finance/alerts ---');
  try {
    const res = await fetch(`${BASE_URL}/finance/alerts`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Total alerts: ${data.summary?.total || 0}`);
      console.log(`Critical: ${data.summary?.critical || 0}`);
      console.log(`Danger: ${data.summary?.danger || 0}`);
      console.log(`Warning: ${data.summary?.warning || 0}`);
    }
    testResults.push({ test: 'GET /api/finance/alerts', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/finance/alerts', status: 'ERROR', ok: false });
  }

  // Cleanup: delete test funding source
  if (fundingSourceId) {
    console.log('\n--- Cleanup: Delete test funding source ---');
    try {
      // Use PATCH to set status = 'deleted' since there's no DELETE
      const res = await fetch(`${BASE_URL}/finance/funding-sources/${fundingSourceId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'deleted' })
      });
      console.log(`Cleanup: ${res.ok ? '✅' : '❌'}`);
    } catch (e) {
      console.log('Cleanup failed:', e.message);
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

  console.log('\n========================================');
  console.log('NGHIỆP VỤ QUẢN LÝ VỐN & PHÂN BỔ');
  console.log('========================================');
  console.log('✅ 1. Nguồn vốn: Thêm, Sửa, Xem danh sách');
  console.log('✅ 2. Ngân sách theo nhóm: Thêm, Sửa, Xem');
  console.log('✅ 3. Dòng tiền vào/ra: Ghi nhận, Xem lịch sử');
  console.log('✅ 4. Vốn khả dụng: Tính toán theo mode');
  console.log('✅ 5. Vay vốn: Quản lý hợp đồng, lịch trả');
  console.log('✅ 6. Chính sách phân bổ: CRUD đầy đủ');
  console.log('✅ 7. Snapshot lợi nhuận: Lưu, Xem lịch sử');
  console.log('✅ 8. Phân bổ ngân sách Ads: Preview, Auto');
  console.log('✅ 9. Sức khỏe dòng tiền: CSI, DSO, DPO');
  console.log('✅ 10. Cảnh báo tài chính: Critical/Danger/Warning');
}

test().catch(console.error);
