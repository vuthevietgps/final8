/**
 * Script kiểm tra nhà cung cấp trong database
 */
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

const userSchema = new mongoose.Schema({
  fullName: String,
  email: String,
  password: String,
  phone: String,
  role: String,
  address: String,
  isActive: Boolean,
  departmentId: String,
  managerId: String,
  notes: String,
  googleDriveLink: String,
  allowedLoginIps: [String],
  createdAt: Date,
  updatedAt: Date
}, { collection: 'users', timestamps: true });

async function checkSuppliers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Kết nối MongoDB thành công\n');

    const User = mongoose.model('User', userSchema);

    // Đếm tổng số users
    const totalUsers = await User.countDocuments();
    console.log(`📊 Tổng số users: ${totalUsers}\n`);

    // Đếm theo từng role
    const roles = [
      'director',
      'manager',
      'employee',
      'internal_agent',
      'external_agent',
      'internal_supplier',
      'external_supplier',
      'investor',
      'lender'
    ];

    console.log('📋 Phân bố theo vai trò:');
    for (const role of roles) {
      const count = await User.countDocuments({ role });
      console.log(`   ${role.padEnd(20)}: ${count}`);
    }

    // Lấy danh sách suppliers
    console.log('\n🏪 Danh sách Nhà Cung Cấp:');
    const suppliers = await User.find({ 
      role: { $in: ['internal_supplier', 'external_supplier'] } 
    }).select('fullName email role isActive').lean();

    if (suppliers.length === 0) {
      console.log('   ❌ KHÔNG TÌM THẤY NHÀ CUNG CẤP NÀO!');
    } else {
      suppliers.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.fullName} (${s.email}) - ${s.role} - ${s.isActive ? 'Active' : 'Inactive'}`);
      });
    }

    // Lấy tất cả users để check
    console.log('\n👥 Danh sách TẤT CẢ users:');
    const allUsers = await User.find().select('fullName email role').lean();
    allUsers.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.fullName.padEnd(30)} - ${u.role}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Hoàn tất kiểm tra');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

checkSuppliers();
