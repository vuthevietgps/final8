#!/usr/bin/env node
/*
  Restore products + productcategories from a source DB into target DB.
  Default mode is DRY-RUN.

  Usage:
    node scripts/restore-products-and-categories.js --source-db <restored_db> --target-db management-system
    node scripts/restore-products-and-categories.js --source-db <restored_db> --target-db management-system --apply
*/

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function getArg(name, def = '') {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return def;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function loadMongoUri() {
  const envPath = path.join(process.cwd(), '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  const line = text.split(/\r?\n/).find((l) => l.startsWith('MONGODB_URI='));
  if (!line) throw new Error('MONGODB_URI not found in backend/.env');
  return line.slice('MONGODB_URI='.length).trim();
}

async function backupCollection(db, collectionName, tag) {
  const docs = await db.collection(collectionName).find({}).toArray();
  const outDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(outDir, `${tag}-${collectionName}-${ts}.json`);
  fs.writeFileSync(out, JSON.stringify(docs, null, 2), 'utf8');
  return { out, count: docs.length };
}

(async () => {
  const sourceDbName = getArg('--source-db');
  const targetDbName = getArg('--target-db', 'management-system');
  const apply = hasFlag('--apply');

  if (!sourceDbName) {
    console.error('Missing --source-db');
    process.exit(1);
  }

  const uri = loadMongoUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const srcDb = mongoose.connection.useDb(sourceDbName).db;
  const dstDb = mongoose.connection.useDb(targetDbName).db;

  const collections = ['products', 'productcategories'];

  const summary = [];
  for (const c of collections) {
    const srcExists = await srcDb.listCollections({ name: c }).toArray();
    const dstExists = await dstDb.listCollections({ name: c }).toArray();
    const srcCount = srcExists.length ? await srcDb.collection(c).countDocuments({}) : 0;
    const dstCount = dstExists.length ? await dstDb.collection(c).countDocuments({}) : 0;
    summary.push({ collection: c, sourceCount: srcCount, targetCount: dstCount, sourceExists: !!srcExists.length });
  }

  console.log('Restore plan:');
  console.table(summary);
  console.log('Mode:', apply ? 'APPLY' : 'DRY-RUN');

  if (!apply) {
    await mongoose.disconnect();
    return;
  }

  for (const s of summary) {
    if (!s.sourceExists) {
      throw new Error(`Source collection not found: ${s.collection}`);
    }
  }

  for (const c of collections) {
    const bak = await backupCollection(dstDb, c, `pre-restore-${targetDbName}`);
    console.log(`[backup] ${c}: ${bak.count} -> ${bak.out}`);

    const srcDocs = await srcDb.collection(c).find({}).toArray();
    await dstDb.collection(c).deleteMany({});
    if (srcDocs.length) {
      await dstDb.collection(c).insertMany(srcDocs, { ordered: false });
    }
    console.log(`[restore] ${c}: restored ${srcDocs.length} docs into ${targetDbName}.${c}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
})().catch(async (err) => {
  console.error('ERROR:', err.message || err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
