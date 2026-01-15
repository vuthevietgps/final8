/**
 * Script tạo nhà cung cấp test
 */
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/smarterp-dev';

const userSchema = new mongoose.Schema({
  fullName: String,
  email: String,
  password: String,
  phone: String,
  role: String,
  address: String,
  isActive: { type: Boolean, default: true },
  departmentId: String,
  managerId: String,
  notes: String,
  googleDriveLink: String,
  allowedLoginIps: [String],
  createdAt: Date,
  updatedAt: Date
}, { collection: 'users', timestamps: true });

async function createSuppliers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Kết nối MongoDB thành công\n');

    const User = mongoose.model('User', userSchema);

    // Tạo Nhà Cung Cấp Nội Bộ
    const internalSupplier = {
      fullName: 'Nhà Cung Cấp Nội Bộ 1',
      email: 'ncc-noibo1@test.com',
      password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIjU6Fe/KK', // hashed: 123456
      phone: '0901234567',
      role: 'internal_supplier',
      address: 'Địa chỉ nhà cung cấp nội bộ',
      isActive: true,
      notes: 'Nhà cung cấp nội bộ test'
    };

    // Tạo Nhà Cung Cấp Ngoài
    const externalSupplier = {
      fullName: 'Nhà Cung Cấp Ngoài 1',
      email: 'ncc-ngoai1@test.com',
      password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIjU6Fe/KK', // hashed: 123456
      phone: '0907654321',
      role: 'external_supplier',
      address: 'Địa chỉ nhà cung cấp bên ngoài',
      isActive: true,
      notes: 'Nhà cung cấp bên ngoài test'
    };

    console.log('🏗️  Tạo Nhà Cung Cấp Nội Bộ...');
    const created1 = await User.create(internalSupplier);
    console.log(`✅ Đã tạo: ${created1.fullName} (${created1.email})`);

    console.log('\n🏗️  Tạo Nhà Cung Cấp Ngoài...');
    const created2 = await User.create(externalSupplier);
    console.log(`✅ Đã tạo: ${created2.fullName} (${created2.email})`);

    // Kiểm tra lại
    console.log('\n📊 Kiểm tra lại database:');
    const suppliers = await User.find({ 
      role: { $in: ['internal_supplier', 'external_supplier'] } 
    }).select('fullName email role').lean();

    console.log(`   Tổng nhà cung cấp: ${suppliers.length}`);
    suppliers.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.fullName} - ${s.role}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Hoàn tất!');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    if (error.code === 11000) {
      console.error('   Email đã tồn tại trong database!');
    }
    process.exit(1);
  }
}

createSuppliers();
