/*
Script to check actual data in MongoDB Atlas collections
*/
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

async function checkCollections() {
  try {
    console.log('🔍 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to:', mongoose.connection.db.databaseName);
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📂 Available collections:');
    collections.forEach(col => console.log('  -', col.name));
    
    // Check testorders2 specifically
    console.log('\n🔎 Checking testorders2 collection:');
    const testOrders2Col = mongoose.connection.collection('testorders2');
    const count = await testOrders2Col.countDocuments();
    console.log('  - Total documents:', count);
    
    if (count > 0) {
      console.log('\n📄 Sample documents:');
      const samples = await testOrders2Col.find({}).limit(3).toArray();
      samples.forEach((doc, i) => {
        console.log(`  Sample ${i + 1}:`, {
          _id: doc._id,
          customerName: doc.customerName,
          quantity: doc.quantity,
          agentId: doc.agentId,
          adGroupId: doc.adGroupId,
          isActive: doc.isActive,
          createdAt: doc.createdAt
        });
      });
      
      // Check for different variations of collection name
      console.log('\n🔍 Checking related collections:');
      const relatedCollections = ['test-order2', 'test_order2', 'testorder2', 'TestOrder2'];
      for (const colName of relatedCollections) {
        try {
          const col = mongoose.connection.collection(colName);
          const relatedCount = await col.countDocuments();
          if (relatedCount > 0) {
            console.log(`  - ${colName}: ${relatedCount} documents`);
          }
        } catch (err) {
          // Collection doesn't exist, skip
        }
      }
    }
    
    // Check products collection for Google Sheets sync
    console.log('\n📦 Checking products collection:');
    const productsCol = mongoose.connection.collection('products');
    const productCount = await productsCol.countDocuments();
    console.log('  - Total products:', productCount);
    
    if (productCount > 0) {
      const sampleProduct = await productsCol.findOne({});
      console.log('  - Sample product:', {
        _id: sampleProduct._id,
        name: sampleProduct.name,
        agentId: sampleProduct.agentId,
        categoryId: sampleProduct.categoryId
      });
    }
    
    // Check users (agents) collection
    console.log('\n👥 Checking users collection:');
    const usersCol = mongoose.connection.collection('users');
    const userCount = await usersCol.countDocuments();
    console.log('  - Total users:', userCount);
    
    const agents = await usersCol.find({ 
      role: { $in: ['internal_agent', 'external_agent'] } 
    }).limit(3).toArray();
    console.log('  - Sample agents:', agents.map(a => ({
      _id: a._id,
      fullName: a.fullName,
      role: a.role,
      email: a.email
    })));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkCollections();