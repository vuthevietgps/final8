/**
 * Script: Tạo dữ liệu test cho nguồn vốn khả dụng
 * Mục đích: Test logic tính toán available funds
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  console.log('🔗 Kết nối MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);

  const Summary5 = mongoose.connection.collection('summary5s');
  const CashflowEntry = mongoose.connection.collection('cashflowentries');
  const LoanContract = mongoose.connection.collection('loancontracts');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  console.log('\n📦 1. TẠO TEST ORDERS (Summary5)');
  
  // Order 1: Đã thu 5 triệu hôm nay
  const order1 = {
    _id: new mongoose.Types.ObjectId(),
    testOrder2Id: 'TEST-ORDER-001',
    customerName: 'Nguyễn Văn A',
    phoneNumber: '0901234567',
    totalRevenue: 5000000,
    totalCost: 3000000,
    profit: 2000000,
    collectedAmount: 5000000, // Field đúng là collectedAmount
    orderDate: today,
    completedDate: today,
    status: 'completed',
    createdAt: today,
    updatedAt: today,
  };

  // Order 2: Đã thu 10 triệu hôm qua (KHÔNG TÍNH vào hôm nay)
  const order2 = {
    _id: new mongoose.Types.ObjectId(),
    testOrder2Id: 'TEST-ORDER-002',
    customerName: 'Trần Thị B',
    phoneNumber: '0912345678',
    totalRevenue: 15000000,
    totalCost: 10000000,
    profit: 5000000,
    collectedAmount: 10000000, // Field đúng là collectedAmount
    orderDate: yesterday,
    completedDate: yesterday,
    status: 'completed',
    createdAt: yesterday,
    updatedAt: yesterday,
  };

  // Order 3: Chưa thu tiền (không tính vào available funds)
  const order3 = {
    _id: new mongoose.Types.ObjectId(),
    testOrder2Id: 'TEST-ORDER-003',
    customerName: 'Lê Văn C',
    phoneNumber: '0923456789',
    totalRevenue: 8000000,
    totalCost: 5000000,
    profit: 3000000,
    collectedAmount: 0, // Field đúng là collectedAmount
    orderDate: today,
    status: 'pending',
    createdAt: today,
    updatedAt: today,
  };

  await Summary5.deleteMany({ testOrder2Id: { $in: ['TEST-ORDER-001', 'TEST-ORDER-002', 'TEST-ORDER-003'] } });
  await Summary5.insertMany([order1, order2, order3]);
  console.log(`   ✅ Tạo 3 orders test`);
  console.log(`   - Order 1: Đã thu 5 triệu hôm nay`);
  console.log(`   - Order 2: Đã thu 10 triệu hôm qua`);
  console.log(`   - Order 3: Chưa thu tiền (không tính)`);

  console.log('\n💰 2. TẠO TEST KHOẢN VAY');
  
  // Khoản vay 100 triệu, đã trả 30 triệu → Room còn 70 triệu
  const loan = {
    _id: new mongoose.Types.ObjectId(),
    loanCode: 'LOAN-TEST-001',
    lenderName: 'Ngân hàng ABC',
    principal: 100000000, // Field đúng là principal
    principalRemaining: 70000000, // Field đúng là principalRemaining (chưa trả)
    interestRate: 12,
    startDate: new Date('2025-01-01'),
    dueDate: new Date('2026-12-31'),
    status: 'active',
    notes: 'Khoản vay test cho available funds',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await LoanContract.deleteMany({ loanCode: 'LOAN-TEST-001' });
  await LoanContract.insertOne(loan);
  console.log(`   ✅ Tạo khoản vay test`);
  console.log(`   - Vay: 100 triệu`);
  console.log(`   - Đã trả: 30 triệu`);
  console.log(`   - Room còn: 70 triệu`);

  console.log('\n💸 3. TẠO TEST CHI PHÍ HÔM NAY');
  
  // Chi 3 triệu cho marketing hôm nay
  const cashflow1 = {
    _id: new mongoose.Types.ObjectId(),
    direction: 'out', // Field đúng
    sourceType: 'other',
    amount: 3000000,
    date: today, // Field đúng
    category: 'marketing',
    description: 'Chi quảng cáo Facebook hôm nay',
    createdAt: today,
    updatedAt: today,
  };

  // Chi 2 triệu cho văn phòng hôm nay
  const cashflow2 = {
    _id: new mongoose.Types.ObjectId(),
    direction: 'out',
    sourceType: 'other',
    amount: 2000000,
    date: today,
    category: 'office',
    description: 'Chi tiền điện, nước, văn phòng',
    createdAt: today,
    updatedAt: today,
  };

  // Thu 1 triệu từ nguồn khác (KHÔNG TÍNH vào actualSpent vì là direction: 'in')
  const cashflow3 = {
    _id: new mongoose.Types.ObjectId(),
    direction: 'in', // Thu vào, không phải chi
    sourceType: 'other',
    amount: 1000000,
    date: today,
    category: 'other',
    description: 'Thu từ thanh lý thiết bị cũ',
    createdAt: today,
    updatedAt: today,
  };

  await CashflowEntry.deleteMany({ description: { $regex: /Chi quảng cáo Facebook|Chi tiền điện|Thu từ thanh lý/ } });
  await CashflowEntry.insertMany([cashflow1, cashflow2, cashflow3]);
  console.log(`   ✅ Tạo 3 giao dịch cashflow test`);
  console.log(`   - Chi 3 triệu marketing (direction: out)`);
  console.log(`   - Chi 2 triệu văn phòng (direction: out)`);
  console.log(`   - Thu 1 triệu từ nguồn khác (direction: in, không trừ)`);

  console.log('\n🧮 4. TÍNH TOÁN DỰ KIẾN');
  console.log('   Thu đã thu (hôm nay):        5.000.000 đ (Order 1)');
  console.log('   Room vay còn lại:         + 70.000.000 đ');
  console.log('   Đã chi (hôm nay):         -  5.000.000 đ (3tr + 2tr, chỉ direction=out)');
  console.log('   Dành lương:               - 10.000.000 đ');
  console.log('   Dành lãi:                 -  2.000.000 đ');
  console.log('   Dành NCC:                 -  5.000.000 đ');
  console.log('   Dành đại lý:              -  3.000.000 đ');
  console.log('   Dành khác:                -  1.000.000 đ');
  console.log('   ─────────────────────────────────────');
  console.log('   ✅ VỐN KHẢ DỤNG DỰ KIẾN:    49.000.000 đ');

  console.log('\n💡 Chạy lại test script để kiểm tra:');
  console.log('   node test-available-funds.js');

  await mongoose.connection.close();
  console.log('\n✅ HOÀN THÀNH!');
}

main().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
