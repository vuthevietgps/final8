/**
 * Script tạo dữ liệu mẫu cho Owner Fund Management
 * 
 * Chạy: node backend/create-sample-owner-data.js
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

// Schemas
const OwnerSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  profitSharePercentage: { type: Number, default: 20 },
  totalWithdrawn: { type: Number, default: 0 },
  availableBalance: { type: Number, default: 0 },
  bankAccount: String,
  bankName: String,
  bankAccountName: String,
  isActive: { type: Boolean, default: true },
  notes: String
}, { timestamps: true });

const WithdrawalSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner' },
  amount: Number,
  type: { type: String, enum: ['profit_share', 'emergency', 'advance'], default: 'profit_share' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'], default: 'pending' },
  requestDate: Date,
  approvedDate: Date,
  completedDate: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalNotes: String,
  reason: String,
  notes: String,
  bankAccount: String,
  bankName: String,
  bankAccountName: String,
  transactionReference: String,
  isUrgent: { type: Boolean, default: false }
}, { timestamps: true });

async function createSampleData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Owner = mongoose.model('Owner', OwnerSchema, 'owners');
    const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema, 'withdrawals');

    // Clear existing data
    await Owner.deleteMany({});
    await Withdrawal.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create sample owners
    const owner1 = await Owner.create({
      name: 'Nguyễn Văn A',
      email: 'owner1@example.com',
      phone: '0901234567',
      profitSharePercentage: 20,
      totalWithdrawn: 50000000, // 50M đã rút
      availableBalance: 150000000, // 150M khả dụng
      bankAccount: '1234567890',
      bankName: 'Vietcombank',
      bankAccountName: 'NGUYEN VAN A',
      isActive: true,
      notes: 'Chủ sở hữu chính'
    });

    const owner2 = await Owner.create({
      name: 'Trần Thị B',
      email: 'owner2@example.com',
      phone: '0907654321',
      profitSharePercentage: 15,
      totalWithdrawn: 30000000, // 30M đã rút
      availableBalance: 80000000, // 80M khả dụng
      bankAccount: '9876543210',
      bankName: 'Techcombank',
      bankAccountName: 'TRAN THI B',
      isActive: true,
      notes: 'Đồng sở hữu'
    });

    console.log('✅ Created 2 owners');

    // Create sample withdrawals
    const withdrawals = [
      // Pending withdrawals
      {
        ownerId: owner1._id,
        amount: 20000000,
        type: 'profit_share',
        status: 'pending',
        requestDate: new Date(),
        reason: 'Rút lợi nhuận tháng 1/2026',
        notes: 'Định kỳ hàng tháng',
        isUrgent: false
      },
      {
        ownerId: owner2._id,
        amount: 15000000,
        type: 'profit_share',
        status: 'pending',
        requestDate: new Date(),
        reason: 'Rút lợi nhuận tháng 1/2026',
        isUrgent: false
      },
      {
        ownerId: owner1._id,
        amount: 5000000,
        type: 'emergency',
        status: 'pending',
        requestDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        reason: 'Chi phí khẩn cấp',
        notes: 'Cần gấp',
        isUrgent: true
      },
      // Completed withdrawals
      {
        ownerId: owner1._id,
        amount: 25000000,
        type: 'profit_share',
        status: 'completed',
        requestDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        approvedDate: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
        completedDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        reason: 'Rút lợi nhuận tháng 12/2025',
        transactionReference: 'VCB20251228123456',
        isUrgent: false
      },
      {
        ownerId: owner2._id,
        amount: 15000000,
        type: 'profit_share',
        status: 'completed',
        requestDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        approvedDate: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
        completedDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        reason: 'Rút lợi nhuận tháng 12/2025',
        transactionReference: 'TCB20251228789012',
        isUrgent: false
      },
      // Approved (waiting for bank transfer)
      {
        ownerId: owner1._id,
        amount: 10000000,
        type: 'advance',
        status: 'approved',
        requestDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        approvedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        reason: 'Tạm ứng chi phí cá nhân',
        approvalNotes: 'Đã duyệt, chuẩn bị chuyển khoản',
        isUrgent: false
      },
      // Rejected
      {
        ownerId: owner2._id,
        amount: 50000000,
        type: 'emergency',
        status: 'rejected',
        requestDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        approvedDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        reason: 'Rút số lượng lớn',
        approvalNotes: 'Vượt quá số dư khả dụng',
        isUrgent: true
      }
    ];

    await Withdrawal.insertMany(withdrawals);
    console.log('✅ Created 7 sample withdrawals');

    console.log('\n📊 Summary:');
    console.log(`   Owners: 2`);
    console.log(`   Withdrawals: 7`);
    console.log(`   - Pending: 3 (1 urgent)`);
    console.log(`   - Approved: 1`);
    console.log(`   - Completed: 2`);
    console.log(`   - Rejected: 1`);

    console.log('\n💰 Owner Balances:');
    console.log(`   ${owner1.name}: ${owner1.availableBalance.toLocaleString('vi-VN')}đ available`);
    console.log(`   ${owner2.name}: ${owner2.availableBalance.toLocaleString('vi-VN')}đ available`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

createSampleData();
