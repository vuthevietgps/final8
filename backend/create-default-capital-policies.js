/**
 * Script: Tạo default capital allocation policies
 * Run: node backend/create-default-capital-policies.js
 */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const capitalAllocationPolicySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  reinvestmentRatio: { type: Number, required: true },
  safetyReserveRatio: { type: Number, required: true },
  personalIncomeRatio: { type: Number, required: true },
  longTermAssetRatio: { type: Number, required: true },
  isActive: { type: Boolean, default: false },
  activatedAt: Date,
  notes: String
}, { timestamps: true });

async function main() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const CapitalAllocationPolicy = mongoose.model('CapitalAllocationPolicy', capitalAllocationPolicySchema, 'capital_allocation_policies');

    // Clear existing policies
    await CapitalAllocationPolicy.deleteMany({});
    console.log('🗑️  Cleared existing policies');

    // Tạo 3 policies mẫu
    const policies = [
      {
        name: 'balanced',
        description: 'Chính sách cân bằng - Phân bổ đều các khoản',
        reinvestmentRatio: 45,      // Tái đầu tư / Ads: 45%
        safetyReserveRatio: 25,     // Dự phòng an toàn: 25%
        personalIncomeRatio: 20,    // Thu nhập cá nhân: 20%
        longTermAssetRatio: 10,     // Tài sản dài hạn: 10%
        isActive: true,
        activatedAt: new Date(),
        notes: 'Policy mặc định, cân bằng giữa tăng trưởng và an toàn'
      },
      {
        name: 'aggressive',
        description: 'Chính sách tăng trưởng mạnh - Tập trung vào tái đầu tư',
        reinvestmentRatio: 50,      // Tái đầu tư / Ads: 50%
        safetyReserveRatio: 20,     // Dự phòng an toàn: 20%
        personalIncomeRatio: 20,    // Thu nhập cá nhân: 20%
        longTermAssetRatio: 10,     // Tài sản dài hạn: 10%
        isActive: false,
        notes: 'Tối ưu cho giai đoạn scale nhanh, chấp nhận rủi ro cao hơn'
      },
      {
        name: 'conservative',
        description: 'Chính sách bảo thủ - Tập trung vào dự phòng và thu nhập',
        reinvestmentRatio: 40,      // Tái đầu tư / Ads: 40%
        safetyReserveRatio: 25,     // Dự phòng an toàn: 25%
        personalIncomeRatio: 25,    // Thu nhập cá nhân: 25%
        longTermAssetRatio: 10,     // Tài sản dài hạn: 10%
        isActive: false,
        notes: 'An toàn hơn, giảm rủi ro, phù hợp khi thị trường không ổn định'
      }
    ];

    const created = await CapitalAllocationPolicy.insertMany(policies);
    
    console.log('\n✅ Đã tạo thành công 3 policies:');
    created.forEach(policy => {
      console.log(`\n📋 ${policy.name.toUpperCase()}`);
      console.log(`   Description: ${policy.description}`);
      console.log(`   - Tái đầu tư / Ads: ${policy.reinvestmentRatio}%`);
      console.log(`   - Dự phòng an toàn: ${policy.safetyReserveRatio}%`);
      console.log(`   - Thu nhập cá nhân: ${policy.personalIncomeRatio}%`);
      console.log(`   - Tài sản dài hạn: ${policy.longTermAssetRatio}%`);
      console.log(`   - Active: ${policy.isActive ? '✅ YES' : '❌ NO'}`);
    });

    console.log('\n🎯 Policy "balanced" đã được kích hoạt làm mặc định');
    console.log('\n💡 Bạn có thể thay đổi policy active qua API:');
    console.log('   PATCH /capital-allocation/policies/:id');
    console.log('   Body: { "isActive": true }');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

main();
