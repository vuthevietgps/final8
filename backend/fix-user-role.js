const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function fixUserRole() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const usersCollection = mongoose.connection.db.collection('users');
  
  // Cập nhật user test: thêm field role = Director (lowercase để match với RolesGuard)
  const result = await usersCollection.updateOne(
    { email: 'director@test.com' },
    { 
      $set: { 
        role: 'director',  // lowercase để match với RolesGuard 
        userType: 'Director'
      } 
    }
  );
  
  console.log('Updated:', result.modifiedCount);
  
  // Verify
  const user = await usersCollection.findOne({ email: 'director@test.com' });
  console.log('User now:');
  console.log('  - email:', user.email);
  console.log('  - role:', user.role);
  console.log('  - userType:', user.userType);
  console.log('  - isActive:', user.isActive);
  
  await mongoose.disconnect();
}

fixUserRole();
