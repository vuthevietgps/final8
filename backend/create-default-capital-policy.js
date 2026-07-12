/**
 * Script: Create Default Capital Allocation Policy
 * Purpose: Tạo chính sách phân bổ vốn mặc định (45% - 25% - 20% - 10%)
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

const capitalAllocationPolicySchema = new mongoose.Schema({
  name: String,
  description: String,
  reinvestmentRatio: Number,
  safetyReserveRatio: Number,
  personalIncomeRatio: Number,
  longTermAssetRatio: Number,
  isActive: Boolean,
  activatedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

const CapitalAllocationPolicy = mongoose.model('CapitalAllocationPolicy', capitalAllocationPolicySchema);

async function createDefaultPolicy() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Kiểm tra xem đã có policy chưa
    const existingPolicy = await CapitalAllocationPolicy.findOne({ isActive: true });
    
    if (existingPolicy) {
      console.log('ℹ️  Policy đã tồn tại:', existingPolicy.name);
      console.log('   - Tái đầu tư:', existingPolicy.reinvestmentRatio + '%');
      console.log('   - Dự phòng:', existingPolicy.safetyReserveRatio + '%');
      console.log('   - Thu nhập cá nhân:', existingPolicy.personalIncomeRatio + '%');
      console.log('   - Tài sản dài hạn:', existingPolicy.longTermAssetRatio + '%');
      return;
    }

    // Tạo policy mới
    const defaultPolicy = new CapitalAllocationPolicy({
      name: 'Chính Sách Phân Bổ Mặc Định',
      description: '45% Tái đầu tư | 25% Dự phòng | 20% Thu nhập cá nhân | 10% Tài sản dài hạn',
      reinvestmentRatio: 45,
      safetyReserveRatio: 25,
      personalIncomeRatio: 20,
      longTermAssetRatio: 10,
      isActive: true,
      activatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await defaultPolicy.save();
    
    console.log('✅ Đã tạo policy mặc định thành công!');
    console.log('   ID:', defaultPolicy._id);
    console.log('   Tên:', defaultPolicy.name);
    console.log('   - Tái đầu tư: 45%');
    console.log('   - Dự phòng: 25%');
    console.log('   - Thu nhập cá nhân: 20%');
    console.log('   - Tài sản dài hạn: 10%');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('👋 Đã ngắt kết nối MongoDB');
  }
}

createDefaultPolicy()
  .then(() => {
    console.log('\n🎉 Hoàn thành!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Có lỗi xảy ra:', error);
    process.exit(1);
  });
