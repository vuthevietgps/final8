/**
 * Script để debug lợi nhuận âm trong Summary5
 * Chạy: node scripts/debug-summary5-negative-profit.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

async function debug() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const summary4 = db.collection('summary4');
    const summary5 = db.collection('summary5');
    
    // Lấy mẫu records Summary5 có lợi nhuận âm
    console.log('📊 Sample Summary5 records with negative profit:\n');
    const negativeProfit = await summary5.find({ profit: { $lt: 0 } }).limit(5).toArray();
    
    for (const rec of negativeProfit) {
      console.log(`Date: ${rec.orderDate?.toISOString().slice(0,10)}, AdGroup: ${rec.adGroupId}, Product: ${rec.productId}`);
      console.log(`  Revenue: ${rec.revenue || 0}`);
      console.log(`  Profit: ${rec.profit || 0}`);
      console.log(`  AdCost: ${rec.adCost || 0}`);
      
      // Tìm các Summary4 records tương ứng
      const dateStr = rec.orderDate ? rec.orderDate.toISOString().slice(0,10) : null;
      if (dateStr) {
        const startDate = new Date(dateStr);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        
        const s4Records = await summary4.find({
          isActive: { $ne: false },
          orderDate: { $gte: startDate, $lt: endDate },
          $or: [
            { adGroupId: rec.adGroupId },
            { adGroupId: { $exists: false } },
            { adGroupId: null }
          ]
        }).toArray();
        
        console.log(`  → Found ${s4Records.length} Summary4 records for this date:`);
        s4Records.forEach((s4, idx) => {
          console.log(`    [${idx+1}] paidToCompany: ${s4.paidToCompanyAmount || 0}, mustPay: ${s4.mustPayAmount || 0}, manualPayment: ${s4.manualPaymentAmount || 0}`);
          console.log(`        → Calculated profit: ${(s4.paidToCompanyAmount || 0) - (s4.mustPayAmount || 0) - (s4.manualPaymentAmount || 0)}`);
        });
      }
      console.log('');
    }
    
    // Phân tích Summary4 fields
    console.log('\n📊 Summary4 fields analysis:\n');
    
    const fieldStats = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          avgPaidToCompany: { $avg: { $ifNull: ['$paidToCompanyAmount', 0] } },
          avgMustPay: { $avg: { $ifNull: ['$mustPayAmount', 0] } },
          avgManualPayment: { $avg: { $ifNull: ['$manualPaymentAmount', 0] } },
          sumPaidToCompany: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          sumMustPay: { $sum: { $ifNull: ['$mustPayAmount', 0] } },
          sumManualPayment: { $sum: { $ifNull: ['$manualPaymentAmount', 0] } },
          recordsWithNegativeCalc: {
            $sum: {
              $cond: [
                {
                  $lt: [
                    {
                      $subtract: [
                        { $ifNull: ['$paidToCompanyAmount', 0] },
                        { $add: [{ $ifNull: ['$mustPayAmount', 0] }, { $ifNull: ['$manualPaymentAmount', 0] }] }
                      ]
                    },
                    0
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]).toArray();
    
    const stats = fieldStats[0];
    console.log(`Total active Summary4 records: ${stats.totalRecords}`);
    console.log(`\nAverages:`);
    console.log(`  paidToCompanyAmount: ${stats.avgPaidToCompany.toFixed(2)}`);
    console.log(`  mustPayAmount: ${stats.avgMustPay.toFixed(2)}`);
    console.log(`  manualPaymentAmount: ${stats.avgManualPayment.toFixed(2)}`);
    console.log(`\nTotals:`);
    console.log(`  Total revenue (paidToCompany): ${stats.sumPaidToCompany.toLocaleString()}`);
    console.log(`  Total mustPay: ${stats.sumMustPay.toLocaleString()}`);
    console.log(`  Total manualPayment: ${stats.sumManualPayment.toLocaleString()}`);
    console.log(`  → Calculated profit: ${(stats.sumPaidToCompany - stats.sumMustPay - stats.sumManualPayment).toLocaleString()}`);
    console.log(`\nRecords with negative calculated profit: ${stats.recordsWithNegativeCalc} (${(stats.recordsWithNegativeCalc/stats.totalRecords*100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

debug();
