/*
Check the 'ordertest2' collection - this might be the real data collection
*/
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI;

async function checkOrderTest2() {
  try {
    console.log('🔍 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to:', mongoose.connection.db.databaseName);
    
    // Check ordertest2 collection
    console.log('\n🔎 Checking ordertest2 collection:');
    const orderTest2Col = mongoose.connection.collection('ordertest2');
    const count = await orderTest2Col.countDocuments();
    console.log('  - Total documents:', count);
    
    if (count > 0) {
      console.log('\n📄 Sample documents from ordertest2:');
      const samples = await orderTest2Col.find({}).limit(5).toArray();
      samples.forEach((doc, i) => {
        console.log(`\n  Sample ${i + 1}:`, {
          _id: doc._id,
          customerName: doc.customerName,
          quantity: doc.quantity,
          price: doc.price,
          agentId: doc.agentId,
          adGroupId: doc.adGroupId,
          trackingNumber: doc.trackingNumber,
          orderDate: doc.orderDate,
          deliveryStatus: doc.deliveryStatus,
          isActive: doc.isActive,
          createdAt: doc.createdAt,
          // Show all fields to understand structure
          allFields: Object.keys(doc)
        });
      });
      
      // Check distinct values to understand data patterns
      console.log('\n📊 Data analysis:');
      const distinctAgents = await orderTest2Col.distinct('agentId');
      console.log('  - Distinct agentIds:', distinctAgents.length);
      
      const distinctAdGroups = await orderTest2Col.distinct('adGroupId');
      console.log('  - Distinct adGroupIds:', distinctAdGroups.length);
      
      const activeCount = await orderTest2Col.countDocuments({ isActive: true });
      const inactiveCount = await orderTest2Col.countDocuments({ isActive: false });
      console.log('  - Active orders:', activeCount);
      console.log('  - Inactive orders:', inactiveCount);
    }
    
    // Also check testorders (without 2)
    console.log('\n🔎 Checking testorders collection:');
    const testOrdersCol = mongoose.connection.collection('testorders');
    const testOrdersCount = await testOrdersCol.countDocuments();
    console.log('  - Total testorders documents:', testOrdersCount);
    
    if (testOrdersCount > 0) {
      const testSample = await testOrdersCol.findOne({});
      console.log('  - Sample testorders document keys:', Object.keys(testSample));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkOrderTest2();
