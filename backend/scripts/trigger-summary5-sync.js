/**
 * Script để trigger Summary5 sync trực tiếp từ service
 * Chạy: node scripts/trigger-summary5-sync.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

// Mock Summary5 service logic
async function syncSummary5() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB via Mongoose\n');
  
  const db = mongoose.connection.db;
  const summary4Collection = db.collection('summary4');
  const advertisingCostsCollection = db.collection('advertisingcosts');
  const summary5Collection = db.collection('summary5');
  
  try {
    console.log('[summary5.sync] Starting sync...');
    
    const match = { isActive: { $ne: false } };
    
    // Aggregate từ Summary4
    console.log('[summary5.sync] Aggregating Summary4...');
    const summary4Agg = await summary4Collection.aggregate([
      { $match: match },
      {
        $project: {
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
          orderDate: { $type: 'date' },
          paidToCompanyAmount: { $gt: 0 }
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
        $group: {
          _id: { adGroupId: '$adGroupId', productId: '$productId', orderDateStr: '$orderDateStr' },
          profit: { $sum: '$profit' },
          revenue: { $sum: '$revenue' },
          adCost: { $sum: '$adCost' },
        },
      },
      {
        $project: {
          _id: 0,
          adGroupId: '$_id.adGroupId',
          productId: {
            $cond: {
              if: { $eq: [{ $type: '$_id.productId' }, 'objectId'] },
              then: { $toString: '$_id.productId' },
              else: { $ifNull: ['$_id.productId', null] }
            }
          },
          orderDate: { $dateFromString: { dateString: '$_id.orderDateStr' } },
          profit: 1,
          revenue: 1,
          adCost: 1,
        },
      },
    ], { allowDiskUse: true }).toArray();
    
    console.log(`[summary5.sync] Summary4 aggregated: ${summary4Agg.length} records`);
    
    // Aggregate AdvertisingCost
    console.log('[summary5.sync] Aggregating AdvertisingCost...');
    const costAgg = await advertisingCostsCollection.aggregate([
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
    
    console.log(`[summary5.sync] AdvertisingCost aggregated: ${costAgg.length} records`);
    
    // Merge costs
    const costMap = new Map();
    costAgg.forEach(c => {
      const key = `${c.adGroupId || ''}|${c.dateStr}`;
      costMap.set(key, (costMap.get(key) || 0) + Number(c.adCost || 0));
    });
    
    const merged = summary4Agg.map(row => {
      const dateStr = row.orderDate instanceof Date ? row.orderDate.toISOString().slice(0, 10) : '';
      const costKey = `${row.adGroupId || ''}|${dateStr}`;
      const adCost = costMap.get(costKey) || 0;
      return { ...row, adCost };
    });
    
    // Delete existing
    console.log('[summary5.sync] Deleting existing Summary5...');
    const delRes = await summary5Collection.deleteMany({});
    console.log(`[summary5.sync] Deleted: ${delRes.deletedCount} records`);
    
    // Insert new
    if (merged.length > 0) {
      console.log('[summary5.sync] Inserting new records...');
      const inserted = await summary5Collection.insertMany(merged);
      console.log(`[summary5.sync] Inserted: ${inserted.insertedCount} records`);
    }
    
    console.log('\n✅ Summary5 sync completed successfully');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

syncSummary5().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
