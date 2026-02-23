/**
 * Script: Sync dữ liệu ad_group_daily_reports lần đầu
 * Sync dữ liệu 30 ngày gần nhất từ ordertest2
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/management';

async function initialSync() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Đã kết nối MongoDB');

    const db = client.db();
    const ordersCollection = db.collection('ordertest2');
    const adGroupsCollection = db.collection('ad_groups');
    const reportsCollection = db.collection('ad_group_daily_reports');

    // Lấy dữ liệu 30 ngày gần nhất
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    console.log(`\n🔄 Đồng bộ dữ liệu từ ${startDate.toISOString().split('T')[0]} đến ${endDate.toISOString().split('T')[0]}`);

    // Lấy danh sách ad groups
    const adGroups = await adGroupsCollection.find({}).toArray();
    const adGroupMap = new Map(adGroups.map(ag => [ag.adGroupId, ag]));
    console.log(`📊 Tìm thấy ${adGroups.length} ad groups`);

    // Aggregate từ ordertest2 theo ngày
    const dates = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }

    console.log(`\n⏳ Xử lý ${dates.length} ngày...\n`);

    let totalSynced = 0;

    for (const date of dates) {
      const dateStr = date.toISOString().split('T')[0];
      const dayStart = new Date(dateStr);
      const dayEnd = new Date(dateStr);
      dayEnd.setHours(23, 59, 59, 999);

      // Aggregate theo adGroupId cho ngày này
      const aggregated = await ordersCollection.aggregate([
        {
          $match: {
            orderDate: { $gte: dayStart, $lte: dayEnd },
            adGroupId: { $exists: true, $nin: [null, '', '0'] }
          }
        },
        {
          $group: {
            _id: '$adGroupId',
            netProfit: { $sum: '$netProfit' },
            adsCost: { $sum: '$adsCost' }
          }
        },
        {
          $project: {
            adGroupId: '$_id',
            netProfit: 1,
            adsCost: 1
          }
        }
      ]).toArray();

      if (aggregated.length > 0) {
        // Upsert vào collection
        const bulkOps = aggregated.map(item => {
          const adGroup = adGroupMap.get(item.adGroupId);
          return {
            updateOne: {
              filter: { date: dateStr, adGroupId: item.adGroupId },
              update: {
                $set: {
                  date: dateStr,
                  adGroupId: item.adGroupId,
                  adGroupName: adGroup?.name || '',
                  platform: adGroup?.platform || '',
                  adsCost: item.adsCost,
                  netProfit: item.netProfit,
                  syncedAt: new Date()
                }
              },
              upsert: true
            }
          };
        });

        const result = await reportsCollection.bulkWrite(bulkOps);
        totalSynced += result.upsertedCount + result.modifiedCount;
        console.log(`   ✅ ${dateStr}: ${aggregated.length} records (${result.upsertedCount} mới, ${result.modifiedCount} cập nhật)`);
      } else {
        console.log(`   ⚠️  ${dateStr}: Không có dữ liệu`);
      }
    }

    console.log(`\n✅ Hoàn thành! Tổng cộng ${totalSynced} records đã được đồng bộ`);

    // Thống kê
    const stats = await reportsCollection.aggregate([
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalAdsCost: { $sum: '$adsCost' },
          totalNetProfit: { $sum: '$netProfit' },
          distinctDates: { $addToSet: '$date' },
          distinctAdGroups: { $addToSet: '$adGroupId' }
        }
      }
    ]).toArray();

    if (stats.length > 0) {
      const stat = stats[0];
      console.log('\n📊 Thống kê:');
      console.log(`   - Tổng records: ${stat.totalRecords}`);
      console.log(`   - Số ngày: ${stat.distinctDates.length}`);
      console.log(`   - Số ad groups: ${stat.distinctAdGroups.length}`);
      console.log(`   - Tổng chi phí QC: ${stat.totalAdsCost.toLocaleString('vi-VN')} VND`);
      console.log(`   - Tổng lợi nhuận thuần: ${stat.totalNetProfit.toLocaleString('vi-VN')} VND`);
    }

  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔒 Đã đóng kết nối MongoDB');
  }
}

initialSync();
