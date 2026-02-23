/**
 * Script: Tạo index cho collection ad_group_daily_reports
 * Chạy một lần để tạo indexes tối ưu cho collection mới
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/management';

async function createIndexes() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Đã kết nối MongoDB');

    const db = client.db();
    const collection = db.collection('ad_group_daily_reports');

    // Drop existing indexes (ngoại trừ _id)
    console.log('🔄 Xóa indexes cũ...');
    await collection.dropIndexes().catch(() => {
      console.log('⚠️  Chưa có indexes để xóa');
    });

    // Tạo compound index chính (unique)
    console.log('📊 Tạo compound index (date + adGroupId)...');
    await collection.createIndex(
      { date: 1, adGroupId: 1 },
      { unique: true, name: 'idx_date_adgroup' }
    );

    // Index cho filter theo date + platform
    console.log('📊 Tạo index (date + platform)...');
    await collection.createIndex(
      { date: 1, platform: 1 },
      { name: 'idx_date_platform' }
    );

    // Index cho query theo adGroupId
    console.log('📊 Tạo index (adGroupId + date desc)...');
    await collection.createIndex(
      { adGroupId: 1, date: -1 },
      { name: 'idx_adgroup_date' }
    );

    // Index cho sort theo totalProfit
    console.log('📊 Tạo index (date + totalProfit)...');
    await collection.createIndex(
      { date: 1, totalProfit: -1 },
      { name: 'idx_date_profit' }
    );

    console.log('✅ Tạo indexes thành công!');

    // Hiển thị danh sách indexes
    const indexes = await collection.listIndexes().toArray();
    console.log('\n📋 Danh sách indexes:');
    indexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Kiểm tra số lượng documents
    const count = await collection.countDocuments();
    console.log(`\n📊 Số lượng documents hiện tại: ${count}`);

  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔒 Đã đóng kết nối MongoDB');
  }
}

createIndexes();
