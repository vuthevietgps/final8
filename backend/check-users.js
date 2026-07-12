const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

async function checkUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const users = await mongoose.connection.db.collection('users').find({}).limit(10).toArray();
    console.log('\n📋 Users in DB:', users.length);
    
    users.forEach(u => {
      console.log(` - ${u.email || u.username} | ${u.userType} | hasPassword: ${!!u.password}`);
    });

    if (users.length === 0) {
      console.log('\n⚠️ No users found. Creating test user...');
      
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('123456', 10);
      
      await mongoose.connection.db.collection('users').insertOne({
        name: 'Admin Test',
        email: 'admin@test.com',
        password: hashedPassword,
        userType: 'Director',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('✅ Created test user:');
      console.log('   Email: admin@test.com');
      console.log('   Password: 123456');
    }

  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkUsers();
