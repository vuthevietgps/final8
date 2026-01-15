/**
 * Script để reset và sync lại Summary4 và Summary5 với logic doanh thu mới
 */

const axios = require('axios');

async function resetAndSync() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';
  
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    // 1. Xóa Summary4
    console.log('🗑️  Deleting Summary4...');
    const s4Result = await db.collection('summary4').deleteMany({});
    console.log(`   Deleted ${s4Result.deletedCount} Summary4 records\n`);
    
    // 2. Xóa Summary5
    console.log('🗑️  Deleting Summary5...');
    const s5Result = await db.collection('summary5').deleteMany({});
    console.log(`   Deleted ${s5Result.deletedCount} Summary5 records\n`);
    
    await client.close();
    
    // 3. Trigger Summary4 sync (sẽ tự động trigger Summary5)
    console.log('🔄 Triggering Summary4 sync (will auto-trigger Summary5)...');
    console.log('   Please manually call: POST http://localhost:3000/api/summary4/sync');
    console.log('   Or restart backend to trigger auto-sync\n');
    
    console.log('✅ Reset completed! Backend will sync on next startup.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetAndSync();
