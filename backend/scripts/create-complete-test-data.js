/**
 * Tạo Product và Quote test với giá vốn rõ ràng
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function createCompleteTestData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    // Delete old test data
    await db.collection('testorder2').deleteMany({ testCase: { $exists: true } });
    await db.collection('quotes').deleteMany({ name: 'Test Quote' });
    await db.collection('products').deleteMany({ name: 'Test Product' });
    await db.collection('summary4').deleteMany({});
    await db.collection('summary5').deleteMany({});
    
    console.log('🗑️  Cleaned old test data\n');
    
    // Get agents
    const internalAgent = await db.collection('users').findOne({ role: 'internal_agent' });
    const externalAgent = await db.collection('users').findOne({ role: 'external_agent' });
    
    if (!internalAgent || !externalAgent) {
      console.log('❌ Need internal_agent and external_agent in database');
      return;
    }
    
    // Get a category
    const category = await db.collection('productcategories').findOne();
    
    if (!category) {
      console.log('❌ Need at least one product category');
      return;
    }
    
    // Create test product với giá vốn rõ ràng
    const product = {
      _id: new ObjectId(),
      name: 'Test Product',
      categoryId: category._id,
      importPrice: 50000,      // Giá nhập: 50k
      shippingCost: 10000,     // Phí vận chuyển: 10k
      packagingCost: 5000,     // Phí đóng gói: 5k
      // → Tổng giá vốn: 65k
      minStock: 10,
      maxStock: 100,
      estimatedDeliveryDays: 3,
      usageDurationMonths: 12,
      status: 'Hoạt động',
      color: '#3B82F6',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('products').insertOne(product);
    
    const productCost = product.importPrice + product.shippingCost + product.packagingCost;
    
    console.log('📦 Created Test Product:');
    console.log(`   ID: ${product._id}`);
    console.log(`   Import Price: ${product.importPrice.toLocaleString()} đ`);
    console.log(`   Shipping Cost: ${product.shippingCost.toLocaleString()} đ`);
    console.log(`   Packaging Cost: ${product.packagingCost.toLocaleString()} đ`);
    console.log(`   → TOTAL COST: ${productCost.toLocaleString()} đ\n`);
    
    // Create quotes với giá bán
    const externalQuote = {
      _id: new ObjectId(),
      name: 'Test Quote',
      productId: product._id,
      agentId: externalAgent._id,
      product: product.name,
      agentName: externalAgent.fullName,
      unitPrice: 100000,  // Giá bán cho external agent: 100k (margin: 35k)
      status: 'approved',
      validFrom: new Date('2024-01-01'),
      validUntil: new Date('2026-12-31'),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const internalQuote = {
      _id: new ObjectId(),
      name: 'Test Quote Internal',
      productId: product._id,
      agentId: internalAgent._id,
      product: product.name,
      agentName: internalAgent.fullName,
      unitPrice: 80000,  // Giá bán cho internal agent: 80k (margin: 15k)
      status: 'approved',
      validFrom: new Date('2024-01-01'),
      validUntil: new Date('2026-12-31'),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('quotes').insertMany([externalQuote, internalQuote]);
    
    console.log('💰 Created Test Quotes:');
    console.log(`   External Agent Quote: ${externalQuote.unitPrice.toLocaleString()} đ (margin: ${(externalQuote.unitPrice - productCost).toLocaleString()} đ)`);
    console.log(`   Internal Agent Quote: ${internalQuote.unitPrice.toLocaleString()} đ (margin: ${(internalQuote.unitPrice - productCost).toLocaleString()} đ)\n`);
    
    // Create test orders
    const testCases = [
      {
        name: 'External - Đã trả kết quả',
        agentId: externalAgent._id,
        quoteId: externalQuote._id,
        productId: product._id,
        productionStatus: 'Đã trả kết quả',
        orderStatus: 'Giao thành công',
        quantity: 5,
        codAmount: 600000,
        depositAmount: 50000,
        expectedRevenue: 500000,  // 100k × 5
        expectedCost: 325000,     // 65k × 5
        expectedProfit: 175000,   // 500k - 325k
        note: 'External: revenue = unitPrice × qty, cost = productCost × qty'
      },
      {
        name: 'Internal - Đã trả kết quả + Giao thành công',
        agentId: internalAgent._id,
        quoteId: internalQuote._id,
        productId: product._id,
        productionStatus: 'Đã trả kết quả',
        orderStatus: 'Giao thành công',
        quantity: 4,
        codAmount: 450000,
        depositAmount: 50000,
        expectedRevenue: 500000,  // deposit + COD
        expectedCost: 260000,     // 65k × 4
        expectedProfit: 240000,   // 500k - 260k
        note: 'Internal + Giao thành công: revenue = deposit + COD'
      },
      {
        name: 'Internal - Đã trả kết quả nhưng chưa giao',
        agentId: internalAgent._id,
        quoteId: internalQuote._id,
        productId: product._id,
        productionStatus: 'Đã trả kết quả',
        orderStatus: 'Đang vận chuyển',
        quantity: 3,
        codAmount: 350000,
        depositAmount: 30000,
        expectedRevenue: 0,       // Chưa giao thành công
        expectedCost: 195000,     // 65k × 3
        expectedProfit: -195000,  // 0 - 195k (âm vì chưa có doanh thu)
        note: 'Internal chưa "Giao thành công" → revenue = 0, profit âm'
      }
    ];
    
    const orders = [];
    
    for (const tc of testCases) {
      const order = {
        _id: new ObjectId(),
        agentId: tc.agentId,
        quoteId: tc.quoteId,
        productId: tc.productId,
        productionStatus: tc.productionStatus,
        orderStatus: tc.orderStatus,
        quantity: tc.quantity,
        codAmount: tc.codAmount,
        depositAmount: tc.depositAmount,
        orderDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        testCase: tc.name
      };
      
      orders.push(order);
    }
    
    await db.collection('testorder2').insertMany(orders);
    
    console.log(`✅ Created ${orders.length} test orders\n`);
    
    console.log('📊 EXPECTED RESULTS:\n');
    testCases.forEach((tc, idx) => {
      console.log(`${idx + 1}. ${tc.name}`);
      console.log(`   Revenue: ${tc.expectedRevenue.toLocaleString()} đ`);
      console.log(`   Cost: ${tc.expectedCost.toLocaleString()} đ`);
      console.log(`   Profit: ${tc.expectedProfit.toLocaleString()} đ`);
      console.log(`   ${tc.note}\n`);
    });
    
    console.log(`💡 Giá vốn sản phẩm: ${productCost.toLocaleString()} đ`);
    console.log(`   Giá bán External: ${externalQuote.unitPrice.toLocaleString()} đ (margin: ${(externalQuote.unitPrice - productCost).toLocaleString()} đ/sp)`);
    console.log(`   Giá bán Internal: ${internalQuote.unitPrice.toLocaleString()} đ (margin: ${(internalQuote.unitPrice - productCost).toLocaleString()} đ/sp)`);
    
    console.log('\n✅ Test data created!');
    console.log('\n💡 Next: node backend/scripts/verify-revenue-logic.js');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

createCompleteTestData();
