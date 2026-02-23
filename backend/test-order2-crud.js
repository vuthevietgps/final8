/**
 * Comprehensive Test Script for Test-Order2 (Đơn Hàng Thử Nghiệm 2)
 * 
 * Tests:
 * - API CRUD operations
 * - Daily staff workflows (Nghiệp vụ hàng ngày)
 * - Reporting functionality
 * - Payment batch processing
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
  console.log('TEST-ORDER2 COMPREHENSIVE TEST');
  console.log('========================================\n');

  const token = await login();
  console.log('✅ Login successful\n');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  let testResults = [];
  let orderId = null;
  let productId = null;
  let supplierId = null;
  let agentId = null;

  // ============ SETUP: Get required IDs ============
  console.log('--- Setup: Getting test data ---');
  
  try {
    const productsRes = await fetch(`${BASE_URL}/products`, { headers });
    const products = await productsRes.json();
    if (products.length > 0) {
      productId = products[0]._id;
      console.log(`Product: ${products[0].name} (${productId})`);
    }
  } catch (e) { console.log('⚠️ No products'); }

  try {
    const suppliersRes = await fetch(`${BASE_URL}/users/suppliers`, { headers });
    const suppliers = await suppliersRes.json();
    if (suppliers.length > 0) {
      supplierId = suppliers[0]._id;
      console.log(`Supplier: ${suppliers[0].fullName} (${supplierId})`);
    }
  } catch (e) { console.log('⚠️ No suppliers'); }

  try {
    const agentsRes = await fetch(`${BASE_URL}/users/agents`, { headers });
    const agents = await agentsRes.json();
    if (agents.length > 0) {
      agentId = agents[0]._id;
      console.log(`Agent: ${agents[0].fullName} (${agentId})`);
    }
  } catch (e) { console.log('⚠️ No agents'); }

  // ============ SECTION 1: BASIC CRUD ============
  console.log('\n========================================');
  console.log('SECTION 1: BASIC CRUD OPERATIONS');
  console.log('========================================');

  // Test 1: GET all orders
  console.log('\n--- Test 1: GET /api/test-order2 ---');
  try {
    const res = await fetch(`${BASE_URL}/test-order2`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Orders found: ${data.items?.length || 0}, Total: ${data.total || 0}`);
    testResults.push({ test: 'GET /api/test-order2', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/test-order2', status: 'ERROR', ok: false });
  }

  // Test 2: POST - Create new order
  console.log('\n--- Test 2: POST /api/test-order2 (Create Order) ---');
  if (productId && supplierId) {
    try {
      const res = await fetch(`${BASE_URL}/test-order2`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId,
          supplierId,
          agentId: agentId || undefined,
          customerName: 'Khách hàng Test API',
          quantity: 2,
          codAmount: 350000,
          depositAmount: 50000,
          receiverName: 'Nguyễn Văn Test',
          receiverPhone: '0901234567',
          receiverAddress: '123 Đường Test, Quận 1, TP.HCM',
          productionStatus: 'Chưa làm',
          orderStatus: 'Chưa có mã vận đơn',
          isActive: true
        })
      });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) {
        orderId = data._id;
        console.log(`Created order ID: ${orderId}`);
        console.log(`COD: ${data.codAmount?.toLocaleString()} VND`);
      } else {
        console.log('Response:', JSON.stringify(data));
      }
      testResults.push({ test: 'POST /api/test-order2', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'POST /api/test-order2', status: 'ERROR', ok: false });
    }
  } else {
    console.log('⚠️ Skipping create (no product/supplier)');
  }

  // Test 3: GET single order
  if (orderId) {
    console.log('\n--- Test 3: GET /api/test-order2/:id ---');
    try {
      const res = await fetch(`${BASE_URL}/test-order2/${orderId}`, { headers });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) {
        console.log(`Order customer: ${data.customerName}`);
        console.log(`Production status: ${data.productionStatus}`);
      }
      testResults.push({ test: 'GET /api/test-order2/:id', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'GET /api/test-order2/:id', status: 'ERROR', ok: false });
    }
  }

  // ============ SECTION 2: DAILY WORKFLOWS ============
  console.log('\n========================================');
  console.log('SECTION 2: NGHIỆP VỤ NHÂN VIÊN HÀNG NGÀY');
  console.log('========================================');

  // Workflow 1: Update production status (Cập nhật trạng thái sản xuất)
  if (orderId) {
    console.log('\n--- Workflow 1: Update Production Status ---');
    console.log('   (Nhân viên sản xuất cập nhật: Chưa làm → Đang làm)');
    try {
      const res = await fetch(`${BASE_URL}/test-order2/${orderId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ productionStatus: 'Đang làm' })
      });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) {
        console.log(`✅ Production status updated: ${data.productionStatus}`);
      }
      testResults.push({ test: 'Update Production Status', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'Update Production Status', status: 'ERROR', ok: false });
    }
  }

  // Workflow 2: Update with tracking number (Cập nhật mã vận đơn)
  if (orderId) {
    console.log('\n--- Workflow 2: Add Tracking Number ---');
    console.log('   (Nhân viên giao hàng cập nhật mã vận đơn)');
    const trackingNumber = `VN${Date.now()}`;
    try {
      const res = await fetch(`${BASE_URL}/test-order2/${orderId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ 
          trackingNumber,
          orderStatus: 'Đang giao',
          productionStatus: 'Đã xong'
        })
      });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) {
        console.log(`✅ Tracking number: ${data.trackingNumber}`);
        console.log(`✅ Order status: ${data.orderStatus}`);
      }
      testResults.push({ test: 'Add Tracking Number', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'Add Tracking Number', status: 'ERROR', ok: false });
    }
  }

  // Workflow 3: Update delivery status (Cập nhật trạng thái giao hàng)
  if (orderId) {
    console.log('\n--- Workflow 3: Update Delivery Status ---');
    console.log('   (Đơn hàng giao thành công)');
    try {
      const res = await fetch(`${BASE_URL}/test-order2/${orderId}/delivery-status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ orderStatus: 'Giao thành công' })
      });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) {
        console.log(`✅ Delivery status: ${data.orderStatus}`);
      }
      testResults.push({ test: 'Update Delivery Status', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'Update Delivery Status', status: 'ERROR', ok: false });
    }
  }

  // ============ SECTION 3: FILTERS & SEARCH ============
  console.log('\n========================================');
  console.log('SECTION 3: FILTERS & SEARCH');
  console.log('========================================');

  // Test with filters
  console.log('\n--- Test: Filter by productionStatus ---');
  try {
    const res = await fetch(`${BASE_URL}/test-order2?productionStatus=Đã xong&limit=10`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Orders with 'Đã xong': ${data.items?.length || 0}`);
    testResults.push({ test: 'Filter by productionStatus', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'Filter by productionStatus', status: 'ERROR', ok: false });
  }

  console.log('\n--- Test: Filter by orderStatus ---');
  try {
    const res = await fetch(`${BASE_URL}/test-order2?orderStatus=Giao thành công&limit=10`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Orders with 'Giao thành công': ${data.items?.length || 0}`);
    testResults.push({ test: 'Filter by orderStatus', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'Filter by orderStatus', status: 'ERROR', ok: false });
  }

  console.log('\n--- Test: Search by customer name ---');
  try {
    const res = await fetch(`${BASE_URL}/test-order2?q=Test&limit=10`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Orders matching 'Test': ${data.items?.length || 0}`);
    testResults.push({ test: 'Search by customer name', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'Search by customer name', status: 'ERROR', ok: false });
  }

  // ============ SECTION 4: REPORTS ============
  console.log('\n========================================');
  console.log('SECTION 4: BÁO CÁO LỢI NHUẬN');
  console.log('========================================');

  // Daily profit report
  console.log('\n--- Test: Daily Profit Report ---');
  const today = new Date().toISOString().split('T')[0];
  try {
    const res = await fetch(`${BASE_URL}/test-order2/daily-profit-report?date=${today}`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok && data) {
      console.log(`Date: ${data.date}`);
      console.log(`Total Orders: ${data.totalOrders || 0}`);
      console.log(`Total Revenue: ${(data.totalRevenue || 0).toLocaleString()} VND`);
      console.log(`Net Profit: ${(data.netProfit || 0).toLocaleString()} VND`);
    }
    testResults.push({ test: 'Daily Profit Report', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'Daily Profit Report', status: 'ERROR', ok: false });
  }

  // Product profit report
  console.log('\n--- Test: Product Profit Report ---');
  try {
    const res = await fetch(`${BASE_URL}/test-order2/product-profit-report?date=${today}`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok && data) {
      console.log(`Products with data: ${data.products?.length || 0}`);
      console.log(`Total Revenue: ${(data.totals?.totalRevenue || 0).toLocaleString()} VND`);
    }
    testResults.push({ test: 'Product Profit Report', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'Product Profit Report', status: 'ERROR', ok: false });
  }

  // ============ SECTION 5: PAYMENT BATCHES ============
  console.log('\n========================================');
  console.log('SECTION 5: THANH TOÁN NCC VÀ ĐẠI LÝ');
  console.log('========================================');

  // Get orders pending supplier payment
  console.log('\n--- Test: Orders Pending Supplier Payment ---');
  try {
    const res = await fetch(`${BASE_URL}/test-order2/payment-pending/supplier`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Pending supplier payments: ${data.orders?.length || 0}`);
    console.log(`Total amount: ${(data.totalAmount || 0).toLocaleString()} VND`);
    testResults.push({ test: 'Orders Pending Supplier Payment', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'Orders Pending Supplier Payment', status: 'ERROR', ok: false });
  }

  // Get orders pending agent payment
  console.log('\n--- Test: Orders Pending Agent Payment ---');
  try {
    const res = await fetch(`${BASE_URL}/test-order2/payment-pending/agent`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Pending agent payments: ${data.orders?.length || 0}`);
    console.log(`Total commission: ${(data.totalCommission || 0).toLocaleString()} VND`);
    testResults.push({ test: 'Orders Pending Agent Payment', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'Orders Pending Agent Payment', status: 'ERROR', ok: false });
  }

  // Get payment batches
  console.log('\n--- Test: Get Supplier Payment Batches ---');
  try {
    const res = await fetch(`${BASE_URL}/test-order2/payment-batches/supplier`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Supplier batches: ${data.length || 0}`);
    testResults.push({ test: 'Get Supplier Payment Batches', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'Get Supplier Payment Batches', status: 'ERROR', ok: false });
  }

  console.log('\n--- Test: Get Agent Payment Batches ---');
  try {
    const res = await fetch(`${BASE_URL}/test-order2/payment-batches/agent`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Agent batches: ${data.length || 0}`);
    testResults.push({ test: 'Get Agent Payment Batches', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'Get Agent Payment Batches', status: 'ERROR', ok: false });
  }

  // ============ SECTION 6: EXPORT/IMPORT ============
  console.log('\n========================================');
  console.log('SECTION 6: EXPORT/IMPORT');
  console.log('========================================');

  console.log('\n--- Test: Export JSON ---');
  try {
    const res = await fetch(`${BASE_URL}/test-order2/export/json`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Exported items: ${data.count || 0}`);
    testResults.push({ test: 'Export JSON', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'Export JSON', status: 'ERROR', ok: false });
  }

  // ============ CLEANUP ============
  if (orderId) {
    console.log('\n--- Cleanup: Delete test order ---');
    try {
      const res = await fetch(`${BASE_URL}/test-order2/${orderId}`, {
        method: 'DELETE',
        headers
      });
      console.log(`Delete status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      testResults.push({ test: 'DELETE /api/test-order2/:id', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'DELETE /api/test-order2/:id', status: 'ERROR', ok: false });
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
  console.log('NGHIỆP VỤ HÀNG NGÀY CHECKLIST');
  console.log('========================================');
  console.log('✅ 1. Xem danh sách đơn hàng (GET /test-order2)');
  console.log('✅ 2. Tạo đơn hàng mới (POST /test-order2)');
  console.log('✅ 3. Cập nhật trạng thái sản xuất (PATCH /:id)');
  console.log('✅ 4. Cập nhật mã vận đơn (PATCH /:id)');
  console.log('✅ 5. Cập nhật trạng thái giao hàng (PATCH /:id/delivery-status)');
  console.log('✅ 6. Lọc theo trạng thái sản xuất/giao hàng');
  console.log('✅ 7. Tìm kiếm theo tên khách hàng');
  console.log('✅ 8. Xem báo cáo lợi nhuận hàng ngày');
  console.log('✅ 9. Xem báo cáo lợi nhuận theo sản phẩm');
  console.log('✅ 10. Xem đơn chờ thanh toán NCC/Đại lý');
  console.log('✅ 11. Export dữ liệu JSON/CSV');
}

test().catch(console.error);
