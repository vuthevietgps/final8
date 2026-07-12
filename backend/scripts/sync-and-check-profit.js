/**
 * Gọi Summary4 sync API và kiểm tra kết quả
 */

const http = require('http');
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function syncAndCheck() {
  console.log('🚀 Calling Summary4 sync API...\n');
  
  // Call API
  await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/summary4/sync',
      method: 'POST',
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✅ Sync API response: ${data}\n`);
        } else {
          console.log(`⚠️  Status ${res.statusCode}: ${data}\n`);
        }
        resolve();
      });
    });
    req.on('error', (e) => {
      console.log(`⚠️  Request error: ${e.message}\n`);
      resolve();
    });
    req.end();
  });
  
  // Wait a bit for sync to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check database
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    // Get test orders
    const testOrders = await db.collection('testorder2').find({ 
      testCase: { $exists: true } 
    }).sort({ createdAt: -1 }).limit(3).toArray();
    
    console.log(`📊 Latest test orders: ${testOrders.length}\n`);
    
    // Get Summary4
    const orderIds = testOrders.map(o => o._id);
    const s4Records = await db.collection('summary4').find({ 
      testOrder2Id: { $in: orderIds } 
    }).toArray();
    
    console.log(`📊 Summary4 records: ${s4Records.length}\n`);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('    VERIFICATION RESULTS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    for (const order of testOrders) {
      const s4 = s4Records.find(r => r.testOrder2Id.toString() === order._id.toString());
      const product = await db.collection('products').findOne({ _id: order.productId });
      const quote = await db.collection('quotes').findOne({ _id: order.quoteId });
      const user = await db.collection('users').findOne({ _id: order.agentId });
      
      console.log(`\n📝 ${order.testCase || 'Test Order'}`);
      console.log(`   Agent: ${user?.role || 'unknown'}`);
      console.log(`   Production: ${order.productionStatus}`);
      console.log(`   Order: ${order.orderStatus}`);
      console.log(`   Quantity: ${order.quantity}\n`);
      
      if (product) {
        const productCost = (product.importPrice || 0) + (product.shippingCost || 0) + (product.packagingCost || 0);
        console.log(`   Product Cost (per unit): ${productCost.toLocaleString()} đ`);
        console.log(`   Total Product Cost: ${(productCost * order.quantity).toLocaleString()} đ`);
      }
      
      if (quote) {
        console.log(`   Quote Unit Price: ${(quote.unitPrice || 0).toLocaleString()} đ`);
        console.log(`   Total Quote Price: ${((quote.unitPrice || 0) * order.quantity).toLocaleString()} đ\n`);
      }
      
      if (s4) {
        console.log(`   ✅ Summary4:`);
        console.log(`      revenue (paidToCompanyAmount): ${(s4.paidToCompanyAmount || 0).toLocaleString()} đ`);
        console.log(`      cost (mustPayAmount): ${(s4.mustPayAmount || 0).toLocaleString()} đ`);
        console.log(`      profit: ${((s4.paidToCompanyAmount || 0) - (s4.mustPayAmount || 0)).toLocaleString()} đ`);
        
        // Verify cost
        if (product) {
          const expectedCost = ((product.importPrice || 0) + (product.shippingCost || 0) + (product.packagingCost || 0)) * order.quantity;
          const actualCost = s4.mustPayAmount || 0;
          
          if (order.productionStatus === 'Đã trả kết quả') {
            if (actualCost === expectedCost) {
              console.log(`      Cost verification: ✅ CORRECT`);
            } else {
              console.log(`      Cost verification: ❌ WRONG`);
              console.log(`         Expected: ${expectedCost.toLocaleString()} đ`);
              console.log(`         Actual: ${actualCost.toLocaleString()} đ`);
            }
          }
        }
      } else {
        console.log(`   ❌ No Summary4 record`);
      }
    }
    
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('    SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const totals = s4Records.reduce((sum, r) => ({
      revenue: sum.revenue + (r.paidToCompanyAmount || 0),
      cost: sum.cost + (r.mustPayAmount || 0),
      profit: sum.profit + ((r.paidToCompanyAmount || 0) - (r.mustPayAmount || 0))
    }), { revenue: 0, cost: 0, profit: 0 });
    
    console.log(`Total Revenue: ${totals.revenue.toLocaleString()} đ`);
    console.log(`Total Cost: ${totals.cost.toLocaleString()} đ`);
    console.log(`Total Profit: ${totals.profit.toLocaleString()} đ`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

syncAndCheck();
