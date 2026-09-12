// Used by the existing local start script. No production or configured URI is accepted.
if (process.env.ERP_LOCAL_SANDBOX !== 'true') throw new Error('Local guard required');
const { MongoClient } = require('mongodb');
async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27027/admin?directConnection=true', { serverSelectionTimeoutMS: 1500 });
  try {
    await client.connect();
    const admin = client.db('admin');
    let configured = false;
    try { await admin.command({ replSetGetStatus: 1 }); configured = true; }
    catch (error) { if (error.code !== 94) throw error; }
    if (!configured) await admin.command({ replSetInitiate: { _id: 'erp-local-ledger', members: [{ _id: 0, host: '127.0.0.1:27027' }] } });
    for (let i = 0; i < 40; i++) {
      const hello = await admin.command({ hello: 1 });
      if (hello.setName !== 'erp-local-ledger') throw new Error('Unexpected local replica set');
      if (hello.isWritablePrimary) { process.stdout.write('Local MongoDB transaction support ready.\n'); return; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Local primary did not become ready');
  } finally { await client.close(); }
}
main().catch(error => { process.stderr.write(`Local replica initialization failed (${error.codeName || error.name}).\n`); process.exitCode = 1; });
