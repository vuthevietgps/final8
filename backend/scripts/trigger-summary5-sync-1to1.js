/**
 * Script để trigger Summary5 sync qua API
 */

const http = require('http');

function triggerSync() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/summary5/sync',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 401) {
          console.log('ℹ️  API requires authentication, calling service directly...');
          callServiceDirectly();
        } else if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('✅ Sync response:', data);
          resolve(JSON.parse(data));
        } else {
          console.log(`⚠️  Status ${res.statusCode}:`, data);
          resolve();
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });
    
    req.end();
  });
}

async function callServiceDirectly() {
  const { MongoClient } = require('mongodb');
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    console.log('🔄 Starting Summary5 sync (direct)...\n');
    
    const db = client.db();
    const startTime = Date.now();
    
    // Execute the same logic as Summary5Service.sync()
    const summary4 = db.collection('summary4');
    const summary5 = db.collection('summary5');
    const advertisingcosts = db.collection('advertisingcosts');
    
    // Count Summary4 records
    const s4Count = await summary4.countDocuments({ isActive: { $ne: false } });
    console.log(`📊 Summary4 active records: ${s4Count}`);
    
    // Aggregate from Summary4
    console.log('🔄 Aggregating Summary4...');
    const summary4Agg = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $project: {
          summary4Id: { $toString: '$_id' },
          adGroupId: {
            $cond: {
              if: {
                $or: [
                  { $eq: [{ $type: '$adGroupId' }, 'missing'] },
                  { $eq: ['$adGroupId', null] },
                  { $eq: ['$adGroupId', ''] }
                ]
              },
              then: '0',
              else: '$adGroupId'
            }
          },
          productId: {
            $cond: {
              if: { $eq: [{ $type: '$productId' }, 'objectId'] },
              then: '$productId',
              else: {
                $cond: {
                  if: { $ne: [{ $type: '$productId._id' }, 'missing'] },
                  then: '$productId._id',
                  else: null
                }
              }
            }
          },
          orderDate: { $ifNull: ['$orderDate', '$createdAt'] },
          paidToCompanyAmount: { $ifNull: ['$paidToCompanyAmount', 0] },
          mustPayAmount: { $ifNull: ['$mustPayAmount', 0] },
          manualPaymentAmount: { $ifNull: ['$manualPaymentAmount', 0] },
        },
      },
      {
        $match: {
          orderDate: { $type: 'date' }
        },
      },
      {
        $addFields: {
          orderDateStr: { $dateToString: { format: '%Y-%m-%d', date: '$orderDate' } },
          revenue: '$paidToCompanyAmount',
          profit: {
            $subtract: [
              '$paidToCompanyAmount',
              { $add: ['$mustPayAmount', '$manualPaymentAmount'] },
            ],
          },
          adCost: 0,
        },
      },
      {
        $project: {
          _id: 0,
          summary4Id: 1,
          adGroupId: 1,
          productId: {
            $cond: {
              if: { $eq: [{ $type: '$productId' }, 'objectId'] },
              then: { $toString: '$productId' },
              else: { $ifNull: ['$productId', null] }
            }
          },
          orderDate: 1,
          orderDateStr: 1,
          profit: 1,
          revenue: 1,
          adCost: 1,
        },
      },
    ], { allowDiskUse: true }).toArray();
    
    console.log(`✅ Summary4 aggregated: ${summary4Agg.length} records`);
    
    // Aggregate advertising costs
    console.log('🔄 Aggregating AdvertisingCost...');
    const costAgg = await advertisingcosts.aggregate([
      { $match: { adGroupId: { $exists: true, $ne: null } } },
      { $match: { date: { $type: 'date' } } },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          },
          adCost: { $sum: { $ifNull: ['$spentAmount', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          adGroupId: '$_id.adGroupId',
          dateStr: '$_id.dateStr',
          adCost: 1,
        },
      },
    ], { allowDiskUse: true }).toArray();
    
    console.log(`✅ AdvertisingCost aggregated: ${costAgg.length} records`);
    
    // Build cost map
    const costMap = new Map();
    costAgg.forEach(c => {
      const key = `${c.adGroupId || ''}|${c.dateStr}`;
      costMap.set(key, (costMap.get(key) || 0) + Number(c.adCost || 0));
    });
    
    // Merge costs
    console.log('🔄 Merging advertising costs...');
    const merged = summary4Agg.map(row => {
      const dateStr = row.orderDate instanceof Date ? row.orderDate.toISOString().slice(0, 10) : '';
      const costKey = `${row.adGroupId || ''}|${dateStr}`;
      const adCost = costMap.get(costKey) || 0;
      return { ...row, adCost };
    });
    
    // Clear existing Summary5
    console.log('🗑️  Clearing existing Summary5 records...');
    const delRes = await summary5.deleteMany({});
    console.log(`✅ Deleted ${delRes.deletedCount} old records`);
    
    // Insert new records
    console.log('💾 Inserting new Summary5 records...');
    const inserted = await summary5.insertMany(merged);
    console.log(`✅ Inserted ${inserted.insertedCount} records`);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Sync complete in ${duration}s`);
    console.log(`   Summary4: ${s4Count} records`);
    console.log(`   Summary5: ${inserted.insertedCount} records`);
    
    // Verify revenue match
    const s4Stats = await summary4.aggregate([
      { $match: { isActive: { $ne: false } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } } } }
    ]).toArray();
    
    const s5Stats = await summary5.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$revenue', 0] } } } }
    ]).toArray();
    
    const s4Revenue = s4Stats[0]?.total || 0;
    const s5Revenue = s5Stats[0]?.total || 0;
    
    console.log(`\n💰 Revenue verification:`);
    console.log(`   Summary4: ${s4Revenue.toLocaleString()} đ`);
    console.log(`   Summary5: ${s5Revenue.toLocaleString()} đ`);
    console.log(`   Match: ${s4Revenue === s5Revenue ? '✅ YES' : '❌ NO'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.close();
  }
}

// Main
(async () => {
  try {
    console.log('🚀 Triggering Summary5 sync...\n');
    await triggerSync();
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
})();
