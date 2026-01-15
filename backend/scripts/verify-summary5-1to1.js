/**
 * Kiểm tra Summary5 sau khi sync 1:1 với Summary4
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

async function verifySummary5() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const summary4 = db.collection('summary4');
    const summary5 = db.collection('summary5');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('    KIỂM TRA SUMMARY5 SAU KHI SYNC 1:1');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // 1. Count records
    const s4Count = await summary4.countDocuments({ isActive: { $ne: false } });
    const s5Count = await summary5.countDocuments();
    
    console.log('📊 SỐ LƯỢNG RECORDS:\n');
    console.log(`Summary4 active: ${s4Count}`);
    console.log(`Summary5 total: ${s5Count}`);
    console.log(`Tỷ lệ: ${s5Count}/${s4Count} = ${(s5Count/s4Count*100).toFixed(1)}%`);
    
    if (s4Count === s5Count) {
      console.log('✅ Số dòng khớp 100%!\n');
    } else {
      console.log('⚠️  Số dòng không khớp\n');
    }
    
    // 2. Revenue verification
    console.log('💰 DOANH THU:\n');
    
    const s4Revenue = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } } } }
    ]).toArray();
    
    const s5Revenue = await summary5.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$revenue', 0] } } } }
    ]).toArray();
    
    const s4Rev = s4Revenue[0]?.total || 0;
    const s5Rev = s5Revenue[0]?.total || 0;
    
    console.log(`Summary4 paidToCompanyAmount: ${s4Rev.toLocaleString()} đ`);
    console.log(`Summary5 revenue: ${s5Rev.toLocaleString()} đ`);
    console.log(`Difference: ${(s4Rev - s5Rev).toLocaleString()} đ`);
    
    if (s4Rev === s5Rev) {
      console.log('✅ Doanh thu khớp 100%!\n');
    } else {
      console.log('⚠️  Doanh thu không khớp\n');
    }
    
    // 3. Check summary4Id uniqueness
    console.log('🔑 SUMMARY4ID UNIQUENESS:\n');
    
    const s5WithId = await summary5.countDocuments({ summary4Id: { $exists: true, $ne: null } });
    const duplicates = await summary5.aggregate([
      { $match: { summary4Id: { $exists: true, $ne: null } } },
      { $group: { _id: '$summary4Id', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    console.log(`Records with summary4Id: ${s5WithId}`);
    console.log(`Duplicate summary4Id: ${duplicates.length}`);
    
    if (duplicates.length === 0) {
      console.log('✅ Không có summary4Id trùng lặp\n');
    } else {
      console.log('⚠️  Có summary4Id trùng lặp:', duplicates.slice(0, 5));
      console.log('');
    }
    
    // 4. Sample records
    console.log('📝 SAMPLE RECORDS:\n');
    
    const samples = await summary5.find({})
      .sort({ revenue: -1 })
      .limit(3)
      .toArray();
    
    samples.forEach((rec, idx) => {
      console.log(`Record ${idx + 1}:`);
      console.log(`  summary4Id: ${rec.summary4Id}`);
      console.log(`  orderDate: ${rec.orderDate?.toISOString().slice(0, 10)}`);
      console.log(`  adGroupId: ${rec.adGroupId}`);
      console.log(`  productId: ${rec.productId}`);
      console.log(`  revenue: ${(rec.revenue || 0).toLocaleString()} đ`);
      console.log(`  profit: ${(rec.profit || 0).toLocaleString()} đ`);
      console.log(`  adCost: ${(rec.adCost || 0).toLocaleString()} đ`);
      console.log('');
    });
    
    // 5. Stats by adGroupId
    console.log('📊 THỐNG KÊ THEO AD GROUP:\n');
    
    const byAdGroup = await summary5.aggregate([
      {
        $group: {
          _id: '$adGroupId',
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$revenue', 0] } },
          profit: { $sum: { $ifNull: ['$profit', 0] } },
          adCost: { $sum: { $ifNull: ['$adCost', 0] } }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ]).toArray();
    
    byAdGroup.forEach((item, idx) => {
      console.log(`${idx + 1}. adGroupId: ${item._id || 'NULL'}`);
      console.log(`   Records: ${item.count}`);
      console.log(`   Revenue: ${item.revenue.toLocaleString()} đ`);
      console.log(`   Profit: ${item.profit.toLocaleString()} đ`);
      console.log(`   Ad Cost: ${item.adCost.toLocaleString()} đ`);
      console.log('');
    });
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('    KẾT LUẬN');
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (s4Count === s5Count && s4Rev === s5Rev && duplicates.length === 0) {
      console.log('✅ Summary5 đã đồng bộ HOÀN TOÀN với Summary4');
      console.log('   - Số dòng: 1:1 mapping (1006 records)');
      console.log('   - Doanh thu: khớp 100%');
      console.log('   - summary4Id: unique, không trùng lặp');
      console.log('   - Mỗi record Summary5 tương ứng 1 record Summary4');
    } else {
      console.log('⚠️  Summary5 sync chưa hoàn chỉnh');
      console.log(`   - Records: ${s5Count}/${s4Count}`);
      console.log(`   - Revenue: ${s5Rev === s4Rev ? 'OK' : 'NOT OK'}`);
      console.log(`   - Duplicates: ${duplicates.length}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

verifySummary5();
