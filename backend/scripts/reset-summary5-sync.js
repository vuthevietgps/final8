/**
 * Script để xóa toàn bộ dữ liệu Summary5 và trigger sync lại
 * Chạy: node scripts/reset-summary5-sync.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function reset() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const summary5 = db.collection('summary5');
    
    // Đếm số record hiện tại
    const currentCount = await summary5.countDocuments();
    console.log(`📊 Current Summary5 records: ${currentCount}`);
    
    if (currentCount > 0) {
      console.log('\n🗑️  Deleting all Summary5 records...');
      const result = await summary5.deleteMany({});
      console.log(`✅ Deleted ${result.deletedCount} records`);
    } else {
      console.log('\n⚠️  Summary5 is already empty');
    }
    
    console.log('\n✨ Summary5 has been reset');
    console.log('📤 Please call POST /api/summary5/sync to regenerate data');
    console.log('   Or wait for Summary4 sync to auto-trigger Summary5 sync');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

reset();
