const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Reset demo user passwords to a known value for local testing
const uri = process.env.MONGODB_URI;
const targets = [
  'admin@dropshipping.com',
  'vutheviet@gmail.com',
  'phamthanhmai@gmail.com',
  'nhanvien@gmail.com',
];

async function main() {
  await mongoose.connect(uri);
  const hash = await bcrypt.hash('123456', 12);
  const col = mongoose.connection.db.collection('users');
  for (const email of targets) {
    const res = await col.updateOne({ email }, { $set: { password: hash, isActive: true } });
    console.log(`${email}: matched ${res.matchedCount}, modified ${res.modifiedCount}`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Failed to reset demo passwords:', err);
  process.exit(1);
});
