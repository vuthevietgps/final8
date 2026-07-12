/**
 * Script để phân tích dữ liệu Summary4 và tìm lý do tại sao không đồng bộ sang Summary5
 * Chạy: node scripts/analyze-summary4-for-summary5.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function analyze() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    const summary4 = db.collection('summary4');
    
    // Tổng số bản ghi Summary4
    const totalRecords = await summary4.countDocuments();
    console.log(`📊 Total Summary4 records: ${totalRecords}`);
    
    // Bản ghi active
    const activeRecords = await summary4.countDocuments({ isActive: { $ne: false } });
    console.log(`✅ Active records (isActive != false): ${activeRecords}`);
    
    // Bản ghi có adGroupId
    const withAdGroupId = await summary4.countDocuments({ 
      isActive: { $ne: false },
      adGroupId: { $exists: true, $ne: null }
    });
    console.log(`🎯 Active with adGroupId: ${withAdGroupId}`);
    
    // Bản ghi có orderDate type = date
    const withDateType = await summary4.countDocuments({ 
      isActive: { $ne: false },
      adGroupId: { $exists: true, $ne: null },
      orderDate: { $type: 'date' }
    });
    console.log(`📅 Active with adGroupId + orderDate is Date: ${withDateType}`);
    
    // Phân tích các bản ghi bị loại bỏ
    console.log('\n🔍 Analysis of filtered records:\n');
    
    // Không có adGroupId
    const noAdGroupId = await summary4.countDocuments({ 
      isActive: { $ne: false },
      $or: [
        { adGroupId: { $exists: false } },
        { adGroupId: null },
        { adGroupId: '' }
      ]
    });
    console.log(`❌ Missing/null/empty adGroupId: ${noAdGroupId}`);
    
    // orderDate không phải Date type
    const wrongDateType = await summary4.countDocuments({ 
      isActive: { $ne: false },
      adGroupId: { $exists: true, $ne: null },
      orderDate: { $not: { $type: 'date' } }
    });
    console.log(`❌ orderDate not Date type: ${wrongDateType}`);
    
    // Mẫu các bản ghi không có adGroupId
    console.log('\n📋 Sample records without adGroupId:');
    const samplesNoAdGroup = await summary4.find({ 
      isActive: { $ne: false },
      $or: [
        { adGroupId: { $exists: false } },
        { adGroupId: null },
        { adGroupId: '' }
      ]
    }).limit(3).toArray();
    
    samplesNoAdGroup.forEach((rec, idx) => {
      console.log(`\nRecord ${idx + 1}:`);
      console.log(`  _id: ${rec._id}`);
      console.log(`  orderDate: ${rec.orderDate} (type: ${typeof rec.orderDate})`);
      console.log(`  adGroupId: ${rec.adGroupId}`);
      console.log(`  productId: ${typeof rec.productId === 'object' ? JSON.stringify(rec.productId) : rec.productId}`);
      console.log(`  revenue: ${rec.paidToCompanyAmount || 0}`);
    });
    
    // Mẫu các bản ghi có orderDate không phải Date
    console.log('\n📋 Sample records with wrong orderDate type:');
    const samplesWrongDate = await summary4.find({ 
      isActive: { $ne: false },
      adGroupId: { $exists: true, $ne: null },
      orderDate: { $not: { $type: 'date' } }
    }).limit(3).toArray();
    
    samplesWrongDate.forEach((rec, idx) => {
      console.log(`\nRecord ${idx + 1}:`);
      console.log(`  _id: ${rec._id}`);
      console.log(`  orderDate: ${rec.orderDate} (type: ${typeof rec.orderDate})`);
      console.log(`  adGroupId: ${rec.adGroupId}`);
      console.log(`  productId: ${typeof rec.productId === 'object' ? JSON.stringify(rec.productId) : rec.productId}`);
    });
    
    // Kiểm tra productId types
    console.log('\n📦 ProductId type analysis:');
    const productIdTypes = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $project: {
          productIdType: { $type: '$productId' }
        }
      },
      {
        $group: {
          _id: '$productIdType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    productIdTypes.forEach(t => {
      console.log(`  ${t._id}: ${t.count} records`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

analyze();
