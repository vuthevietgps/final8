const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function updateUser() {
  await mongoose.connect(MONGODB_URI);
  
  const result = await mongoose.connection.db.collection('users').updateOne(
    { email: 'director@test.com' },
    { $set: { userType: 'Director' } }
  );
  
  console.log('Updated:', result.modifiedCount);
  
  // Verify
  const user = await mongoose.connection.db.collection('users').findOne({ email: 'director@test.com' });
  console.log('User now:', user.email, '- userType:', user.userType);
  
  await mongoose.disconnect();
}

updateUser();
