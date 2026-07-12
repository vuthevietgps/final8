/**
 * Script: Check Capital Allocation Policy in Database
 * Purpose: Verify policy exists and show details
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function checkPolicy() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log('URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // List all collections
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('📂 Collections in database:');
    collections.forEach(col => console.log('  -', col.name));
    console.log('');

    // Check for policy collection
    const policyCollection = collections.find(c => 
      c.name.toLowerCase().includes('capital') || 
      c.name.toLowerCase().includes('allocation')
    );

    if (policyCollection) {
      console.log('✅ Found policy collection:', policyCollection.name);
      
      // Query policies
      const policiesRaw = await db.collection(policyCollection.name).find({}).toArray();
      console.log('\n📊 Policies found:', policiesRaw.length);
      
      policiesRaw.forEach((policy, i) => {
        console.log(`\n  Policy ${i + 1}:`);
        console.log('    ID:', policy._id);
        console.log('    Name:', policy.name);
        console.log('    Active:', policy.isActive);
        console.log('    Reinvestment:', policy.reinvestmentRatio + '%');
        console.log('    Safety:', policy.safetyReserveRatio + '%');
        console.log('    Personal:', policy.personalIncomeRatio + '%');
        console.log('    LongTerm:', policy.longTermAssetRatio + '%');
      });
    } else {
      console.log('❌ No capital allocation policy collection found');
      console.log('\n💡 Try creating policy first with:');
      console.log('   node create-default-capital-policy.js');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkPolicy()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
