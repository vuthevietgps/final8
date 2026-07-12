/**
 * Script migrate các orderStatus cũ sang trạng thái chuẩn
 * 
 * Mapping:
 * - "delivered" → "Giao thành công"
 * - "processing" → "Đang giao"
 * - "pending" → "Chưa có mã vận đơn"
 * - "thanh_cong" → "Giao thành công"
 * - Các giá trị không chuẩn khác → giữ nguyên và log ra
 * 
 * Chạy: npx ts-node scripts/migrate-order-statuses.ts
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGODB_URI;

// Mapping từ trạng thái cũ sang trạng thái chuẩn
const STATUS_MAPPING: Record<string, string> = {
  // English -> Vietnamese
  'delivered': 'Giao thành công',
  'Delivered': 'Giao thành công',
  'DELIVERED': 'Giao thành công',
  'processing': 'Đang giao',
  'Processing': 'Đang giao',
  'PROCESSING': 'Đang giao',
  'pending': 'Chưa có mã vận đơn',
  'Pending': 'Chưa có mã vận đơn',
  'PENDING': 'Chưa có mã vận đơn',
  'shipping': 'Đang giao',
  'Shipping': 'Đang giao',
  'SHIPPING': 'Đang giao',
  'returned': 'Hàng hoàn',
  'Returned': 'Hàng hoàn',
  'RETURNED': 'Hàng hoàn',
  
  // Others
  'thanh_cong': 'Giao thành công',
  'Thanh_cong': 'Giao thành công',
  'THANH_CONG': 'Giao thành công',
  'thanhcong': 'Giao thành công',
  'da_giao': 'Giao thành công',
  'đã giao': 'Giao thành công',
  'Đã giao': 'Giao thành công',
  'hoan': 'Hàng hoàn',
  'Hoàn': 'Hàng hoàn',
  'Hoàn Hàng': 'Hàng hoàn',
  'Đã hoàn': 'Hàng hoàn',
  
  // Old Vietnamese variants
  'Chưa Có Mã Vận Đơn': 'Chưa có mã vận đơn',
  'Đang vận chuyển': 'Đang giao',
  'Đang giao hàng': 'Đang giao',
};

// Các trạng thái chuẩn (không cần migrate)
const STANDARD_STATUSES = [
  'Chưa có mã vận đơn',
  'Đang giao',
  'Giao thành công',
  'Hàng hoàn',
];

async function migrate() {
  console.log('🚀 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected!\n');

  const db = mongoose.connection.db;
  const ordersCollection = db!.collection('ordertest2');

  // 1. Lấy tất cả distinct orderStatus
  console.log('📊 Scanning all orderStatus values...\n');
  const distinctStatuses = await ordersCollection.distinct('orderStatus');
  console.log('Found orderStatus values:', distinctStatuses);
  console.log('');

  // 2. Phân loại
  const standardStatuses: string[] = [];
  const toMigrate: { from: string; to: string }[] = [];
  const unknown: string[] = [];

  for (const status of distinctStatuses) {
    if (!status || status === '') continue;
    
    if (STANDARD_STATUSES.includes(status)) {
      standardStatuses.push(status);
    } else if (STATUS_MAPPING[status]) {
      toMigrate.push({ from: status, to: STATUS_MAPPING[status] });
    } else {
      unknown.push(status);
    }
  }

  console.log('✅ Standard statuses (no change needed):', standardStatuses);
  console.log('🔄 To migrate:', toMigrate);
  console.log('❓ Unknown (need manual review):', unknown);
  console.log('');

  // 3. Migrate
  let totalMigrated = 0;
  for (const { from, to } of toMigrate) {
    const count = await ordersCollection.countDocuments({ orderStatus: from });
    if (count > 0) {
      console.log(`  Migrating "${from}" → "${to}" (${count} orders)...`);
      const result = await ordersCollection.updateMany(
        { orderStatus: from },
        { $set: { orderStatus: to } }
      );
      totalMigrated += result.modifiedCount;
      console.log(`    ✅ Updated ${result.modifiedCount} orders`);
    }
  }

  console.log(`\n🎉 Migration complete! Total migrated: ${totalMigrated} orders`);

  // 4. Show unknown statuses that need manual review
  if (unknown.length > 0) {
    console.log('\n⚠️  Unknown statuses need manual review:');
    for (const status of unknown) {
      const count = await ordersCollection.countDocuments({ orderStatus: status });
      console.log(`   - "${status}" (${count} orders)`);
    }
    console.log('\nAdd mappings to STATUS_MAPPING and run again, or update manually.');
  }

  // 5. Show final stats
  console.log('\n📊 Final orderStatus distribution:');
  const finalStats = await ordersCollection.aggregate([
    { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  for (const stat of finalStats) {
    const isStandard = STANDARD_STATUSES.includes(stat._id);
    console.log(`   ${isStandard ? '✅' : '❌'} "${stat._id}": ${stat.count} orders`);
  }

  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
