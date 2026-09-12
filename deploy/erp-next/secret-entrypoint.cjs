// Secrets are mounted by Docker Swarm in memory, never included in service Env.
const fs = require('fs');
const { spawnSync, spawn } = require('child_process');
const mapping = {
  MONGODB_URI: 'mongodb_uri', JWT_SECRET: 'jwt_secret',
  API_TOKEN_SECRET: 'api_token_secret', MESSENGER_VERIFY_TOKEN: 'messenger_verify_token',
};
for (const [key, file] of Object.entries(mapping)) {
  process.env[key] = fs.readFileSync(`/run/secrets/${file}`, 'utf8').trim();
}
process.env.FB_VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN;
async function main() {
  const mongoose = require('mongoose');
  let connected = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
      connected = true;
      await mongoose.disconnect();
      break;
    } catch {
      await mongoose.disconnect().catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  if (!connected) throw new Error('Database initialization timed out');
  const indexes = spawnSync(process.execPath, ['/app/ensure-production-indexes.cjs', '--apply'], {
    cwd: '/app', env: process.env, stdio: ['ignore', 'ignore', 'ignore'],
  });
  if (indexes.status !== 0) throw new Error('Production index provisioning failed');
  console.log('Database and production indexes ready');
  const app = spawn(process.execPath, ['/app/dist/main.js'], { cwd: '/app', env: process.env, stdio: 'inherit' });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => app.kill(signal));
  app.on('exit', code => process.exit(code === null ? 1 : code));
}
main().catch(() => { console.error('ERP startup failed; check database initialization and indexes'); process.exit(1); });
