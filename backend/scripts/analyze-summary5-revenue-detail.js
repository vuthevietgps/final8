/**
 * Script để phân tích chi tiết doanh thu trong Summary5
 * So sánh với Summary4 và kiểm tra từng bước aggregation
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

async function analyzeSummary5Revenue() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const summary4 = db.collection('summary4');
    const summary5 = db.collection('summary5');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('    PHÂN TÍCH CHI TIẾT DOANH THU SUMMARY5');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // 1. Tổng doanh thu từ Summary4
    console.log('📊 BƯỚC 1: Doanh thu từ Summary4\n');
    
    const s4Stats = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          recordsWithRevenue: {
            $sum: {
              $cond: [{ $gt: ['$paidToCompanyAmount', 0] }, 1, 0]
            }
          },
          recordsWithoutRevenue: {
            $sum: {
              $cond: [{ $lte: [{ $ifNull: ['$paidToCompanyAmount', 0] }, 0] }, 1, 0]
            }
          }
        }
      }
    ]).toArray();
    
    const s4 = s4Stats[0] || {};
    console.log(`Total Summary4 records: ${s4.totalRecords || 0}`);
    console.log(`Records với revenue > 0: ${s4.recordsWithRevenue || 0}`);
    console.log(`Records với revenue = 0: ${s4.recordsWithoutRevenue || 0}`);
    console.log(`Total revenue: ${(s4.totalRevenue || 0).toLocaleString()} đ\n`);
    
    // 2. Phân tích theo agent role
    console.log('👥 BƯỚC 2: Doanh thu theo loại đại lý\n');
    
    const byAgentRole = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $lookup: {
          from: 'users',
          localField: 'agentId',
          foreignField: '_id',
          as: 'agent'
        }
      },
      { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$agent.role',
          count: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          recordsWithRevenue: {
            $sum: {
              $cond: [{ $gt: ['$paidToCompanyAmount', 0] }, 1, 0]
            }
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]).toArray();
    
    byAgentRole.forEach(item => {
      console.log(`Role: ${item._id || 'NULL'}`);
      console.log(`  Total records: ${item.count}`);
      console.log(`  Records with revenue: ${item.recordsWithRevenue}`);
      console.log(`  Total revenue: ${item.totalRevenue.toLocaleString()} đ`);
      console.log('');
    });
    
    // 3. Kiểm tra logic doanh thu theo điều kiện
    console.log('🔍 BƯỚC 3: Doanh thu theo điều kiện ghi nhận\n');
    
    // Internal agent: orderStatus = "Giao thành công"
    const internalAgentRevenue = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $lookup: {
          from: 'users',
          localField: 'agentId',
          foreignField: '_id',
          as: 'agent'
        }
      },
      { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          'agent.role': 'internal_agent',
          orderStatus: 'Giao thành công'
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } }
        }
      }
    ]).toArray();
    
    const internalStats = internalAgentRevenue[0] || {};
    console.log('Internal Agent (orderStatus = "Giao thành công"):');
    console.log(`  Records: ${internalStats.count || 0}`);
    console.log(`  Revenue: ${(internalStats.totalRevenue || 0).toLocaleString()} đ\n`);
    
    // External agent: productionStatus = "Đã trả kết quả"
    const externalAgentRevenue = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $lookup: {
          from: 'users',
          localField: 'agentId',
          foreignField: '_id',
          as: 'agent'
        }
      },
      { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          'agent.role': { $ne: 'internal_agent' },
          productionStatus: 'Đã trả kết quả'
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } }
        }
      }
    ]).toArray();
    
    const externalStats = externalAgentRevenue[0] || {};
    console.log('External Agent (productionStatus = "Đã trả kết quả"):');
    console.log(`  Records: ${externalStats.count || 0}`);
    console.log(`  Revenue: ${(externalStats.totalRevenue || 0).toLocaleString()} đ\n`);
    
    // 4. Doanh thu trong Summary5
    console.log('📈 BƯỚC 4: Doanh thu trong Summary5\n');
    
    const s5Stats = await summary5.aggregate([
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$revenue', 0] } },
          totalProfit: { $sum: { $ifNull: ['$profit', 0] } },
          totalAdCost: { $sum: { $ifNull: ['$adCost', 0] } }
        }
      }
    ]).toArray();
    
    const s5 = s5Stats[0] || {};
    console.log(`Total Summary5 records: ${s5.totalRecords || 0}`);
    console.log(`Total revenue: ${(s5.totalRevenue || 0).toLocaleString()} đ`);
    console.log(`Total profit: ${(s5.totalProfit || 0).toLocaleString()} đ`);
    console.log(`Total adCost: ${(s5.totalAdCost || 0).toLocaleString()} đ\n`);
    
    // 5. So sánh
    console.log('⚖️  BƯỚC 5: So sánh Summary4 vs Summary5\n');
    
    console.log(`Summary4 total revenue: ${(s4.totalRevenue || 0).toLocaleString()} đ`);
    console.log(`Summary5 total revenue: ${(s5.totalRevenue || 0).toLocaleString()} đ`);
    
    const diff = (s4.totalRevenue || 0) - (s5.totalRevenue || 0);
    console.log(`Difference: ${diff.toLocaleString()} đ`);
    
    if (Math.abs(diff) < 1) {
      console.log('✅ Revenue khớp hoàn toàn!\n');
    } else {
      console.log('⚠️  Revenue không khớp! Cần kiểm tra aggregation.\n');
      
      // Tìm nguyên nhân
      console.log('🔎 Phân tích nguyên nhân:\n');
      
      // Kiểm tra records bị filter
      const filteredRecords = await summary4.countDocuments({
        isActive: { $ne: false },
        orderDate: { $not: { $type: 'date' } }
      });
      
      console.log(`Records với orderDate không phải Date: ${filteredRecords}`);
    }
    
    // 6. Sample records
    console.log('\n📝 SAMPLE RECORDS:\n');
    
    const s5Samples = await summary5.find({}).sort({ revenue: -1 }).limit(3).toArray();
    
    console.log('Top 3 Summary5 records by revenue:');
    s5Samples.forEach((rec, idx) => {
      console.log(`\nRecord ${idx + 1}:`);
      console.log(`  orderDate: ${rec.orderDate}`);
      console.log(`  adGroupId: ${rec.adGroupId}`);
      console.log(`  productId: ${rec.productId}`);
      console.log(`  revenue: ${(rec.revenue || 0).toLocaleString()} đ`);
      console.log(`  profit: ${(rec.profit || 0).toLocaleString()} đ`);
      console.log(`  adCost: ${(rec.adCost || 0).toLocaleString()} đ`);
    });
    
    // 7. Kết luận
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('    KẾT LUẬN');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('DOANH THU trong Summary5:');
    console.log('- Nguồn: Summary4.paidToCompanyAmount');
    console.log('- Logic ghi nhận:');
    console.log('  + Internal agent: khi orderStatus = "Giao thành công"');
    console.log('  + External agent: khi productionStatus = "Đã trả kết quả"');
    console.log('- Aggregation: SUM(paidToCompanyAmount) GROUP BY (adGroupId, productId, date)');
    console.log('- Filter: orderDate must be Date type');
    console.log('');
    console.log('CÔNG THỨC:');
    console.log('- revenue = paidToCompanyAmount (từ Summary4)');
    console.log('- profit = revenue - mustPayAmount - manualPaymentAmount');
    console.log('- adCost = spentAmount (từ AdvertisingCost)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

analyzeSummary5Revenue();
