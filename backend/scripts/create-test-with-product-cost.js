/**
 * Tạo test data với Product có giá vốn để verify logic mới
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

async function createTestWithProductCost() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    // Find agents
    const internalAgent = await db.collection('users').findOne({ role: 'internal_agent' });
    const externalAgent = await db.collection('users').findOne({ role: 'external_agent' });
    
    if (!internalAgent || !externalAgent) {
      console.log('❌ Cần có internal_agent và external_agent');
      return;
    }
    
    console.log(`Internal agent: ${internalAgent.fullName}`);
    console.log(`External agent: ${externalAgent.fullName}\n`);
    
    // Create Product với giá vốn rõ ràng
    const product = {
      _id: new ObjectId(),
      name: 'Test Product - Áo Thun',
      importPrice: 50000,      // Giá nhập
      shippingCost: 10000,     // Chi phí vận chuyển
      packagingCost: 5000,     // Chi phí đóng gói
      // Tổng giá vốn = 65,000 đ
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('products').insertOne(product);
    console.log(`✅ Created product: ${product.name}`);
    console.log(`   Import: ${product.importPrice.toLocaleString()} đ`);
    console.log(`   Shipping: ${product.shippingCost.toLocaleString()} đ`);
    console.log(`   Packaging: ${product.packagingCost.toLocaleString()} đ`);
    console.log(`   TOTAL COST: ${(product.importPrice + product.shippingCost + product.packagingCost).toLocaleString()} đ\n`);
    
    // Create Quote với giá bán cao hơn giá vốn
    const quote = {
      _id: new ObjectId(),
      name: 'Test Quote - Áo Thun',
      productId: product._id,
      unitPrice: 120000,  // Giá bán cho đại lý (cao hơn giá vốn 65k)
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('quotes').insertOne(quote);
    console.log(`✅ Created quote: ${quote.name}`);
    console.log(`   Unit Price (Giá bán): ${quote.unitPrice.toLocaleString()} đ`);
    console.log(`   Margin: ${(quote.unitPrice - 65000).toLocaleString()} đ\n`);
    
    // Test cases
    const testCases = [
      {
        name: 'External Agent - Đã trả kết quả',
        agent: externalAgent,
        productionStatus: 'Đã trả kết quả',
        orderStatus: 'Giao thành công',
        quantity: 5,
        codAmount: 650000,
        depositAmount: 50000,
        expectedRevenue: 600000,  // unitPrice (120k) × qty (5) = 600k
        expectedCost: 325000,     // productCost (65k) × qty (5) = 325k
        expectedProfit: 275000    // 600k - 325k = 275k
      },
      {
        name: 'Internal Agent - Giao thành công',
        agent: internalAgent,
        productionStatus: 'Đã trả kết quả',
        orderStatus: 'Giao thành công',
        quantity: 4,
        codAmount: 450000,
        depositAmount: 50000,
        expectedRevenue: 500000,  // deposit (50k) + cod (450k) = 500k
        expectedCost: 260000,     // productCost (65k) × qty (4) = 260k
        expectedProfit: 240000    // 500k - 260k = 240k
      },
      {
        name: 'Internal Agent - Chưa giao',
        agent: internalAgent,
        productionStatus: 'Đã trả kết quả',
        orderStatus: 'Đang vận chuyển',
        quantity: 3,
        codAmount: 350000,
        depositAmount: 30000,
        expectedRevenue: 0,       // Chưa giao → revenue = 0
        expectedCost: 195000,     // productCost (65k) × qty (3) = 195k
        expectedProfit: -195000   // 0 - 195k = -195k (âm vì chưa thu tiền)
      }
    ];
    
    console.log('📝 CREATING TEST ORDERS:\n');
    
    for (const tc of testCases) {
      const order = {
        _id: new ObjectId(),
        agentId: tc.agent._id,
        productId: product._id,
        quoteId: quote._id,
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
      
      await db.collection('testorder2').insertOne(order);
      
      console.log(`✅ ${tc.name}`);
      console.log(`   Agent: ${tc.agent.role}`);
      console.log(`   Quantity: ${tc.quantity}`);
      console.log(`   Expected Revenue: ${tc.expectedRevenue.toLocaleString()} đ`);
      console.log(`   Expected Cost: ${tc.expectedCost.toLocaleString()} đ`);
      console.log(`   Expected Profit: ${tc.expectedProfit.toLocaleString()} đ\n`);
    }
    
    console.log('✅ Test data created!');
    console.log('\n💡 Next: Gọi sync và verify kết quả');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

createTestWithProductCost();
