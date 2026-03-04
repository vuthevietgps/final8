/*
  Rebuild missing products using references from historical collections.
  Default mode: DRY-RUN (no writes).

  Usage:
    node scripts/rebuild-products-from-references.js --db management-system
    node scripts/rebuild-products-from-references.js --db management-system --apply
*/

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const RECOVERY_CATEGORY_NAME = 'Recovered Temporary';
const RECOVERY_NOTE = '[RECOVERED] Recreated from historical references after accidental seed overwrite';

function getArg(name, def = '') {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return def;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function isObjectIdString(v) {
  return typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v);
}

function loadMongoUri() {
  const envPath = path.join(process.cwd(), '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  const line = text.split(/\r?\n/).find((l) => l.startsWith('MONGODB_URI='));
  if (!line) throw new Error('MONGODB_URI not found in backend/.env');
  return line.slice('MONGODB_URI='.length).trim();
}

function pushName(nameMap, id, name, source) {
  if (!name || !String(name).trim()) return;
  const key = String(id);
  if (!nameMap.has(key)) nameMap.set(key, []);
  nameMap.get(key).push({ name: String(name).trim(), source });
}

function pickBestName(candidates, id) {
  if (!candidates || !candidates.length) {
    return `Recovered Product ${String(id).slice(-6).toUpperCase()}`;
  }
  const score = (x) => {
    if (x.source === 'quotes') return 3;
    if (x.source === 'purchase-snap') return 2;
    if (x.source === 'supplier-payable-snap') return 2;
    return 1;
  };
  const sorted = [...candidates].sort((a, b) => score(b) - score(a));
  return sorted[0].name;
}

async function backupCollection(db, collectionName, dbName) {
  const docs = await db.collection(collectionName).find({}).toArray();
  const outDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(outDir, `pre-rebuild-${dbName}-${collectionName}-${ts}.json`);
  fs.writeFileSync(out, JSON.stringify(docs, null, 2), 'utf8');
  return { out, count: docs.length };
}

function pickActiveStatus(existingProducts) {
  const nonEmpty = existingProducts
    .map((p) => (typeof p.status === 'string' ? p.status.trim() : ''))
    .filter(Boolean);
  if (!nonEmpty.length) return 'Active';

  const match = nonEmpty.find((s) => /hoat|hoat dong|active/i.test(s));
  return match || nonEmpty[0];
}

function makeSkuGenerator(existingProducts) {
  const existingSkus = new Set(
    existingProducts
      .map((p) => (typeof p.sku === 'string' ? p.sku.trim() : ''))
      .filter(Boolean),
  );

  return function makeUniqueRecoverySku(id) {
    const base = `RCV${String(id).slice(-6).toUpperCase()}`;
    let sku = base;
    let i = 1;
    while (existingSkus.has(sku)) {
      sku = `${base}-${i}`;
      i += 1;
    }
    existingSkus.add(sku);
    return sku;
  };
}

(async () => {
  const dbName = getArg('--db', 'management-system');
  const apply = hasFlag('--apply');

  const uri = loadMongoUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.useDb(dbName).db;

  const refs = new Set();
  const names = new Map();

  const quotes = await db.collection('quotes')
    .find({}, { projection: { productId: 1, product: 1 } })
    .toArray();
  for (const q of quotes) {
    const id = String(q.productId || '');
    if (!isObjectIdString(id) || id === '000000000000000000000000') continue;
    refs.add(id);
    pushName(names, id, q.product, 'quotes');
  }

  // Include both historical collection names:
  // - "testorder2" (legacy/test scripts)
  // - "ordertest2" (current schema collection)
  for (const orderCollectionName of ['testorder2', 'ordertest2']) {
    const orders = await db.collection(orderCollectionName)
      .find({}, { projection: { productId: 1 } })
      .toArray()
      .catch(() => []);
    for (const o of orders) {
      const id = String(o.productId || '');
      if (!isObjectIdString(id) || id === '000000000000000000000000') continue;
      refs.add(id);
    }
  }

  const supplierQuotes = await db.collection('supplierquotes')
    .find({}, { projection: { productId: 1 } })
    .toArray()
    .catch(() => []);
  for (const sq of supplierQuotes) {
    const id = String(sq.productId || '');
    if (!isObjectIdString(id) || id === '000000000000000000000000') continue;
    refs.add(id);
  }

  const purchases = await db.collection('purchaseorders')
    .find({}, { projection: { items: 1 } })
    .toArray()
    .catch(() => []);
  for (const po of purchases) {
    for (const it of Array.isArray(po.items) ? po.items : []) {
      const id = String(it.productId || '');
      if (!isObjectIdString(id) || id === '000000000000000000000000') continue;
      refs.add(id);
      pushName(names, id, it.productNameSnap, 'purchase-snap');
    }
  }

  const supplierPayables = await db.collection('supplierpayables')
    .find({}, { projection: { items: 1 } })
    .toArray()
    .catch(() => []);
  for (const sp of supplierPayables) {
    for (const it of Array.isArray(sp.items) ? sp.items : []) {
      const id = String(it.productId || '');
      if (!isObjectIdString(id) || id === '000000000000000000000000') continue;
      refs.add(id);
      pushName(names, id, it.productNameSnap, 'supplier-payable-snap');
    }
  }

  const allRefs = Array.from(refs);
  const existingProducts = await db.collection('products')
    .find({}, { projection: { _id: 1, sku: 1, name: 1, status: 1 } })
    .toArray();
  const existingSet = new Set(existingProducts.map((p) => String(p._id)));
  const missingIds = allRefs.filter((id) => !existingSet.has(id));

  let recoveryCategory = await db.collection('productcategories')
    .findOne({ name: RECOVERY_CATEGORY_NAME });

  const activeStatus = pickActiveStatus(existingProducts);
  const makeUniqueRecoverySku = makeSkuGenerator(existingProducts);

  const docsToInsert = missingIds.map((id) => {
    const bestName = pickBestName(names.get(id), id);
    const sku = makeUniqueRecoverySku(id);

    return {
      _id: new mongoose.Types.ObjectId(id),
      name: bestName,
      categoryId: recoveryCategory ? recoveryCategory._id : null,
      status: activeStatus,
      color: '#3B82F6',
      usageDurationMonths: 1,
      assumedReturnRatePercent: 20,
      importPrice: 0,
      shippingCost: 0,
      packagingCost: 0,
      totalCost: 0,
      sku,
      notes: RECOVERY_NOTE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  console.log('Database:', dbName);
  console.log('Mode:', apply ? 'APPLY' : 'DRY-RUN');
  console.log('Referenced productId count:', allRefs.length);
  console.log('Existing products:', existingProducts.length);
  console.log('Missing product docs to rebuild:', docsToInsert.length);
  console.log('Detected active status for inserts:', activeStatus);

  console.log('\nPreview missing docs:');
  docsToInsert.slice(0, 30).forEach((d, i) => {
    console.log(`${i + 1}. ${String(d._id)} | sku=${d.sku} | name=${d.name}`);
  });

  if (!apply) {
    await mongoose.disconnect();
    return;
  }

  const b1 = await backupCollection(db, 'products', dbName);
  const b2 = await backupCollection(db, 'productcategories', dbName);
  console.log(`[backup] products: ${b1.count} -> ${b1.out}`);
  console.log(`[backup] productcategories: ${b2.count} -> ${b2.out}`);

  if (!recoveryCategory) {
    const code = `RCV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    const created = await db.collection('productcategories').insertOne({
      name: RECOVERY_CATEGORY_NAME,
      code,
      description: 'Temporary category for products recovered from historical references',
      icon: 'tools',
      color: '#6B7280',
      isActive: true,
      order: 999,
      productCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    recoveryCategory = { _id: created.insertedId };
    console.log('[apply] created recovery category:', String(created.insertedId));
  }

  for (const d of docsToInsert) d.categoryId = recoveryCategory._id;

  if (docsToInsert.length) {
    await db.collection('products').insertMany(docsToInsert, { ordered: false });
  }

  const catAgg = await db.collection('products').aggregate([
    { $group: { _id: '$categoryId', count: { $sum: 1 } } },
  ]).toArray();

  for (const row of catAgg) {
    await db.collection('productcategories').updateOne(
      { _id: row._id },
      { $set: { productCount: row.count, updatedAt: new Date() } },
    );
  }

  console.log('[apply] inserted rebuilt products:', docsToInsert.length);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('ERROR:', err.message || err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
