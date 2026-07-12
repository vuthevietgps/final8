const mongoose = require('mongoose');

async function analyzeSummary4Logic() {
  try {
    const MONGO_URI = process.env.MONGODB_URI;
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    console.log('🔍 Analyzing Summary4 data structure and business logic...\n');
    
    // 1. Check all fields in Summary4
    const summary4Col = mongoose.connection.collection('summary4');
    const sampleDoc = await summary4Col.findOne({});
    console.log('📋 Summary4 document structure:');
    console.log('Fields:', Object.keys(sampleDoc));
    console.log('Sample document:', JSON.stringify(sampleDoc, null, 2));
    
    // 2. Analyze field usage patterns
    console.log('\n📊 Field analysis:');
    const fieldAnalysis = await summary4Col.aggregate([
      {
        $group: {
          _id: null,
          totalDocs: { $sum: 1 },
          docsWithMustPay: { $sum: { $cond: [{ $ne: ['$mustPayAmount', null] }, 1, 0] } },
          docsWithPaidToCompany: { $sum: { $cond: [{ $ne: ['$paidToCompanyAmount', null] }, 1, 0] } },
          docsWithManualPayment: { $sum: { $cond: [{ $ne: ['$manualPaymentAmount', null] }, 1, 0] } }
        }
      }
    ]);
    console.log('Analysis result:', fieldAnalysis[0]);
    
    // 3. Check relationships with TestOrder2
    console.log('\n🔗 Checking relationship with TestOrder2...');
    const relationshipCheck = await summary4Col.aggregate([
      {
        $lookup: {
          from: 'ordertest2',
          localField: 'testOrder2Id', 
          foreignField: '_id',
          as: 'orderData'
        }
      },
      {
        $group: {
          _id: null,
          totalSummary4: { $sum: 1 },
          withMatchingOrder: { $sum: { $cond: [{ $gt: [{ $size: '$orderData' }, 0] }, 1, 0] } },
          withoutMatchingOrder: { $sum: { $cond: [{ $eq: [{ $size: '$orderData' }, 0] }, 1, 0] } }
        }
      }
    ]);
    console.log('Relationship analysis:', relationshipCheck[0]);
    
    // 4. Check if there are TestOrder2 records not in Summary4
    console.log('\n🔄 Checking TestOrder2 -> Summary4 sync status...');
    const testOrder2Col = mongoose.connection.collection('ordertest2');
    const totalOrders = await testOrder2Col.countDocuments();
    const totalSummary4 = await summary4Col.countDocuments();
    
    console.log(`Total TestOrder2 records: ${totalOrders}`);
    console.log(`Total Summary4 records: ${totalSummary4}`);
    console.log(`Sync ratio: ${((totalSummary4 / totalOrders) * 100).toFixed(2)}%`);
    
    // 5. Sample calculation logic detection
    console.log('\n💰 Detecting calculation patterns...');
    const calcSamples = await summary4Col.find({ 
      mustPayAmount: { $exists: true, $ne: null },
      paidToCompanyAmount: { $exists: true, $ne: null }
    }).limit(5).toArray();
    
    console.log('Sample records with calculations:');
    calcSamples.forEach((doc, i) => {
      console.log(`Sample ${i + 1}:`, {
        testOrder2Id: doc.testOrder2Id,
        mustPayAmount: doc.mustPayAmount,
        paidToCompanyAmount: doc.paidToCompanyAmount,
        manualPaymentAmount: doc.manualPaymentAmount,
        difference: (doc.mustPayAmount || 0) - (doc.paidToCompanyAmount || 0) - (doc.manualPaymentAmount || 0)
      });
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

analyzeSummary4Logic();
