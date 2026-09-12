// Run using mongosh inside the NEW mongo container only.
const fs = require('fs');
const rootPassword = fs.readFileSync('/run/secrets/mongo_root_password', 'utf8').trim();
const appPassword = fs.readFileSync('/run/secrets/mongo_app_password', 'utf8').trim();
const connection = new Mongo('mongodb://erp_root:' + encodeURIComponent(rootPassword) + '@127.0.0.1:27017/admin?directConnection=true');
const admin = connection.getDB('admin');
let status;
try { status = admin.runCommand({replSetGetStatus: 1}); } catch (e) {
  if (e.code !== 94) throw e;
}
if (!status || status.code === 94) {
  const result = admin.runCommand({replSetInitiate: {_id: 'erp-next-rs', members: [{_id: 0, host: 'mongo:27017'}]}});
  if (!result.ok) throw new Error('Replica set initialization failed');
}
let primary = false;
for (let attempt = 0; attempt < 60; attempt++) {
  if (admin.runCommand({hello: 1}).isWritablePrimary) { primary = true; break; }
  sleep(1000);
}
if (!primary) throw new Error('Replica set election timed out');
const application = connection.getDB('erp_next');
if (!application.getUser('erp_app')) {
  application.createUser({user: 'erp_app', pwd: appPassword, roles: [{role: 'readWrite', db: 'erp_next'}]});
}
print('PASS: new authenticated replica set and dedicated application database user ready');
