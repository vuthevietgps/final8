/*
Seed some sample documents into the testorders2 collection to unblock the Test Order 2 UI locally.
Uses MONGODB_URI env var if provided, otherwise falls back to the same default in app.module.ts
*/
const mongoose = require('mongoose');

const DEFAULT_CONN = process.env.MONGODB_URI;

async function run() {
  const uri = DEFAULT_CONN;
  console.log('[seed-testorders2] Connecting to', uri.replace(/:[^@]*@/, ':***@'));
  await mongoose.connect(uri, { dbName: undefined });
  const col = mongoose.connection.collection('testorders2');

  const count = Number(process.env.COUNT || 30);
  const now = new Date();
  const docs = Array.from({ length: count }, (_, i) => ({
    customerName: `Khách hàng #${i + 1}`,
    quantity: 1 + (i % 3),
    adGroupId: i % 2 === 0 ? '0' : `ADG_${1000 + i}`,
    isActive: true,
    productionStatus: 'Chưa làm',
    orderStatus: 'Chưa có mã vận đơn',
    depositAmount: 0,
    codAmount: 0,
    manualPayment: 0,
    orderDate: new Date(now.getTime() - i * 86400000),
    createdAt: now,
    updatedAt: now,
  }));

  const res = await col.insertMany(docs);
  console.log(`[seed-testorders2] Inserted ${res.insertedCount || Object.keys(res.insertedIds || {}).length} documents.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[seed-testorders2] Error:', err);
  process.exitCode = 1;
});
