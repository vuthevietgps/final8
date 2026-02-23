/**
 * Script tạo user Director để test hệ thống
 */
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

const MONGODB_URI = 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/smarterp-dev';

async function createTestDirector() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const usersCollection = mongoose.connection.db.collection('users');
    
    // Kiểm tra xem user đã tồn tại chưa
    const existing = await usersCollection.findOne({ email: 'director@test.com' });
    if (existing) {
      console.log('✅ User director@test.com already exists');
      console.log('\n🔑 Login credentials:');
      console.log('   Email: director@test.com');
      console.log('   Password: 123456');
      return;
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash('123456', 10);
    
    // Tạo user Director
    await usersCollection.insertOne({
      name: 'Director Test',
      email: 'director@test.com',
      password: hashedPassword,
      userType: 'Director',
      isActive: true,
      phone: '0901234567',
      address: 'Test Address',
      notes: 'Test user for system testing',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ Created test Director user successfully!');
    console.log('\n🔑 Login credentials:');
    console.log('   Email: director@test.com');
    console.log('   Password: 123456');

  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
}

createTestDirector();
