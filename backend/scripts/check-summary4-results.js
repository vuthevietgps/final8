/**
 * Kiểm tra Summary4 sau khi backend restart
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

async function checkSummary4Results() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    const testOrders = await db.collection('testorder2').find({ testCase: { $exists: true } }).toArray();
    const s4Records = await db.collection('summary4').find({}).toArray();
    
    console.log(`📊 Test orders: ${testOrders.length}`);
    console.log(`📊 Summary4 records: ${s4Records.length}\n`);
    
    if (s4Records.length === 0) {
      console.log('⚠️  No Summary4 records. Backend chưa sync.\n');
      console.log('Waiting 3 seconds and checking again...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const s4Again = await db.collection('summary4').find({}).toArray();
      console.log(`\n📊 Summary4 records after wait: ${s4Again.length}\n`);
      
      if (s4Again.length === 0) {
        console.log('Backend có thể chưa auto-sync. Hãy kiểm tra backend logs.');
        return;
      }
    }
    
    const s4Final = await db.collection('summary4').find({}).toArray();
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('    SUMMARY4 RESULTS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    for (const s4 of s4Final) {
      const order = testOrders.find(o => o._id.toString() === s4.testOrder2Id?.toString());
      
      if (!order) continue;
      
      console.log(`📝 ${order.testCase}`);
      console.log(`   paidToCompanyAmount (revenue): ${(s4.paidToCompanyAmount || 0).toLocaleString()} đ`);
      console.log(`   mustPayAmount (cost): ${(s4.mustPayAmount || 0).toLocaleString()} đ`);
      console.log(`   profit: ${((s4.paidToCompanyAmount || 0) - (s4.mustPayAmount || 0)).toLocaleString()} đ\n`);
    }
    
    // Calculate totals
    const totals = s4Final.reduce((sum, r) => ({
      revenue: sum.revenue + (r.paidToCompanyAmount || 0),
      cost: sum.cost + (r.mustPayAmount || 0)
    }), { revenue: 0, cost: 0 });
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('    TOTALS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log(`Total Revenue: ${totals.revenue.toLocaleString()} đ`);
    console.log(`Total Cost: ${totals.cost.toLocaleString()} đ`);
    console.log(`Total Profit: ${(totals.revenue - totals.cost).toLocaleString()} đ\n`);
    
    console.log('💡 Expected:');
    console.log(`   Revenue: 1,000,000 đ (500k external + 500k internal)`);
    console.log(`   Cost: 780,000 đ (325k + 260k + 195k)`);
    console.log(`   Profit: 220,000 đ (175k + 240k - 195k)\n`);
    
    const revenueMatch = totals.revenue === 1000000;
    const costMatch = totals.cost === 780000;
    const profitMatch = (totals.revenue - totals.cost) === 220000;
    
    console.log(`Revenue: ${revenueMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Cost: ${costMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Profit: ${profitMatch ? '✅ PASS' : '❌ FAIL'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

checkSummary4Results();
