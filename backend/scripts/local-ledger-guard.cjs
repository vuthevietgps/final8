// Local rehearsal only. Load before any application module; never reads .env.
const { randomBytes } = require('node:crypto');
const net = require('node:net');
// A second preview can run without interrupting an existing local session.
const alternateDemo = process.argv.includes('--alternate-demo');
const apiPort = alternateDemo ? 3002 : 3001;
const webPort = alternateDemo ? 4301 : 4300;
const allowedEnv = new Set(['SYSTEMROOT', 'WINDIR', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMDATA', 'OS']);
for (const key of Object.keys(process.env)) {
  if (!allowedEnv.has(key.toUpperCase())) delete process.env[key];
}
Object.assign(process.env, {
  ERP_LOCAL_SANDBOX: 'true', NODE_ENV: 'development', PORT: String(apiPort),
  MONGODB_URI: 'mongodb://127.0.0.1:27027/erp_ledger_local_20260904',
  JWT_SECRET: randomBytes(48).toString('hex'),
  API_TOKEN_SECRET: randomBytes(32).toString('hex'),
  GOOGLE_ADS_PRODUCTION_ENABLED: 'false', META_ADS_PRODUCTION_ENABLED: 'false',
});
// Block connections to remote providers and to the existing MongoDB port.
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0][0] : net._normalizeArgs(args)[0];
  const host = normalized.host || 'localhost';
  if (normalized.path || !['127.0.0.1', 'localhost', '::1'].includes(host)
      || ![27027, apiPort, webPort].includes(Number(normalized.port))) {
    throw new Error('LOCAL_SANDBOX_OUTBOUND_BLOCKED');
  }
  return connect.apply(this, args);
};
