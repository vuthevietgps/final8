// Accept only a bcrypt hash on stdin. Never write a plaintext password to MongoDB.
const fs = require('fs');
const mongoose = require('mongoose');
async function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (!/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(input.passwordHash)) throw new Error('Invalid hash');
  const uri = fs.readFileSync('/run/secrets/mongodb_uri', 'utf8').trim();
  await mongoose.connect(uri);
  try {
    if (mongoose.connection.db.databaseName !== 'erp_next') throw new Error('Wrong database');
    const users = mongoose.connection.db.collection('users');
    if (await users.countDocuments() !== 0) throw new Error('Database already has users; refusing bootstrap');
    await users.insertOne({ email: 'admin@htxbachgia.local', fullName: 'Quản trị hệ thống mới',
      password: input.passwordHash, role: 'director', isActive: true, tokenVersion: 0,
      allowedLoginIps: [], createdAt: new Date(), updatedAt: new Date() });
    console.log('PASS: initial director account created');
  } finally { await mongoose.disconnect(); }
}
main().catch(() => { console.error('Admin bootstrap failed'); process.exitCode = 1; });
