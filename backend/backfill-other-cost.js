/**
 * Backfill script: Thêm dueDate và category cho các record OtherCost cũ
 * 
 * CFO v3.1 Rule:
 * - dueDate = date (ngày phát sinh = ngày phải trả)
 * - category = 'other' (default)
 * 
 * Chạy: node backfill-other-cost.js
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/final8';

async function backfill() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('othercosts');
    
    // Count records needing backfill
    const missingDueDate = await collection.countDocuments({ dueDate: { $exists: false } });
    const missingCategory = await collection.countDocuments({ category: { $exists: false } });
    
    console.log(`\n=== Backfill OtherCost ===`);
    console.log(`Records missing dueDate: ${missingDueDate}`);
    console.log(`Records missing category: ${missingCategory}`);
    
    if (missingDueDate === 0 && missingCategory === 0) {
      console.log('\n✅ No records need backfill. Done.');
      return;
    }
    
    // Backfill dueDate = date (CFO rule: ngày phát sinh = ngày phải trả)
    if (missingDueDate > 0) {
      console.log(`\nBackfilling dueDate for ${missingDueDate} records...`);
      
      const result = await collection.updateMany(
        { dueDate: { $exists: false } },
        [
          {
            $set: {
              dueDate: '$date', // dueDate = date
            }
          }
        ]
      );
      
      console.log(`✅ Updated ${result.modifiedCount} records with dueDate`);
    }
    
    // Backfill category = 'other'
    if (missingCategory > 0) {
      console.log(`\nBackfilling category for ${missingCategory} records...`);
      
      const result = await collection.updateMany(
        { category: { $exists: false } },
        { $set: { category: 'other' } }
      );
      
      console.log(`✅ Updated ${result.modifiedCount} records with category='other'`);
    }
    
    // Verify
    const stillMissingDueDate = await collection.countDocuments({ dueDate: { $exists: false } });
    const stillMissingCategory = await collection.countDocuments({ category: { $exists: false } });
    
    console.log(`\n=== Verification ===`);
    console.log(`Records still missing dueDate: ${stillMissingDueDate}`);
    console.log(`Records still missing category: ${stillMissingCategory}`);
    
    if (stillMissingDueDate === 0 && stillMissingCategory === 0) {
      console.log('\n✅ Backfill completed successfully!');
    } else {
      console.log('\n⚠️ Some records still need attention.');
    }
    
  } catch (error) {
    console.error('Error during backfill:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

backfill();
