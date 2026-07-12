/**
 * Kiểm tra công thức tính lợi nhuận trong Summary5
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function checkProfitCalculation() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('    KIỂM TRA CÔNG THỨC LỢI NHUẬN SUMMARY5');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Lấy test cases
    const testOrders = await db.collection('testorder2').find({ testCase: { $exists: true } }).toArray();
    const orderIds = testOrders.map(o => o._id);
    
    // Lấy Summary4
    const s4Records = await db.collection('summary4').find({ 
      testOrder2Id: { $in: orderIds } 
    }).toArray();
    
    console.log(`📊 Summary4 records: ${s4Records.length}\n`);
    
    // Lấy Summary5
    const s5Records = await db.collection('summary5').find({}).toArray();
    
    console.log(`📊 Summary5 records: ${s5Records.length}\n`);
    
    // Kiểm tra từng record
    for (const order of testOrders) {
      const s4 = s4Records.find(r => r.testOrder2Id.toString() === order._id.toString());
      
      if (!s4) continue;
      
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📝 ${order.testCase}\n`);
      
      console.log('Summary4 Fields:');
      console.log(`  paidToCompanyAmount: ${(s4.paidToCompanyAmount || 0).toLocaleString()} đ`);
      console.log(`  mustPayAmount: ${(s4.mustPayAmount || 0).toLocaleString()} đ`);
      console.log(`  manualPaymentAmount: ${(s4.manualPaymentAmount || 0).toLocaleString()} đ\n`);
      
      // Tính lợi nhuận theo công thức
      const revenue = s4.paidToCompanyAmount || 0;
      const mustPay = s4.mustPayAmount || 0;
      const manualPay = s4.manualPaymentAmount || 0;
      const calculatedProfit = revenue - mustPay - manualPay;
      
      console.log('Công thức:');
      console.log(`  profit = revenue - mustPayAmount - manualPaymentAmount`);
      console.log(`  profit = ${revenue.toLocaleString()} - ${mustPay.toLocaleString()} - ${manualPay.toLocaleString()}`);
      console.log(`  profit = ${calculatedProfit.toLocaleString()} đ\n`);
      
      // Tìm Summary5 tương ứng
      const s5 = s5Records.find(r => r.summary4Id === s4._id.toString());
      
      if (s5) {
        console.log('Summary5 Record:');
        console.log(`  revenue: ${(s5.revenue || 0).toLocaleString()} đ`);
        console.log(`  profit: ${(s5.profit || 0).toLocaleString()} đ`);
        console.log(`  adCost: ${(s5.adCost || 0).toLocaleString()} đ\n`);
        
        // So sánh
        const revenueMatch = s5.revenue === revenue;
        const profitMatch = s5.profit === calculatedProfit;
        
        console.log('Verification:');
        console.log(`  Revenue: ${revenueMatch ? '✅' : '❌'} ${s5.revenue === revenue ? 'MATCH' : 'NOT MATCH'}`);
        console.log(`  Profit: ${profitMatch ? '✅' : '❌'} ${s5.profit === calculatedProfit ? 'MATCH' : 'NOT MATCH'}`);
        
        if (!profitMatch) {
          console.log(`\n  ⚠️  MISMATCH DETECTED:`);
          console.log(`     Expected: ${calculatedProfit.toLocaleString()} đ`);
          console.log(`     Actual: ${(s5.profit || 0).toLocaleString()} đ`);
          console.log(`     Difference: ${(calculatedProfit - (s5.profit || 0)).toLocaleString()} đ`);
        }
      } else {
        console.log('❌ No Summary5 record found for this Summary4\n');
      }
    }
    
    // Kiểm tra aggregation logic trong Summary5
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('    KIỂM TRA AGGREGATION LOGIC');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('📋 Aggregation trong summary5.service.ts:\n');
    console.log('Stage $addFields:');
    console.log('  revenue: "$paidToCompanyAmount"');
    console.log('  profit: {');
    console.log('    $subtract: [');
    console.log('      "$paidToCompanyAmount",');
    console.log('      { $add: ["$mustPayAmount", "$manualPaymentAmount"] }');
    console.log('    ]');
    console.log('  }\n');
    
    console.log('⚠️  VẤN ĐỀ PHÁT HIỆN:');
    console.log('Nếu có $group stage sau $addFields, profit có thể bị aggregate lại!\n');
    
    // Kiểm tra có group không
    console.log('Checking current aggregation...\n');
    
    const testAgg = await db.collection('summary4').aggregate([
      { $match: { testOrder2Id: { $in: orderIds } } },
      { $limit: 1 },
      {
        $project: {
          paidToCompanyAmount: 1,
          mustPayAmount: 1,
          manualPaymentAmount: 1
        }
      },
      {
        $addFields: {
          revenue: '$paidToCompanyAmount',
          profit: {
            $subtract: [
              '$paidToCompanyAmount',
              { $add: ['$mustPayAmount', '$manualPaymentAmount'] }
            ]
          }
        }
      }
    ]).toArray();
    
    if (testAgg.length > 0) {
      console.log('Test aggregation result:');
      console.log(`  paidToCompanyAmount: ${testAgg[0].paidToCompanyAmount}`);
      console.log(`  mustPayAmount: ${testAgg[0].mustPayAmount}`);
      console.log(`  manualPaymentAmount: ${testAgg[0].manualPaymentAmount}`);
      console.log(`  revenue: ${testAgg[0].revenue}`);
      console.log(`  profit: ${testAgg[0].profit}`);
      console.log(`  ✅ Aggregation formula is correct\n`);
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('    KẾT LUẬN');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const s4Total = s4Records.reduce((sum, r) => ({
      revenue: sum.revenue + (r.paidToCompanyAmount || 0),
      mustPay: sum.mustPay + (r.mustPayAmount || 0),
      manualPay: sum.manualPay + (r.manualPaymentAmount || 0)
    }), { revenue: 0, mustPay: 0, manualPay: 0 });
    
    const s4ExpectedProfit = s4Total.revenue - s4Total.mustPay - s4Total.manualPay;
    
    const s5Total = s5Records.reduce((sum, r) => ({
      revenue: sum.revenue + (r.revenue || 0),
      profit: sum.profit + (r.profit || 0)
    }), { revenue: 0, profit: 0 });
    
    console.log('Summary4 Totals:');
    console.log(`  Revenue: ${s4Total.revenue.toLocaleString()} đ`);
    console.log(`  Must Pay: ${s4Total.mustPay.toLocaleString()} đ`);
    console.log(`  Manual Pay: ${s4Total.manualPay.toLocaleString()} đ`);
    console.log(`  Expected Profit: ${s4ExpectedProfit.toLocaleString()} đ\n`);
    
    console.log('Summary5 Totals:');
    console.log(`  Revenue: ${s5Total.revenue.toLocaleString()} đ`);
    console.log(`  Profit: ${s5Total.profit.toLocaleString()} đ\n`);
    
    console.log('Verification:');
    console.log(`  Revenue: ${s4Total.revenue === s5Total.revenue ? '✅ MATCH' : '❌ NOT MATCH'}`);
    console.log(`  Profit: ${s4ExpectedProfit === s5Total.profit ? '✅ MATCH' : '❌ NOT MATCH'}`);
    
    if (s4ExpectedProfit !== s5Total.profit) {
      console.log(`\n  ⚠️  PROFIT MISMATCH:`);
      console.log(`     Expected (S4): ${s4ExpectedProfit.toLocaleString()} đ`);
      console.log(`     Actual (S5): ${s5Total.profit.toLocaleString()} đ`);
      console.log(`     Difference: ${(s4ExpectedProfit - s5Total.profit).toLocaleString()} đ`);
      console.log(`\n  💡 Có thể do:`);
      console.log(`     1. Aggregation $group stage đang SUM lại profit`);
      console.log(`     2. Summary5 chưa sync sau khi sửa logic`);
      console.log(`     3. Có filter bỏ qua một số records`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

checkProfitCalculation();
