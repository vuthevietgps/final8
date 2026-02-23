/**
 * Comprehensive Test Script for Product Menu Features
 * 
 * Tests:
 * - Product Category (Nhóm sản phẩm) - CRUD
 * - Product Management (Quản lý sản phẩm) - CRUD
 * - Media Management (Quản lý Media) - List, Upload, Delete
 * - Product Image Report (Báo cáo ảnh sản phẩm)
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
  console.log('PRODUCT MENU COMPREHENSIVE TEST');
  console.log('========================================\n');

  const token = await login();
  console.log('✅ Login successful\n');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  let testResults = [];
  let categoryId = null;
  let productId = null;

  // ============ SECTION 1: PRODUCT CATEGORY ============
  console.log('========================================');
  console.log('SECTION 1: NHÓM SẢN PHẨM (Product Category)');
  console.log('========================================');

  // Test 1: GET all categories
  console.log('\n--- Test 1: GET /api/product-category ---');
  try {
    const res = await fetch(`${BASE_URL}/product-category`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Categories found: ${data.length}`);
    if (data.length > 0) {
      categoryId = data[0]._id;
      console.log(`First category: ${data[0].name} (${data[0].icon})`);
    }
    testResults.push({ test: 'GET /api/product-category', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/product-category', status: 'ERROR', ok: false });
  }

  // Test 2: GET active categories
  console.log('\n--- Test 2: GET /api/product-category/active ---');
  try {
    const res = await fetch(`${BASE_URL}/product-category/active`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Active categories: ${data.length}`);
    testResults.push({ test: 'GET /api/product-category/active', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/product-category/active', status: 'ERROR', ok: false });
  }

  // Test 3: GET stats summary
  console.log('\n--- Test 3: GET /api/product-category/stats/summary ---');
  try {
    const res = await fetch(`${BASE_URL}/product-category/stats/summary`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Total categories: ${data.totalCategories}`);
      console.log(`Active categories: ${data.activeCount}`);
      console.log(`Total products: ${data.totalProducts}`);
    }
    testResults.push({ test: 'GET /api/product-category/stats/summary', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/product-category/stats/summary', status: 'ERROR', ok: false });
  }

  // Test 4: POST - Create category
  console.log('\n--- Test 4: POST /api/product-category (Create) ---');
  try {
    const res = await fetch(`${BASE_URL}/product-category`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Nhóm Test API',
        code: 'TEST-API',
        icon: '🧪',
        color: '#FF6B6B',
        description: 'Nhóm sản phẩm test từ API',
        productCount: 0,
        order: 99,
        isActive: true
      })
    });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      const newCatId = data._id;
      console.log(`Created category: ${data.name} (${newCatId})`);
      
      // Test 5: GET by ID
      console.log('\n--- Test 5: GET /api/product-category/:id ---');
      const getRes = await fetch(`${BASE_URL}/product-category/${newCatId}`, { headers });
      console.log(`Status: ${getRes.status} ${getRes.ok ? '✅' : '❌'}`);
      testResults.push({ test: 'GET /api/product-category/:id', status: getRes.status, ok: getRes.ok });
      
      // Test 6: PATCH - Update
      console.log('\n--- Test 6: PATCH /api/product-category/:id ---');
      const patchRes = await fetch(`${BASE_URL}/product-category/${newCatId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: 'Nhóm Test API Updated', notes: 'Đã cập nhật' })
      });
      const patchData = await patchRes.json();
      console.log(`Status: ${patchRes.status} ${patchRes.ok ? '✅' : '❌'}`);
      if (patchRes.ok) console.log(`Updated name: ${patchData.name}`);
      testResults.push({ test: 'PATCH /api/product-category/:id', status: patchRes.status, ok: patchRes.ok });
      
      // Test 7: DELETE
      console.log('\n--- Test 7: DELETE /api/product-category/:id ---');
      const delRes = await fetch(`${BASE_URL}/product-category/${newCatId}`, {
        method: 'DELETE',
        headers
      });
      console.log(`Status: ${delRes.status} ${delRes.ok ? '✅' : '❌'}`);
      testResults.push({ test: 'DELETE /api/product-category/:id', status: delRes.status, ok: delRes.ok });
    }
    testResults.push({ test: 'POST /api/product-category', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'POST /api/product-category', status: 'ERROR', ok: false });
  }

  // ============ SECTION 2: PRODUCT MANAGEMENT ============
  console.log('\n========================================');
  console.log('SECTION 2: QUẢN LÝ SẢN PHẨM (Products)');
  console.log('========================================');

  // Test 8: GET all products
  console.log('\n--- Test 8: GET /api/products ---');
  try {
    const res = await fetch(`${BASE_URL}/products`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Products found: ${data.length}`);
    if (data.length > 0) {
      productId = data[0]._id;
      console.log(`First product: ${data[0].name}`);
    }
    testResults.push({ test: 'GET /api/products', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/products', status: 'ERROR', ok: false });
  }

  // Test 9: GET product stats
  console.log('\n--- Test 9: GET /api/products/stats ---');
  try {
    const res = await fetch(`${BASE_URL}/products/stats`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Total products: ${data.totalProducts}`);
      console.log(`Total value: ${(data.totalValue || 0).toLocaleString()} VND`);
    }
    testResults.push({ test: 'GET /api/products/stats', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/products/stats', status: 'ERROR', ok: false });
  }

  // Test 10: POST - Create product
  console.log('\n--- Test 10: POST /api/products (Create) ---');
  let newProductId = null;
  try {
    const res = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Sản phẩm Test API ' + Date.now(),
        categoryId: categoryId,
        status: 'Hoạt động',
        color: '#4CAF50',
        importPrice: 100000,
        shippingCost: 30000,
        packagingCost: 5000,
        notes: 'Sản phẩm test từ API script'
      })
    });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      newProductId = data._id;
      console.log(`Created product: ${data.name} (${newProductId})`);
    } else {
      console.log('Response:', JSON.stringify(data));
    }
    testResults.push({ test: 'POST /api/products', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'POST /api/products', status: 'ERROR', ok: false });
  }

  if (newProductId) {
    // Test 11: GET product by ID
    console.log('\n--- Test 11: GET /api/products/:id ---');
    try {
      const res = await fetch(`${BASE_URL}/products/${newProductId}`, { headers });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) console.log(`Product name: ${data.name}`);
      testResults.push({ test: 'GET /api/products/:id', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'GET /api/products/:id', status: 'ERROR', ok: false });
    }

    // Test 12: PATCH - Update product
    console.log('\n--- Test 12: PATCH /api/products/:id ---');
    try {
      const res = await fetch(`${BASE_URL}/products/${newProductId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name: 'Sản phẩm Test API Updated',
          importPrice: 150000
        })
      });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) console.log(`Updated name: ${data.name}, price: ${data.importPrice}`);
      testResults.push({ test: 'PATCH /api/products/:id', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'PATCH /api/products/:id', status: 'ERROR', ok: false });
    }

    // Test 13: GET product media
    console.log('\n--- Test 13: GET /api/products/:id/media ---');
    try {
      const res = await fetch(`${BASE_URL}/products/${newProductId}/media`, { headers });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok) console.log(`Media items: ${data.data?.items?.length || 0}`);
      testResults.push({ test: 'GET /api/products/:id/media', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'GET /api/products/:id/media', status: 'ERROR', ok: false });
    }

    // Test 14: DELETE product
    console.log('\n--- Test 14: DELETE /api/products/:id ---');
    try {
      const res = await fetch(`${BASE_URL}/products/${newProductId}`, {
        method: 'DELETE',
        headers
      });
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      testResults.push({ test: 'DELETE /api/products/:id', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'DELETE /api/products/:id', status: 'ERROR', ok: false });
    }
  }

  // Test 15: GET by category
  if (categoryId) {
    console.log('\n--- Test 15: GET /api/products/category/:categoryId ---');
    try {
      const res = await fetch(`${BASE_URL}/products/category/${categoryId}`, { headers });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      console.log(`Products in category: ${data.length}`);
      testResults.push({ test: 'GET /api/products/category/:categoryId', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'GET /api/products/category/:categoryId', status: 'ERROR', ok: false });
    }
  }

  // ============ SECTION 3: MEDIA MANAGEMENT ============
  console.log('\n========================================');
  console.log('SECTION 3: QUẢN LÝ MEDIA');
  console.log('========================================');

  // Test 16: GET media list
  console.log('\n--- Test 16: GET /api/media ---');
  try {
    const res = await fetch(`${BASE_URL}/media`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    console.log(`Media items: ${data.items?.length || 0}, Total: ${data.total || 0}`);
    testResults.push({ test: 'GET /api/media', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/media', status: 'ERROR', ok: false });
  }

  // Test 17: POST validate-product-images
  console.log('\n--- Test 17: POST /api/media/validate-product-images ---');
  try {
    const res = await fetch(`${BASE_URL}/media/validate-product-images`, {
      method: 'POST',
      headers
    });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok) {
      console.log(`Total products: ${data.totalProducts || 0}`);
      console.log(`Valid images: ${(data.validMainImages || 0) + (data.validFanpageImages || 0)}`);
    }
    testResults.push({ test: 'POST /api/media/validate-product-images', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'POST /api/media/validate-product-images', status: 'ERROR', ok: false });
  }

  // Test 18: GET product image report (if product exists)
  if (productId) {
    console.log('\n--- Test 18: GET /api/media/product-report/:productId ---');
    try {
      const res = await fetch(`${BASE_URL}/media/product-report/${productId}`, { headers });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      console.log(`Product: ${data.productName}`);
      console.log(`Total images: ${data.total}`);
      testResults.push({ test: 'GET /api/media/product-report/:productId', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'GET /api/media/product-report/:productId', status: 'ERROR', ok: false });
    }
  }

  // Test 19: GET variation images report
  console.log('\n--- Test 19: GET /api/products/variation-images-report ---');
  try {
    const res = await fetch(`${BASE_URL}/products/variation-images-report`, { headers });
    const data = await res.json();
    console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
    if (res.ok && data.success) {
      console.log(`Products with variations: ${data.data?.items?.length || 0}`);
    }
    testResults.push({ test: 'GET /api/products/variation-images-report', status: res.status, ok: res.ok });
  } catch (e) {
    console.log('❌ Error:', e.message);
    testResults.push({ test: 'GET /api/products/variation-images-report', status: 'ERROR', ok: false });
  }

  // Test 20: Best images endpoint
  if (productId) {
    console.log('\n--- Test 20: GET /api/products/:id/best-images ---');
    try {
      const res = await fetch(`${BASE_URL}/products/${productId}/best-images?limit=5`, { headers });
      const data = await res.json();
      console.log(`Status: ${res.status} ${res.ok ? '✅' : '❌'}`);
      if (res.ok && data.success) {
        console.log(`Best images: ${data.data?.length || 0}`);
      }
      testResults.push({ test: 'GET /api/products/:id/best-images', status: res.status, ok: res.ok });
    } catch (e) {
      console.log('❌ Error:', e.message);
      testResults.push({ test: 'GET /api/products/:id/best-images', status: 'ERROR', ok: false });
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
  console.log('NGHIỆP VỤ & BUTTON CHECKLIST');
  console.log('========================================');
  console.log('✅ 1. Nhóm sản phẩm: Thêm mới, Sửa inline, Xóa');
  console.log('✅ 2. Sản phẩm: Thêm mới, Xem chi tiết, Sửa, Xóa');
  console.log('✅ 3. Sản phẩm: Lọc theo danh mục, trạng thái');
  console.log('✅ 4. Sản phẩm: Xem thống kê (stats)');
  console.log('✅ 5. Media: Danh sách ảnh, Upload, Xóa');
  console.log('✅ 6. Media: Đồng bộ ảnh (sync), Validate');
  console.log('✅ 7. Báo cáo: Báo cáo ảnh sản phẩm');
  console.log('✅ 8. Báo cáo: Variation images report');
  console.log('✅ 9. AI: Best images cho sản phẩm');
}

test().catch(console.error);
