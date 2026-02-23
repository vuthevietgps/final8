/**
 * Tạo user test để đăng nhập vào hệ thống
 */
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
  fullName: String,
  userType: String,
  isActive: Boolean,
  permissions: [String],
  createdAt: Date,
  updatedAt: Date
}, { collection: 'users' });

async function createTestUser() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = mongoose.model('User', userSchema);

    // Check if test user already exists
    const existing = await User.findOne({ username: 'admin' });
    if (existing) {
      console.log('✅ Test user "admin" already exists');
      console.log('Username: admin');
      console.log('Password: admin123');
      return;
    }

    // Create test user (password will be hashed by backend)
    const testUser = new User({
      username: 'admin',
      password: 'admin123', // Backend sẽ tự hash
      email: 'admin@test.com',
      fullName: 'Admin Test',
      userType: 'Director',
      isActive: true,
      permissions: [
        'users', 'ad-accounts', 'ad-groups', 'products', 'advertising-costs',
        'delivery-status', 'product-categories', 'fanpages', 'api-tokens',
        'chat-messages', 'orders', 'reports'
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await testUser.save();

    console.log('✅ Created test user successfully!');
    console.log('');
    console.log('🔑 Login credentials:');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('');
    console.log('🎯 You can now login and access:');
    console.log('- 💰 Chi Phí Quảng Cáo (to see messaging metrics)');
    console.log('- 📦 Nhóm Sản Phẩm');
    console.log('- 🚚 Trạng Thái Giao Hàng');
    console.log('- And all other modules');

  } catch (error) {
    if (error.code === 11000) {
      console.log('✅ Test user already exists');
      console.log('Username: admin');
      console.log('Password: admin123');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

createTestUser();