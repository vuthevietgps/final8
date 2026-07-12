const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const uri = process.env.MONGODB_URI;
const [email, plain] = process.argv.slice(2);

if (!email || !plain) {
  console.error('Usage: node scripts/set-password.js <email> <password>');
  process.exit(1);
}

(async () => {
  await mongoose.connect(uri);
  const hash = await bcrypt.hash(plain, 12);
  const res = await mongoose.connection.db.collection('users').updateOne(
    { email },
    { $set: { password: hash, isActive: true } }
  );
  console.log(`Email: ${email} | matched: ${res.matchedCount} | modified: ${res.modifiedCount}`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
