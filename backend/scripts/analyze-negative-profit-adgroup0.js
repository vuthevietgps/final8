/**
 * Phân tích nguyên nhân lợi nhuận âm trong nhóm quảng cáo 0
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function analyzeNegativeProfit() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const summary5 = db.collection('summary5');
    const summary4 = db.collection('summary4');
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('    PHÂN TÍCH LỢI NHUẬN ÂM - NHÓM QC 0');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // 1. Tìm các records lợi nhuận âm trong Summary5
    console.log('📊 SUMMARY5 - RECORDS LỢI NHUẬN ÂM (adGroupId=0):\n');
    
    const negativeRecords = await summary5.find({
      adGroupId: '0',
      profit: { $lt: 0 }
    })
    .sort({ profit: 1 })
    .limit(10)
    .toArray();
    
    console.log(`Tìm thấy ${negativeRecords.length} records với lợi nhuận âm (top 10)\n`);
    
    for (const rec of negativeRecords) {
      console.log(`─────────────────────────────────────────────────────`);
      console.log(`Summary5 ID: ${rec._id}`);
      console.log(`Summary4 ID: ${rec.summary4Id}`);
      console.log(`Date: ${rec.orderDate?.toISOString().slice(0, 10)}`);
      console.log(`Revenue: ${(rec.revenue || 0).toLocaleString()} đ`);
      console.log(`Profit: ${(rec.profit || 0).toLocaleString()} đ`);
      console.log(`Ad Cost: ${(rec.adCost || 0).toLocaleString()} đ`);
      
      // Tìm Summary4 tương ứng
      if (rec.summary4Id) {
        const { ObjectId } = require('mongodb');
        const s4 = await summary4.findOne({ _id: new ObjectId(rec.summary4Id) });
        
        if (s4) {
          console.log(`\n📋 Summary4 Details:`);
          console.log(`  paidToCompanyAmount: ${(s4.paidToCompanyAmount || 0).toLocaleString()} đ`);
          console.log(`  mustPayAmount: ${(s4.mustPayAmount || 0).toLocaleString()} đ`);
          console.log(`  manualPaymentAmount: ${(s4.manualPaymentAmount || 0).toLocaleString()} đ`);
          console.log(`  orderStatus: ${s4.orderStatus || 'N/A'}`);
          console.log(`  productionStatus: ${s4.productionStatus || 'N/A'}`);
          
          // Populate agent info
          const user = await db.collection('users').findOne({ _id: s4.agentId });
          console.log(`  agentRole: ${user?.role || 'N/A'}`);
          
          // Tính toán
          const calculatedRevenue = s4.paidToCompanyAmount || 0;
          const calculatedProfit = calculatedRevenue - (s4.mustPayAmount || 0) - (s4.manualPaymentAmount || 0);
          
          console.log(`\n🔢 Calculation:`);
          console.log(`  Revenue = paidToCompanyAmount = ${calculatedRevenue.toLocaleString()} đ`);
          console.log(`  Profit = revenue - mustPayAmount - manualPaymentAmount`);
          console.log(`  Profit = ${calculatedRevenue.toLocaleString()} - ${(s4.mustPayAmount || 0).toLocaleString()} - ${(s4.manualPaymentAmount || 0).toLocaleString()}`);
          console.log(`  Profit = ${calculatedProfit.toLocaleString()} đ`);
          
          // Kiểm tra logic
          console.log(`\n⚠️  Phân tích:`);
          
          if (calculatedRevenue === 0) {
            console.log(`  ❌ Revenue = 0 nhưng có chi phí`);
            
            if (user?.role === 'internal_agent') {
              console.log(`  → Internal agent: chưa "Giao thành công"`);
              console.log(`     Current status: ${s4.orderStatus}`);
            } else {
              console.log(`  → External agent: chưa "Đã trả kết quả"`);
              console.log(`     Current status: ${s4.productionStatus}`);
            }
          }
          
          if ((s4.mustPayAmount || 0) > 0) {
            console.log(`  → Có chi phí giá vốn: ${(s4.mustPayAmount || 0).toLocaleString()} đ`);
          }
          
          if ((s4.manualPaymentAmount || 0) > 0) {
            console.log(`  → Có chi phí thủ công: ${(s4.manualPaymentAmount || 0).toLocaleString()} đ`);
          }
        }
      }
      
      console.log('');
    }
    
    // 2. Thống kê tổng quan
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('    THỐNG KÊ TỔNG QUAN');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const stats = await summary5.aggregate([
      { $match: { adGroupId: '0' } },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          negativeProfit: {
            $sum: {
              $cond: [{ $lt: ['$profit', 0] }, 1, 0]
            }
          },
          positiveProfit: {
            $sum: {
              $cond: [{ $gte: ['$profit', 0] }, 1, 0]
            }
          },
          totalRevenue: { $sum: { $ifNull: ['$revenue', 0] } },
          totalProfit: { $sum: { $ifNull: ['$profit', 0] } },
          revenueZero: {
            $sum: {
              $cond: [{ $eq: ['$revenue', 0] }, 1, 0]
            }
          }
        }
      }
    ]).toArray();
    
    const s = stats[0] || {};
    
    console.log(`Total records (adGroupId=0): ${s.totalRecords || 0}`);
    console.log(`Records lợi nhuận âm: ${s.negativeProfit || 0} (${((s.negativeProfit || 0) / (s.totalRecords || 1) * 100).toFixed(1)}%)`);
    console.log(`Records lợi nhuận dương: ${s.positiveProfit || 0} (${((s.positiveProfit || 0) / (s.totalRecords || 1) * 100).toFixed(1)}%)`);
    console.log(`Records revenue = 0: ${s.revenueZero || 0} (${((s.revenueZero || 0) / (s.totalRecords || 1) * 100).toFixed(1)}%)`);
    console.log(`Total revenue: ${(s.totalRevenue || 0).toLocaleString()} đ`);
    console.log(`Total profit: ${(s.totalProfit || 0).toLocaleString()} đ`);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('    KẾT LUẬN');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('💡 NGUYÊN NHÂN LỢI NHUẬN ÂM:');
    console.log('');
    console.log('1. ĐƠN HÀNG CHƯA HOÀN THÀNH:');
    console.log('   - Internal agent: orderStatus ≠ "Giao thành công"');
    console.log('   - External agent: productionStatus ≠ "Đã trả kết quả"');
    console.log('   → Revenue = 0 nhưng đã có chi phí (mustPayAmount, manualPaymentAmount)');
    console.log('');
    console.log('2. CHI PHÍ VẪN ĐƯỢC GHI NHẬN:');
    console.log('   - mustPayAmount (giá vốn) được tính ngay khi sản xuất xong');
    console.log('   - manualPaymentAmount (chi phí khác) được nhập thủ công');
    console.log('   → Profit = 0 - mustPayAmount - manualPaymentAmount < 0');
    console.log('');
    console.log('💡 GIẢI PHÁP:');
    console.log('');
    console.log('Option 1: LOẠI BỎ ĐơN CHƯA HOÀN THÀNH');
    console.log('   - Chỉ sync Summary5 khi có revenue > 0');
    console.log('   - Ưu: Báo cáo sạch, chỉ đơn có doanh thu');
    console.log('   - Nhược: Mất thông tin đơn đang xử lý');
    console.log('');
    console.log('Option 2: GIỮ TẤT CẢ, HIỂN THỊ RÕ RÀNG');
    console.log('   - Giữ nguyên tất cả records');
    console.log('   - Frontend hiển thị status rõ ràng');
    console.log('   - Báo cáo có filter theo trạng thái');
    console.log('   - Ưu: Đầy đủ thông tin, tracking tốt');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

analyzeNegativeProfit();
