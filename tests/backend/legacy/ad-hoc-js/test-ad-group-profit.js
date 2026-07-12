/**
 * Test Script: Chi Phí & Lợi Nhuận Nhóm Quảng Cáo
 * 
 * LOGIC NGHIỆP VỤ:
 * ================
 * 
 * 1. AD GROUP DAILY REPORT (/ad-group-daily-report)
 *    - Đồng bộ từ ordertest2 vào ad_group_daily_reports collection
 *    - Cron job chạy lúc 3:00 AM mỗi ngày
 *    - Tính tổng chi phí ads (adsCost) và lợi nhuận (netProfit) theo ngày
 * 
 * 2. AD GROUP PROFIT REPORT (/ad-group-profit-report)
 *    - Performance report: ROI, margin, orders theo ad group
 *    - Optimal spend: Gợi ý ngân sách tối ưu dựa trên ROI history
 *    - Summary: Tổng quan profit tất cả ad groups
 *    - Snapshots: Lưu snapshot gợi ý (chạy lúc 6:00 AM)
 * 
 * 3. CÁCH TÍNH:
 *    - totalNetProfit = SUM(netProfit từ orders đã kết thúc)
 *    - Đơn hoàn: netProfit âm → giảm ROI thực tế
 *    - ROI = (totalNetProfit / totalAdsSpent) * 100
 *    - returnRate = (returnOrders / totalOrders) * 100
 *    - successProfit + returnLoss = totalNetProfit
 * 
 * 4. OPTIMAL SPEND SUGGESTION:
 *    - ROI >= 200%: Tăng 20% ngân sách
 *    - ROI >= 100%: Tăng 10% ngân sách
 *    - ROI >= minROI: Giữ nguyên
 *    - ROI >= 30%: Giảm 20% ngân sách
 *    - ROI < 30%: Nên tắt (kill)
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
  console.log('CHI PHÍ & LỢI NHUẬN NHÓM QUẢNG CÁO TEST');
  console.log('========================================\n');

  const token = await login();
  console.log('✅ Login successful\n');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  let testResults = [];

  // ============ SECTION 1: AD GROUP DAILY REPORT ============
  console.log('========================================');
  console.log('SECTION 1: AD GROUP DAILY REPORT');
  console.log('(Báo cáo hàng ngày - sync từ orders)');
  console.log('========================================');

  // Test 1: POST sync (đồng bộ dữ liệu)
  console.log('\n--- Test 1: POST /api/ad-group-daily-report/sync ---');
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    const res = await fetch(`${BASE_URL}/ad-group-daily-report/sync?date=${dateStr}`, {
      method: 'POST',
      headers
    });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Date: ${data.date}`);
      console.log(`Records processed: ${data.recordsProcessed}`);
    } else {
      console.log('Response:', JSON.stringify(data));
    }
    testResults.push({ test: 'POST /api/ad-group-daily-report/sync', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'POST /api/ad-group-daily-report/sync', status: 'ERROR', ok: false });
  }

  // Test 2: GET daily report
  console.log('\n--- Test 2: GET /api/ad-group-daily-report ---');
  try {
    const res = await fetch(`${BASE_URL}/ad-group-daily-report`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Total records: ${data.details?.length || 0}`);
      console.log(`Total ads cost: ${(data.summary?.totalAdsCost || 0).toLocaleString()} VND`);
      console.log(`Total net profit: ${(data.summary?.totalNetProfit || 0).toLocaleString()} VND`);
      if (data.details?.length > 0) {
        console.log(`Sample record: ${data.details[0].adGroupName} - ${data.details[0].date}`);
      }
    }
    testResults.push({ test: 'GET /api/ad-group-daily-report', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/ad-group-daily-report', status: 'ERROR', ok: false });
  }

  // Test 3: GET top ad groups
  console.log('\n--- Test 3: GET /api/ad-group-daily-report/top ---');
  try {
    const res = await fetch(`${BASE_URL}/ad-group-daily-report/top?limit=5&sortBy=profit`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok && data.topAdGroups) {
      console.log(`Top ad groups: ${data.topAdGroups.length}`);
      data.topAdGroups.slice(0, 3).forEach((ag, i) => {
        console.log(`  ${i+1}. ${ag.adGroupName}: ${ag.netProfit?.toLocaleString()} VND profit`);
      });
    }
    testResults.push({ test: 'GET /api/ad-group-daily-report/top', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/ad-group-daily-report/top', status: 'ERROR', ok: false });
  }

  // ============ SECTION 2: AD GROUP PROFIT REPORT ============
  console.log('\n========================================');
  console.log('SECTION 2: AD GROUP PROFIT REPORT');
  console.log('(Phân tích ROI & gợi ý ngân sách)');
  console.log('========================================');

  // Test 4: GET performance report
  console.log('\n--- Test 4: GET /api/ad-group-profit-report/performance ---');
  try {
    const res = await fetch(`${BASE_URL}/ad-group-profit-report/performance?minOrders=1`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok && Array.isArray(data)) {
      console.log(`Ad groups analyzed: ${data.length}`);
      if (data.length > 0) {
        const top = data[0];
        console.log(`\nTop performer: ${top.adGroupName}`);
        console.log(`  Orders: ${top.totalOrders} (${top.successOrders} success, ${top.returnOrders} return)`);
        console.log(`  Return rate: ${top.returnRate?.toFixed(1)}%`);
        console.log(`  Revenue: ${top.totalRevenue?.toLocaleString()} VND`);
        console.log(`  Ads spent: ${top.totalAdsSpent?.toLocaleString()} VND`);
        console.log(`  Net profit: ${top.totalNetProfit?.toLocaleString()} VND`);
        console.log(`  ROI: ${top.roi?.toFixed(1)}%`);
        console.log(`  Success profit: ${top.successProfit?.toLocaleString()} VND`);
        console.log(`  Return loss: ${top.returnLoss?.toLocaleString()} VND`);
      }
    }
    testResults.push({ test: 'GET /api/ad-group-profit-report/performance', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/ad-group-profit-report/performance', status: 'ERROR', ok: false });
  }

  // Test 5: GET optimal spend suggestions
  console.log('\n--- Test 5: GET /api/ad-group-profit-report/optimal-spend ---');
  try {
    const res = await fetch(`${BASE_URL}/ad-group-profit-report/optimal-spend?lookbackDays=30&minROI=50`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok && Array.isArray(data)) {
      console.log(`Suggestions: ${data.length}`);
      
      const scale = data.filter(d => d.action === 'scale_up');
      const maintain = data.filter(d => d.action === 'maintain');
      const reduce = data.filter(d => d.action === 'scale_down');
      const kill = data.filter(d => d.action === 'kill');
      
      console.log(`  Scale up: ${scale.length}`);
      console.log(`  Maintain: ${maintain.length}`);
      console.log(`  Scale down: ${reduce.length}`);
      console.log(`  Kill: ${kill.length}`);
      
      if (data.length > 0) {
        const sample = data[0];
        console.log(`\nSample suggestion:`);
        console.log(`  Ad group: ${sample.adGroupName}`);
        console.log(`  Current spend: ${sample.currentDailySpend?.toLocaleString()} VND/day`);
        console.log(`  Suggested spend: ${sample.suggestedDailySpend?.toLocaleString()} VND/day`);
        console.log(`  Action: ${sample.action}`);
        console.log(`  Reason: ${sample.reason}`);
      }
    }
    testResults.push({ test: 'GET /api/ad-group-profit-report/optimal-spend', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/ad-group-profit-report/optimal-spend', status: 'ERROR', ok: false });
  }

  // Test 6: GET summary
  console.log('\n--- Test 6: GET /api/ad-group-profit-report/summary ---');
  try {
    const res = await fetch(`${BASE_URL}/ad-group-profit-report/summary`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Total ad groups: ${data.totalAdGroups || 0}`);
      console.log(`Total orders: ${data.totalOrders || 0}`);
      console.log(`Total revenue: ${(data.totalRevenue || 0).toLocaleString()} VND`);
      console.log(`Total ads spent: ${(data.totalAdsSpent || 0).toLocaleString()} VND`);
      console.log(`Total net profit: ${(data.totalNetProfit || 0).toLocaleString()} VND`);
      console.log(`Overall ROI: ${data.overallROI?.toFixed(1) || 0}%`);
    }
    testResults.push({ test: 'GET /api/ad-group-profit-report/summary', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/ad-group-profit-report/summary', status: 'ERROR', ok: false });
  }

  // Test 7: GET snapshots latest
  console.log('\n--- Test 7: GET /api/ad-group-profit-report/snapshots/latest ---');
  try {
    const res = await fetch(`${BASE_URL}/ad-group-profit-report/snapshots/latest`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      if (Array.isArray(data)) {
        console.log(`Latest snapshots: ${data.length}`);
      } else if (data.success) {
        console.log(`Latest snapshots: ${data.data?.length || 0}`);
      }
    }
    testResults.push({ test: 'GET /api/ad-group-profit-report/snapshots/latest', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/ad-group-profit-report/snapshots/latest', status: 'ERROR', ok: false });
  }

  // Test 8: POST trigger update (đồng bộ ngay lập tức)
  console.log('\n--- Test 8: POST /api/ad-group-profit-report/snapshots/update ---');
  console.log('(Trigger đồng bộ optimal spend ngay lập tức)');
  try {
    const res = await fetch(`${BASE_URL}/ad-group-profit-report/snapshots/update`, {
      method: 'POST',
      headers
    });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Snapshots created: ${data.snapshotsCreated || data.created || 0}`);
      console.log(`Snapshots updated: ${data.snapshotsUpdated || data.updated || 0}`);
    }
    testResults.push({ test: 'POST /api/ad-group-profit-report/snapshots/update', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'POST /api/ad-group-profit-report/snapshots/update', status: 'ERROR', ok: false });
  }

  // ============ SECTION 3: AD GROUP INFO ============
  console.log('\n========================================');
  console.log('SECTION 3: AD GROUP MANAGEMENT');
  console.log('(Quản lý nhóm quảng cáo)');
  console.log('========================================');

  // Test 9: GET ad groups list
  console.log('\n--- Test 9: GET /api/ad-groups ---');
  let sampleAdGroupId = null;
  try {
    const res = await fetch(`${BASE_URL}/ad-groups`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok && Array.isArray(data)) {
      console.log(`Total ad groups: ${data.length}`);
      if (data.length > 0) {
        sampleAdGroupId = data[0].adGroupId;
        console.log(`Platforms: ${[...new Set(data.map(d => d.platform))].join(', ')}`);
        console.log(`Active: ${data.filter(d => d.status === 'active' || d.status === 'ACTIVE').length}`);
        console.log(`Sample: ${data[0].name} (${data[0].adGroupId})`);
      }
    }
    testResults.push({ test: 'GET /api/ad-groups', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/ad-groups', status: 'ERROR', ok: false });
  }

  // Test 10: GET snapshot history for ad group
  if (sampleAdGroupId) {
    console.log('\n--- Test 10: GET /api/ad-group-profit-report/snapshots/:id/history ---');
    try {
      const res = await fetch(`${BASE_URL}/ad-group-profit-report/snapshots/${sampleAdGroupId}/history?days=7`, { headers });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) {
        const items = Array.isArray(data) ? data : (data.data || []);
        console.log(`History entries: ${items.length}`);
      }
      testResults.push({ test: 'GET /api/ad-group-profit-report/snapshots/:id/history', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'GET /api/ad-group-profit-report/snapshots/:id/history', status: 'ERROR', ok: false });
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
  console.log('LOGIC NGHIỆP VỤ SUMMARY');
  console.log('========================================');
  console.log(`
📊 CÔNG THỨC TÍNH TOÁN:
------------------------
• netProfit = revenue - productCost - shippingFee - adsCost
• ROI = (netProfit / adsCost) * 100
• returnRate = (returnOrders / totalOrders) * 100
• successProfit + returnLoss = totalNetProfit

⏰ CRON JOBS:
-------------
• 03:00 AM: Sync ad-group-daily-report từ ordertest2
• 06:00 AM: Update optimal spend snapshots

💡 GỢI Ý NGÂN SÁCH:
-------------------
• ROI >= 200%: Tăng 20% → scale_up
• ROI >= 100%: Tăng 10% → scale_up
• ROI >= minROI: Giữ nguyên → maintain
• ROI >= 30%: Giảm 20% → scale_down
• ROI < 30%: Nên tắt → kill

🔄 ĐỒNG BỘ:
-----------
• Endpoint: POST /api/ad-group-daily-report/sync?date=YYYY-MM-DD
• Endpoint: POST /api/ad-group-profit-report/snapshots/update
  `);
}

test().catch(console.error);
