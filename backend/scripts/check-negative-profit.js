/**
 * Script để kiểm tra dữ liệu Summary4 có lợi nhuận âm
 * Chạy: node scripts/check-negative-profit.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

async function check() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const summary4 = db.collection('summary4');
    
    // Tìm các record có lợi nhuận âm
    const negativeProfitRecords = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $project: {
          orderDate: 1,
          productId: 1,
          adGroupId: 1,
          paidToCompanyAmount: { $ifNull: ['$paidToCompanyAmount', 0] },
          mustPayAmount: { $ifNull: ['$mustPayAmount', 0] },
          manualPaymentAmount: { $ifNull: ['$manualPaymentAmount', 0] },
          profit: {
            $subtract: [
              { $ifNull: ['$paidToCompanyAmount', 0] },
              { $add: [
                { $ifNull: ['$mustPayAmount', 0] },
                { $ifNull: ['$manualPaymentAmount', 0] }
              ]}
            ]
          }
        }
      },
      { $match: { profit: { $lt: 0 } } },
      { $sort: { profit: 1 } },
      { $limit: 10 }
    ]).toArray();
    
    console.log('📊 Top 10 records with negative profit:\n');
    negativeProfitRecords.forEach((rec, idx) => {
      console.log(`Record ${idx + 1}:`);
      console.log(`  orderDate: ${rec.orderDate}`);
      console.log(`  adGroupId: ${rec.adGroupId || 'null'}`);
      console.log(`  productId: ${typeof rec.productId === 'object' ? JSON.stringify(rec.productId) : rec.productId}`);
      console.log(`  paidToCompanyAmount (revenue): ${rec.paidToCompanyAmount}`);
      console.log(`  mustPayAmount (cost): ${rec.mustPayAmount}`);
      console.log(`  manualPaymentAmount: ${rec.manualPaymentAmount}`);
      console.log(`  => Profit: ${rec.profit}`);
      console.log('');
    });
    
    // Đếm tổng số record âm
    const countNegative = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $project: {
          profit: {
            $subtract: [
              { $ifNull: ['$paidToCompanyAmount', 0] },
              { $add: [
                { $ifNull: ['$mustPayAmount', 0] },
                { $ifNull: ['$manualPaymentAmount', 0] }
              ]}
            ]
          }
        }
      },
      { $match: { profit: { $lt: 0 } } },
      { $count: 'total' }
    ]).toArray();
    
    console.log(`\n📈 Total records with negative profit: ${countNegative[0]?.total || 0}`);
    
    // Kiểm tra các record có revenue = 0 nhưng có cost
    const zeroRevenueWithCost = await summary4.find({
      isActive: { $ne: false },
      $or: [
        { paidToCompanyAmount: 0 },
        { paidToCompanyAmount: { $exists: false } },
        { paidToCompanyAmount: null }
      ],
      $or: [
        { mustPayAmount: { $gt: 0 } },
        { manualPaymentAmount: { $gt: 0 } }
      ]
    }).limit(5).toArray();
    
    console.log('\n📋 Sample records with zero revenue but has cost:');
    zeroRevenueWithCost.forEach((rec, idx) => {
      console.log(`\nRecord ${idx + 1}:`);
      console.log(`  _id: ${rec._id}`);
      console.log(`  paidToCompanyAmount: ${rec.paidToCompanyAmount || 0}`);
      console.log(`  mustPayAmount: ${rec.mustPayAmount || 0}`);
      console.log(`  manualPaymentAmount: ${rec.manualPaymentAmount || 0}`);
      console.log(`  orderStatus: ${rec.orderStatus}`);
      console.log(`  productionStatus: ${rec.productionStatus}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

check();
