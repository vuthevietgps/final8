const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: __dirname + '/.env' });

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  phone: { type: String },
  role: { type: String, required: true, default: 'employee' },
  isActive: { type: Boolean, default: true },
});

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const User = mongoose.model('User', UserSchema);
  const email = 'admin@example.com';
  const password = await bcrypt.hash('123456', 12);

  await User.findOneAndUpdate(
    { email },
    { 
      $set: { 
        fullName: 'Admin User',
        password,
        phone: '0900000000',
        role: 'director',
        isActive: true
      }
    },
    { upsert: true, new: true }
  );

  console.log('Admin user created successfully: admin@example.com / 123456');
  await mongoose.disconnect();
}

main().catch(console.error);
