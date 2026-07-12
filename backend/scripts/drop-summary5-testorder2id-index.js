/**
 * Script để xóa index testOrder2Id_1 không còn cần thiết trong collection summary5
 * Chạy: node scripts/drop-summary5-testorder2id-index.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function dropIndex() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('summary5');
    
    // Liệt kê các index hiện có
    const indexes = await collection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });
    
    // Kiểm tra xem index testOrder2Id_1 có tồn tại không
    const hasTestOrder2IdIndex = indexes.some(idx => idx.name === 'testOrder2Id_1');
    
    if (hasTestOrder2IdIndex) {
      console.log('\n🗑️  Dropping index testOrder2Id_1...');
      await collection.dropIndex('testOrder2Id_1');
      console.log('✅ Index testOrder2Id_1 dropped successfully');
    } else {
      console.log('\n⚠️  Index testOrder2Id_1 not found, skipping');
    }
    
    // Liệt kê lại các index sau khi xóa
    const indexesAfter = await collection.indexes();
    console.log('\n📋 Indexes after cleanup:');
    indexesAfter.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

dropIndex();
