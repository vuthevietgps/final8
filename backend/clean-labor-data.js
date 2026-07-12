/**
 * Script làm sạch dữ liệu labor-cost và labor-statement
 * Chạy: node backend/clean-labor-data.js
 */
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI;

async function cleanData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // 1. Xóa tất cả labor statements
    const statementsResult = await db.collection('laborstatements').deleteMany({});
    console.log(`🗑️  Deleted ${statementsResult.deletedCount} labor statements`);
    
    // 2. Reset paymentStatus của tất cả labor costs về unpaid
    const costsResult = await db.collection('laborcost1').updateMany(
      {},
      { 
        $set: { 
          paymentStatus: 'unpaid',
          paid: false
        },
        $unset: {
          paidAt: '',
          statementId: ''
        }
      }
    );
    console.log(`🔄 Reset ${costsResult.modifiedCount} labor cost records to unpaid`);
    
    // 3. Đếm số phiên chưa thanh toán
    const unpaidCount = await db.collection('laborcost1').countDocuments({ paid: false });
    console.log(`📊 Total unpaid sessions: ${unpaidCount}`);
    
    // 4. Hiển thị thống kê theo user
    const statsByUser = await db.collection('laborcost1').aggregate([
      {
        $group: {
          _id: '$userId',
          totalSessions: { $sum: 1 },
          totalCost: { $sum: '$cost' },
          unpaidSessions: {
            $sum: { $cond: [{ $eq: ['$paid', false] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: { path: '$user', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          userName: { $ifNull: ['$user.fullName', 'Unknown'] },
          totalSessions: 1,
          totalCost: 1,
          unpaidSessions: 1
        }
      },
      {
        $sort: { totalCost: -1 }
      }
    ]).toArray();
    
    console.log('\n📈 Statistics by employee:');
    console.table(statsByUser.map(s => ({
      Employee: s.userName,
      'Total Sessions': s.totalSessions,
      'Unpaid Sessions': s.unpaidSessions,
      'Total Cost': s.totalCost.toLocaleString('vi-VN')
    })));
    
    console.log('\n✨ Data cleanup completed!');
    console.log('💡 You can now test the full workflow:');
    console.log('   1. Employee works → auto-create sessions');
    console.log('   2. Create statement for a period');
    console.log('   3. Confirm statement (draft → open)');
    console.log('   4. Add payments');
    console.log('   5. Auto-close when paid in full');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

cleanData();
