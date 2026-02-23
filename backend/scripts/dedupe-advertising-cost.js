/**
 * Script: dedupe-advertising-cost.js
 * Mục đích:
 *  - Dọn dữ liệu trùng theo cặp (adGroupId, date) trong collection advertisingcosts.
 *  - Chuẩn hoá date về UTC 00:00:00.000.
 *  - Tạo (hoặc xác nhận) unique index { adGroupId: 1, date: 1 } (uniq_adGroupId_date).
 *
 * Cách chạy (PowerShell):
 *  $env:MONGODB_URI="<mongodb connection string>"; node scripts/dedupe-advertising-cost.js       # chế độ dry-run
 *  $env:MONGODB_URI="<mongodb connection string>"; node scripts/dedupe-advertising-cost.js --apply
 */
/* eslint-disable no-console */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

function toUtcStartOfDay(d) {
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function dayKeyUTC(d) {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

async function main() {
  const APPLY = process.argv.includes('--apply');
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    // Fallback: cố gắng đọc từ backend/.env nếu chạy từ backend (scripts nằm trong backend/scripts)
    try {
      const envPath = path.resolve(__dirname, '..', '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/^MONGODB_URI\s*=\s*(.+)$/m);
        if (match && match[1]) {
          uri = match[1].trim();
        }
      }
    } catch {}
  }
  if (!uri) {
    console.error('[ERROR] MONGODB_URI không được thiết lập (env hoặc backend/.env).');
    process.exit(2);
  }

  const safeUri = (() => {
    try { const u = new URL(uri); return `${u.protocol}//${u.hostname}/${u.pathname.replace(/\//g,'')}`; } catch { return '<hidden>'; }
  })();
  console.log(`[INFO] Connecting to ${safeUri}`);
  await mongoose.connect(uri, { autoIndex: false });
  const conn = mongoose.connection;
  const AdvertisingCost = conn.model('AdvertisingCost', new mongoose.Schema({}, { strict: false, collection: 'advertisingcosts' }));

  console.log('[INFO] Scanning advertisingcosts...');
  const cursor = AdvertisingCost.find({}, { adGroupId: 1, date: 1, updatedAt: 1, createdAt: 1 }).lean().cursor();

  const groups = new Map(); // key: adGroupId|YYYY-MM-DD -> { items: [], survivor: {...} }
  let scanned = 0;
  for await (const doc of cursor) {
    scanned++;
    const adGroupId = (doc.adGroupId || '').toString();
    if (!adGroupId) continue;
    if (!doc.date) continue;
    const key = adGroupId + '|' + dayKeyUTC(doc.date);
    const updatedAt = doc.updatedAt ? new Date(doc.updatedAt) : null;
    const createdAt = doc.createdAt ? new Date(doc.createdAt) : null;
    const weight = (updatedAt && !isNaN(updatedAt)) ? updatedAt.getTime() : (createdAt && !isNaN(createdAt)) ? createdAt.getTime() : Number.parseInt(String(doc._id).slice(0,8), 16) * 1000;
    let g = groups.get(key);
    if (!g) {
      g = { items: [], survivor: { doc, weight } };
      groups.set(key, g);
    } else {
      // update survivor if this doc is newer
      if (weight > g.survivor.weight) g.survivor = { doc, weight };
    }
    g.items.push({ doc, weight });
  }

  let duplicates = 0;
  let needNormalize = 0;
  for (const [key, g] of groups.entries()) {
    if (g.items.length > 1) duplicates += (g.items.length - 1);
    const normDate = toUtcStartOfDay(g.survivor.doc.date);
    if (!normDate || (new Date(g.survivor.doc.date)).getTime() !== normDate.getTime()) needNormalize++;
  }

  console.log(`[INFO] Scanned: ${scanned} docs, groups: ${groups.size}, potential duplicates: ${duplicates}, survivors need normalize: ${needNormalize}`);

  if (!APPLY) {
    console.log('[DRY-RUN] Kết thúc (không ghi dữ liệu). Dùng --apply để thực thi.');
    await mongoose.disconnect();
    return;
  }

  console.log('[APPLY] Building bulk operations (delete duplicates, normalize survivor dates)...');
  const ops = [];
  for (const [key, g] of groups.entries()) {
    // Normalize survivor date
    const surv = g.survivor.doc;
    const normDate = toUtcStartOfDay(surv.date);
    if (normDate && (new Date(surv.date)).getTime() !== normDate.getTime()) {
      ops.push({ updateOne: { filter: { _id: surv._id }, update: { $set: { date: normDate } } } });
    }
    // Delete others
    for (const { doc } of g.items) {
      if (String(doc._id) === String(surv._id)) continue;
      ops.push({ deleteOne: { filter: { _id: doc._id } } });
    }
  }

  if (ops.length) {
    console.log(`[APPLY] Executing bulkWrite with ${ops.length} ops...`);
    const res = await AdvertisingCost.bulkWrite(ops, { ordered: false });
    console.log('[APPLY] bulkWrite result:', JSON.stringify(res, null, 2));
  } else {
    console.log('[APPLY] No operations needed.');
  }

  // Ensure unique index
  const collection = conn.collection('advertisingcosts');
  try {
    console.log('[APPLY] Creating unique index { adGroupId: 1, date: 1 } (uniq_adGroupId_date)...');
    await collection.createIndex({ adGroupId: 1, date: 1 }, { unique: true, name: 'uniq_adGroupId_date' });
  } catch (e) {
    console.warn('[WARN] createIndex error:', e && e.message ? e.message : e);
  }
  const indexes = await collection.indexes();
  const hasUniq = indexes.some(ix => ix.name === 'uniq_adGroupId_date' && ix.unique);
  console.log(`[CHECK] Index uniq_adGroupId_date present: ${hasUniq}`);

  await mongoose.disconnect();
  console.log('[DONE]');
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
