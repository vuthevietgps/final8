/**
 * Script: create-dropshipping-user.js
 * Mục đích: Tạo user mới cho database smarterp-dev (dropshipping)
 * Cách chạy: node backend/create-dropshipping-user.js
 */

const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

// URI kết nối database smarterp-dev
const MONGODB_URI = process.env.MONGODB_URI;

// Enum vai trò
const UserRole = {
  DIRECTOR: 'director',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  INTERNAL_AGENT: 'internal_agent',
  EXTERNAL_AGENT: 'external_agent',
  INTERNAL_SUPPLIER: 'internal_supplier',
  EXTERNAL_SUPPLIER: 'external_supplier',
  INVESTOR: 'investor',
  LENDER: 'lender',
};

// User Schema
const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: String,
    role: { type: String, required: true, enum: Object.values(UserRole) },
    address: String,
    isActive: { type: Boolean, default: true },
    departmentId: String,
    managerId: String,
    notes: String,
    googleDriveLink: String,
    allowedLoginIps: { type: [String], default: [] },
  },
  { timestamps: true }
);

async function createUser() {
  try {
    console.log('🔗 Connecting to MongoDB smarterp-dev...');
    await mongoose.connect(MONGODB_URI);

    const UserModel = mongoose.model('User', userSchema);

    // Dữ liệu user mới (có thể chỉnh sửa)
    const newUserData = {
      fullName: 'Admin Dropshipping',
      email: 'admin@dropshipping.com',
      password: 'Admin123456',
      phone: '0123456789',
      role: UserRole.DIRECTOR,
      address: 'Hồ Chí Minh',
      isActive: true,
      notes: 'User quản trị hệ thống dropshipping',
    };

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcryptjs.hash(newUserData.password, 10);

    // Tạo user
    console.log('📝 Tạo user mới...');
    const user = new UserModel({
      ...newUserData,
      password: hashedPassword,
    });

    const savedUser = await user.save();

    console.log('✅ User được tạo thành công!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Chi tiết user:');
    console.log(`  ID: ${savedUser._id}`);
    console.log(`  Tên: ${savedUser.fullName}`);
    console.log(`  Email: ${savedUser.email}`);
    console.log(`  Vai trò: ${savedUser.role}`);
    console.log(`  Mật khẩu: ${newUserData.password} (đã hash)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Sử dụng thông tin này để đăng nhập:');
    console.log(`  Email: ${newUserData.email}`);
    console.log(`  Password: ${newUserData.password}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createUser();
