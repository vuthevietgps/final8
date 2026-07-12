/**
 * Script để reset Summary5 và sync lại với logic 1:1 mapping với Summary4
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function resetAndSync() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const summary5 = db.collection('summary5');
    
    // 1. Drop collection để reset indexes
    console.log('🗑️  Dropping Summary5 collection...');
    try {
      await summary5.drop();
      console.log('✅ Collection dropped\n');
    } catch (err) {
      if (err.code === 26) {
        console.log('ℹ️  Collection does not exist, skipping drop\n');
      } else {
        throw err;
      }
    }
    
    // 2. Recreate collection with new indexes
    console.log('📝 Creating Summary5 collection with indexes...');
    await db.createCollection('summary5');
    
    await summary5.createIndex({ summary4Id: 1 }, { unique: true, sparse: true });
    await summary5.createIndex({ orderDate: 1 });
    await summary5.createIndex({ adGroupId: 1, orderDate: 1 });
    await summary5.createIndex({ productId: 1, orderDate: 1 });
    
    console.log('✅ Collection and indexes created\n');
    
    // 3. Count Summary4 records
    const summary4Count = await db.collection('summary4').countDocuments({ isActive: { $ne: false } });
    console.log(`📊 Summary4 active records: ${summary4Count}\n`);
    
    console.log('✅ Reset complete. Backend sẽ tự động sync khi khởi động lại.');
    console.log('   Hoặc gọi API: POST http://localhost:3000/summary5/sync');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

resetAndSync();
