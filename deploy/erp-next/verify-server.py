"""Read-only isolation checks plus an aborted transaction in the new database."""
import json
import subprocess

def run(*args):
    return subprocess.check_output(args, text=True).strip()

def container(service):
    ids = run('docker', 'ps', '-q', '--filter', 'label=com.docker.swarm.service.name=erp-next_' + service).splitlines()
    if len(ids) != 1:
        raise RuntimeError('Expected exactly one running ' + service)
    return json.loads(run('docker', 'inspect', ids[0]))[0]

old = [json.loads(run('docker', 'inspect', 'htxbachgia-shop-' + name))[0] for name in ['backend', 'frontend', 'mongo']]
new = [container(name) for name in ['backend', 'frontend', 'mongo']]
old_mounts = {m['Source'] for c in old for m in c['Mounts']}
new_mounts = {m['Source'] for c in new for m in c['Mounts'] if m['Type'] == 'volume'}
assert not old_mounts & new_mounts, 'Storage overlaps with old ERP'
old_networks = {n for c in old for n in c['NetworkSettings']['Networks']}
new_networks = {n for c in new for n in c['NetworkSettings']['Networks']}
assert not old_networks & new_networks, 'Network overlaps with old ERP'
for c in new:
    assert c['State']['Health']['Status'] == 'healthy', 'New container is unhealthy'
for c in old:
    assert c['State']['Health']['Status'] == 'healthy', 'Old ERP is unhealthy'
backend = new[0]
env = dict(item.split('=', 1) for item in backend['Config']['Env'] if '=' in item)
assert all(key not in env for key in ['MONGODB_URI', 'JWT_SECRET', 'API_TOKEN_SECRET']), 'Secrets persisted in container Env'
assert env['GOOGLE_ADS_PRODUCTION_ENABLED'] == 'false'
assert env['AI_MARKETING_DRY_RUN'] == 'true'
print('PASS: independent volumes/networks, healthy old/new stacks, encrypted secret mounts, ads dry-run')
print(run('docker', 'exec', backend['Id'], 'wget', '-qO-', 'http://127.0.0.1:3000/health/ready'))
js = r"""
const fs=require('fs'), m=require('mongoose');
(async()=>{
  await m.connect(fs.readFileSync('/run/secrets/mongodb_uri','utf8').trim(), {serverSelectionTimeoutMS:5000});
  try {
    const db=m.connection.db;
    if(db.databaseName!=='erp_next') throw new Error('Wrong database');
    const probe=db.collection('deployment_verification');
    if(!(await db.listCollections({name:'deployment_verification'}).hasNext())) await db.createCollection('deployment_verification');
    const session=await m.startSession();
    const id='probe-'+Date.now();
    try {
      session.startTransaction();
      await probe.insertOne({_id:id}, {session});
      await session.abortTransaction();
      if(await probe.countDocuments({_id:id})!==0) throw new Error('Abort failed');
      await session.withTransaction(async()=>{await probe.insertOne({_id:id},{session});});
      if(await probe.countDocuments({_id:id})!==1) throw new Error('Commit failed');
      await probe.deleteOne({_id:id});
    } finally { await session.endSession(); }
    const counts={};
    for(const name of ['users','products','testorder2s','advertisingcosts']) counts[name]=await db.collection(name).countDocuments();
    if(counts.users!==1 || counts.products || counts.testorder2s || counts.advertisingcosts) throw new Error('Unexpected initial data');
    console.log(JSON.stringify({transactions:'commit and abort passed',initialData:counts}));
  } finally {await m.disconnect();}
})().catch(()=>{console.error('DATABASE_VERIFICATION_FAILED');process.exitCode=1;});
"""
print(run('docker', 'exec', backend['Id'], 'node', '-e', js))
