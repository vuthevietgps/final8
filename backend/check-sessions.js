const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  
  // Check userId type
  const session = await db.collection('sessionlogs').findOne({});
  console.log('userId type:', typeof session.userId, 'value:', session.userId);
  console.log('Is ObjectId:', session.userId instanceof mongoose.Types.ObjectId);
  
  // Try query with string
  const strResult = await db.collection('sessionlogs').findOne({ userId: '695b87133d71da16072a5df2', logoutAt: { $exists: false } });
  console.log('Query with string:', strResult ? 'FOUND' : 'NOT FOUND');
  
  // Try query with ObjectId
  const oid = new mongoose.Types.ObjectId('695b87133d71da16072a5df2');
  const oidResult = await db.collection('sessionlogs').findOne({ userId: oid, logoutAt: { $exists: false } });
  console.log('Query with ObjectId:', oidResult ? 'FOUND' : 'NOT FOUND');
  
  mongoose.disconnect();
}).catch(e => console.error(e));
