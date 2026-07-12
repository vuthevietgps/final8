/**
 * Tạo dữ liệu test để verify logic doanh thu mới trong Summary5
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function createTestData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    console.log('🔧 Tạo dữ liệu test...\n');
    
    // Tìm user internal và external
    const internalAgent = await db.collection('users').findOne({ role: 'internal_agent' });
    const externalAgent = await db.collection('users').findOne({ role: 'external_agent' });
    
    if (!internalAgent || !externalAgent) {
      console.log('❌ Cần có internal_agent và external_agent trong database');
      return;
    }
    
    console.log(`Internal agent: ${internalAgent.fullName} (${internalAgent._id})`);
    console.log(`External agent: ${externalAgent.fullName} (${externalAgent._id})\n`);
    
    // Tạo quote test
    const quote = {
      _id: new ObjectId(),
      name: 'Test Quote',
      unitPrice: 100000,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('quotes').insertOne(quote);
    console.log(`✅ Created quote: ${quote._id}\n`);
    
    // Test cases
    const testCases = [
      {
        name: 'External Agent - Đã trả kết quả - Giao thành công',
        agentId: externalAgent._id,
        quoteId: quote._id,
        productionStatus: 'Đã trả kết quả',
        orderStatus: 'Giao thành công',
        quantity: 5,
        codAmount: 600000,
        depositAmount: 50000,
        expectedRevenue: 500000, // unitPrice (100k) × quantity (5)
        note: 'External: revenue = unitPrice × qty = 100k × 5 = 500k'
      },
      {
        name: 'External Agent - Đã trả kết quả - Chưa giao',
        agentId: externalAgent._id,
        quoteId: quote._id,
        productionStatus: 'Đã trả kết quả',
        orderStatus: 'Đang vận chuyển',
        quantity: 3,
        codAmount: 350000,
        depositAmount: 30000,
        expectedRevenue: 300000, // unitPrice × qty = 100k × 3
        note: 'External: revenue = unitPrice × qty (không phụ thuộc orderStatus)'
      },
      {
        name: 'External Agent - Chưa trả kết quả',
        agentId: externalAgent._id,
        quoteId: quote._id,
        productionStatus: 'Đang sản xuất',
        orderStatus: 'Chưa giao',
        quantity: 2,
        codAmount: 250000,
        depositAmount: 0,
        expectedRevenue: 0, // Chưa trả kết quả → revenue = 0
        note: 'productionStatus ≠ "Đã trả kết quả" → revenue = 0'
      },
      {
        name: 'Internal Agent - Đã trả kết quả - Giao thành công',
        agentId: internalAgent._id,
        quoteId: quote._id,
        productionStatus: 'Đã trả kết quả',
        orderStatus: 'Giao thành công',
        quantity: 4,
        codAmount: 450000,
        depositAmount: 50000,
        expectedRevenue: 500000, // deposit (50k) + cod (450k)
        note: 'Internal + Giao thành công: revenue = deposit + cod = 50k + 450k'
      },
      {
        name: 'Internal Agent - Đã trả kết quả - Chưa giao thành công',
        agentId: internalAgent._id,
        quoteId: quote._id,
        productionStatus: 'Đã trả kết quả',
        orderStatus: 'Đang vận chuyển',
        quantity: 3,
        codAmount: 350000,
        depositAmount: 30000,
        expectedRevenue: 0, // orderStatus ≠ "Giao thành công" → revenue = 0
        note: 'Internal nhưng chưa "Giao thành công" → revenue = 0'
      },
      {
        name: 'Internal Agent - Chưa trả kết quả',
        agentId: internalAgent._id,
        quoteId: quote._id,
        productionStatus: 'Đang sản xuất',
        orderStatus: 'Giao thành công',
        quantity: 2,
        codAmount: 250000,
        depositAmount: 20000,
        expectedRevenue: 0, // productionStatus ≠ "Đã trả kết quả" → revenue = 0
        note: 'productionStatus ≠ "Đã trả kết quả" → revenue = 0'
      }
    ];
    
    const orders = [];
    
    for (const tc of testCases) {
      const order = {
        _id: new ObjectId(),
        agentId: tc.agentId,
        quoteId: tc.quoteId,
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
    
    // Print expected results
    console.log('📊 EXPECTED RESULTS:\n');
    testCases.forEach((tc, idx) => {
      console.log(`${idx + 1}. ${tc.name}`);
      console.log(`   Expected revenue: ${tc.expectedRevenue.toLocaleString()} đ`);
      console.log(`   ${tc.note}\n`);
    });
    
    console.log('✅ Test data created!');
    console.log('\n💡 Next steps:');
    console.log('   1. Gọi API: POST http://localhost:3000/summary4/sync');
    console.log('   2. Summary5 sẽ tự động sync sau Summary4');
    console.log('   3. Verify kết quả với script verify-revenue-logic.js');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

createTestData();
