/**
 * Script để kiểm tra chi tiết doanh thu trong Summary4
 * Phân tích theo orderStatus, productionStatus
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

async function checkSummary4Revenue() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const summary4 = db.collection('summary4');
    
    // Tổng quan Summary4
    console.log('📊 SUMMARY4 OVERVIEW:\n');
    
    const overview = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          totalCost: { $sum: { $ifNull: ['$mustPayAmount', 0] } },
          totalManualPayment: { $sum: { $ifNull: ['$manualPaymentAmount', 0] } },
          avgRevenue: { $avg: { $ifNull: ['$paidToCompanyAmount', 0] } },
          maxRevenue: { $max: { $ifNull: ['$paidToCompanyAmount', 0] } },
          minRevenue: { $min: { $ifNull: ['$paidToCompanyAmount', 0] } }
        }
      }
    ]).toArray();
    
    const total = overview[0];
    console.log(`Total records: ${total.totalRecords}`);
    console.log(`Total revenue (paidToCompanyAmount): ${total.totalRevenue.toLocaleString()} đ`);
    console.log(`Total cost (mustPayAmount): ${total.totalCost.toLocaleString()} đ`);
    console.log(`Total manual payment: ${total.totalManualPayment.toLocaleString()} đ`);
    console.log(`Average revenue per record: ${Math.round(total.avgRevenue).toLocaleString()} đ`);
    console.log(`Max revenue: ${total.maxRevenue.toLocaleString()} đ`);
    console.log(`Min revenue: ${total.minRevenue.toLocaleString()} đ`);
    console.log(`Calculated profit: ${(total.totalRevenue - total.totalCost - total.totalManualPayment).toLocaleString()} đ`);
    
    // Phân tích theo orderStatus
    console.log('\n\n📦 REVENUE BY ORDER STATUS:\n');
    
    const byOrderStatus = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          totalCost: { $sum: { $ifNull: ['$mustPayAmount', 0] } }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]).toArray();
    
    byOrderStatus.forEach(item => {
      const profit = item.totalRevenue - item.totalCost;
      console.log(`${item._id || 'NULL'}:`);
      console.log(`  Records: ${item.count}`);
      console.log(`  Revenue: ${item.totalRevenue.toLocaleString()} đ`);
      console.log(`  Cost: ${item.totalCost.toLocaleString()} đ`);
      console.log(`  Profit: ${profit.toLocaleString()} đ`);
      console.log('');
    });
    
    // Phân tích theo productionStatus
    console.log('\n📋 REVENUE BY PRODUCTION STATUS:\n');
    
    const byProductionStatus = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $group: {
          _id: '$productionStatus',
          count: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          totalCost: { $sum: { $ifNull: ['$mustPayAmount', 0] } }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]).toArray();
    
    byProductionStatus.forEach(item => {
      const profit = item.totalRevenue - item.totalCost;
      console.log(`${item._id || 'NULL'}:`);
      console.log(`  Records: ${item.count}`);
      console.log(`  Revenue: ${item.totalRevenue.toLocaleString()} đ`);
      console.log(`  Cost: ${item.totalCost.toLocaleString()} đ`);
      console.log(`  Profit: ${profit.toLocaleString()} đ`);
      console.log('');
    });
    
    // Phân tích kết hợp orderStatus + productionStatus
    console.log('\n🔍 REVENUE BY ORDER STATUS + PRODUCTION STATUS:\n');
    
    const combined = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $group: {
          _id: { 
            orderStatus: '$orderStatus', 
            productionStatus: '$productionStatus' 
          },
          count: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          totalCost: { $sum: { $ifNull: ['$mustPayAmount', 0] } }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    combined.forEach(item => {
      const profit = item.totalRevenue - item.totalCost;
      console.log(`${item._id.orderStatus || 'NULL'} + ${item._id.productionStatus || 'NULL'}:`);
      console.log(`  Records: ${item.count}`);
      console.log(`  Revenue: ${item.totalRevenue.toLocaleString()} đ`);
      console.log(`  Cost: ${item.totalCost.toLocaleString()} đ`);
      console.log(`  Profit: ${profit.toLocaleString()} đ`);
      console.log('');
    });
    
    // Phân tích theo adGroupId
    console.log('\n🎯 REVENUE BY AD GROUP:\n');
    
    const byAdGroup = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $group: {
          _id: '$adGroupId',
          count: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          totalCost: { $sum: { $ifNull: ['$mustPayAmount', 0] } }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 }
    ]).toArray();
    
    byAdGroup.forEach(item => {
      const profit = item.totalRevenue - item.totalCost;
      console.log(`AdGroup ${item._id || 'NULL'}:`);
      console.log(`  Records: ${item.count}`);
      console.log(`  Revenue: ${item.totalRevenue.toLocaleString()} đ`);
      console.log(`  Cost: ${item.totalCost.toLocaleString()} đ`);
      console.log(`  Profit: ${profit.toLocaleString()} đ`);
      console.log('');
    });
    
    // Sample records với revenue cao nhất
    console.log('\n💰 TOP 5 HIGHEST REVENUE RECORDS:\n');
    
    const topRecords = await summary4.find({ isActive: { $ne: false } })
      .sort({ paidToCompanyAmount: -1 })
      .limit(5)
      .toArray();
    
    topRecords.forEach((rec, idx) => {
      console.log(`Record ${idx + 1}:`);
      console.log(`  _id: ${rec._id}`);
      console.log(`  orderDate: ${rec.orderDate}`);
      console.log(`  orderStatus: ${rec.orderStatus}`);
      console.log(`  productionStatus: ${rec.productionStatus}`);
      console.log(`  adGroupId: ${rec.adGroupId || 'NULL'}`);
      console.log(`  productId: ${typeof rec.productId === 'object' ? JSON.stringify(rec.productId) : rec.productId}`);
      console.log(`  paidToCompanyAmount: ${(rec.paidToCompanyAmount || 0).toLocaleString()} đ`);
      console.log(`  mustPayAmount: ${(rec.mustPayAmount || 0).toLocaleString()} đ`);
      console.log(`  manualPaymentAmount: ${(rec.manualPaymentAmount || 0).toLocaleString()} đ`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('✅ Connection closed');
  }
}

checkSummary4Revenue();
