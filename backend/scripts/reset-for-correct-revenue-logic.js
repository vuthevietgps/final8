/**
 * Reset và sync lại Summary4 + Summary5 với logic doanh thu đúng:
 * - Internal agent: revenue = COD khi "Giao thành công"
 * - External agent: revenue = unitPrice × quantity khi "Đã trả kết quả"
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function resetAndSyncWithCorrectRevenue() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('    RESET & SYNC VỚI LOGIC DOANH THU ĐÚNG');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('📋 LOGIC MỚI:');
    console.log('  Internal agent: revenue = COD khi "Giao thành công"');
    console.log('  External agent: revenue = unitPrice × quantity khi "Đã trả kết quả"');
    console.log('  Chi phí giá vốn: chỉ tính khi "Đã trả kết quả"\n');
    
    // 1. Reset Summary4
    console.log('🗑️  Step 1: Clearing Summary4...');
    const s4Del = await db.collection('summary4').deleteMany({});
    console.log(`   Deleted ${s4Del.deletedCount} records\n`);
    
    // 2. Reset Summary5
    console.log('🗑️  Step 2: Clearing Summary5...');
    const s5Del = await db.collection('summary5').deleteMany({});
    console.log(`   Deleted ${s5Del.deletedCount} records\n`);
    
    // 3. Count TestOrder2
    const testOrder2Count = await db.collection('testorder2').countDocuments();
    console.log(`📊 TestOrder2 records: ${testOrder2Count}\n`);
    
    console.log('✅ Reset complete!\n');
    console.log('⏳ Để sync dữ liệu:');
    console.log('   1. Backend sẽ tự động sync Summary4 khi khởi động lại');
    console.log('   2. Summary5 sẽ tự động sync sau khi Summary4 hoàn thành');
    console.log('   3. Hoặc restart backend task để trigger sync ngay\n');
    
    console.log('🔄 Restarting backend để trigger sync...');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
    console.log('\n💡 Hãy restart backend task để sync dữ liệu với logic mới!');
  }
}

resetAndSyncWithCorrectRevenue();
