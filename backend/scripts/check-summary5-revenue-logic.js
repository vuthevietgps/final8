/**
 * Script để kiểm tra logic doanh thu trong Summary5
 * So sánh với Summary4 để đảm bảo tính đúng
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

async function checkRevenueLogic() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const summary4 = db.collection('summary4');
    const summary5 = db.collection('summary5');
    
    // Tổng doanh thu từ Summary4
    console.log('📊 Summary4 Revenue Analysis:\n');
    
    const s4Total = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          totalCost: { $sum: { $ifNull: ['$mustPayAmount', 0] } },
          totalManualPayment: { $sum: { $ifNull: ['$manualPaymentAmount', 0] } },
          totalRecords: { $sum: 1 }
        }
      }
    ]).toArray();
    
    const s4 = s4Total[0] || { totalRevenue: 0, totalCost: 0, totalManualPayment: 0, totalRecords: 0 };
    console.log(`Total records: ${s4.totalRecords}`);
    console.log(`Total revenue (paidToCompanyAmount): ${s4.totalRevenue.toLocaleString()} đ`);
    console.log(`Total cost (mustPayAmount): ${s4.totalCost.toLocaleString()} đ`);
    console.log(`Total manual payment: ${s4.totalManualPayment.toLocaleString()} đ`);
    console.log(`Calculated profit: ${(s4.totalRevenue - s4.totalCost - s4.totalManualPayment).toLocaleString()} đ`);
    
    // Chỉ tính các đơn có doanh thu > 0
    const s4WithRevenue = await summary4.aggregate([
      { 
        $match: { 
          isActive: { $ne: false },
          paidToCompanyAmount: { $gt: 0 }
        } 
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          totalCost: { $sum: { $ifNull: ['$mustPayAmount', 0] } },
          totalManualPayment: { $sum: { $ifNull: ['$manualPaymentAmount', 0] } },
          totalRecords: { $sum: 1 }
        }
      }
    ]).toArray();
    
    const s4Rev = s4WithRevenue[0] || { totalRevenue: 0, totalCost: 0, totalManualPayment: 0, totalRecords: 0 };
    console.log(`\n📈 Summary4 with revenue > 0:`);
    console.log(`Total records: ${s4Rev.totalRecords}`);
    console.log(`Total revenue: ${s4Rev.totalRevenue.toLocaleString()} đ`);
    console.log(`Total cost: ${s4Rev.totalCost.toLocaleString()} đ`);
    console.log(`Total manual payment: ${s4Rev.totalManualPayment.toLocaleString()} đ`);
    console.log(`Calculated profit: ${(s4Rev.totalRevenue - s4Rev.totalCost - s4Rev.totalManualPayment).toLocaleString()} đ`);
    
    // Tổng doanh thu từ Summary5
    console.log('\n\n📊 Summary5 Revenue Analysis:\n');
    
    const s5Total = await summary5.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ['$revenue', 0] } },
          totalProfit: { $sum: { $ifNull: ['$profit', 0] } },
          totalAdCost: { $sum: { $ifNull: ['$adCost', 0] } },
          totalRecords: { $sum: 1 }
        }
      }
    ]).toArray();
    
    const s5 = s5Total[0] || { totalRevenue: 0, totalProfit: 0, totalAdCost: 0, totalRecords: 0 };
    console.log(`Total records: ${s5.totalRecords}`);
    console.log(`Total revenue: ${s5.totalRevenue.toLocaleString()} đ`);
    console.log(`Total profit: ${s5.totalProfit.toLocaleString()} đ`);
    console.log(`Total ad cost: ${s5.totalAdCost.toLocaleString()} đ`);
    
    // So sánh
    console.log('\n\n🔍 Comparison:\n');
    console.log(`Summary4 (with revenue > 0): ${s4Rev.totalRevenue.toLocaleString()} đ`);
    console.log(`Summary5 (aggregated):       ${s5.totalRevenue.toLocaleString()} đ`);
    console.log(`Difference:                  ${(s4Rev.totalRevenue - s5.totalRevenue).toLocaleString()} đ`);
    
    if (Math.abs(s4Rev.totalRevenue - s5.totalRevenue) < 1) {
      console.log('✅ Revenue matches! Logic is correct.');
    } else {
      console.log('⚠️  Revenue mismatch! Need to check aggregation logic.');
    }
    
    // Kiểm tra field mapping
    console.log('\n\n📋 Field Mapping Check:\n');
    console.log('Summary4 fields used:');
    console.log('  - paidToCompanyAmount → Summary5.revenue');
    console.log('  - mustPayAmount → used in profit calculation');
    console.log('  - manualPaymentAmount → used in profit calculation');
    console.log('\nSummary5 profit formula:');
    console.log('  profit = revenue - (mustPayAmount + manualPaymentAmount)');
    console.log('  profit = paidToCompanyAmount - (mustPayAmount + manualPaymentAmount)');
    
    // Sample records để xác nhận
    console.log('\n\n📝 Sample Summary5 records:\n');
    const samples = await summary5.find({}).limit(3).toArray();
    samples.forEach((rec, idx) => {
      console.log(`Record ${idx + 1}:`);
      console.log(`  orderDate: ${rec.orderDate}`);
      console.log(`  adGroupId: ${rec.adGroupId}`);
      console.log(`  productId: ${rec.productId}`);
      console.log(`  revenue: ${rec.revenue?.toLocaleString()} đ`);
      console.log(`  profit: ${rec.profit?.toLocaleString()} đ`);
      console.log(`  adCost: ${rec.adCost?.toLocaleString()} đ`);
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

checkRevenueLogic();
