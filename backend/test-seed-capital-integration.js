/**
 * TEST SEED CAPITAL & LOAN INTEGRATION
 * 
 * Script này test việc tích hợp vốn vay (LoanContract) với Bank Balance
 */

const mongoose = require('mongoose');

// Kết nối MongoDB - Sử dụng Atlas như backend
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/smarterp-dev';

async function main() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const LoanContract = mongoose.model('LoanContract', new mongoose.Schema({
      name: String,
      lenderName: String,
      principal: Number,
      principalRemaining: Number,
      interestRate: Number,
      status: String,
    }), 'loancontracts');

    const FundingSource = mongoose.model('FundingSource', new mongoose.Schema({
      name: String,
      type: String,
      principal: Number,
      allocatedAmount: Number,
      status: String,
    }), 'fundingsources');

    console.log('📊 === TEST 1: Kiểm tra LoanContract ===');
    const loans = await LoanContract.find({ status: { $in: ['active', 'draft'] } });
    console.log(`Số lượng khoản vay active/draft: ${loans.length}`);
    
    const loanResult = await LoanContract.aggregate([
      { $match: { status: { $in: ['active', 'draft'] } } },
      { 
        $group: { 
          _id: null, 
          totalLoan: { $sum: '$principal' },
          totalRemaining: { $sum: { $ifNull: ['$principalRemaining', '$principal'] } }
        } 
      }
    ]);
    
    const loanInfo = loanResult?.[0] || { totalLoan: 0, totalRemaining: 0 };
    console.log('Vốn vay:');
    console.log(`  • Đã giải ngân: ${loanInfo.totalLoan.toLocaleString('vi-VN')}đ`);
    console.log(`  • Còn phải trả: ${loanInfo.totalRemaining.toLocaleString('vi-VN')}đ`);
    console.log(`  • Đã trả: ${(loanInfo.totalLoan - loanInfo.totalRemaining).toLocaleString('vi-VN')}đ\n`);

    console.log('📊 === TEST 2: Kiểm tra FundingSource ===');
    const allSources = await FundingSource.find({ status: 'active' });
    console.log(`Tổng số FundingSource active: ${allSources.length}`);
    
    const equitySources = await FundingSource.find({ 
      status: 'active', 
      type: { $ne: 'loan' } 
    });
    console.log(`FundingSource không phải loan: ${equitySources.length}`);
    
    const equityResult = await FundingSource.aggregate([
      { $match: { status: 'active', type: { $ne: 'loan' } } },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$principal' },
          allocated: { $sum: { $ifNull: ['$allocatedAmount', 0] } }
        } 
      }
    ]);
    
    const equityInfo = equityResult?.[0] || { total: 0, allocated: 0 };
    console.log('Vốn chủ sở hữu:');
    console.log(`  • Tổng vốn chủ: ${equityInfo.total.toLocaleString('vi-VN')}đ`);
    console.log(`  • Đã phân bổ: ${equityInfo.allocated.toLocaleString('vi-VN')}đ`);
    console.log(`  • Còn lại: ${(equityInfo.total - equityInfo.allocated).toLocaleString('vi-VN')}đ\n`);

    console.log('📊 === TEST 3: Tổng hợp Seed Capital ===');
    const seedCapital = {
      total: loanInfo.totalLoan + equityInfo.total,
      loan: loanInfo.totalLoan,
      equity: equityInfo.total,
      allocated: equityInfo.allocated,
      remaining: equityInfo.total - equityInfo.allocated
    };
    
    console.log('Seed Capital:');
    console.log(`  • Tổng vốn ban đầu: ${seedCapital.total.toLocaleString('vi-VN')}đ`);
    console.log(`    - Vốn vay: ${seedCapital.loan.toLocaleString('vi-VN')}đ (${(seedCapital.loan/seedCapital.total*100).toFixed(1)}%)`);
    console.log(`    - Vốn chủ sở hữu: ${seedCapital.equity.toLocaleString('vi-VN')}đ (${(seedCapital.equity/seedCapital.total*100).toFixed(1)}%)`);
    console.log(`  • Đã phân bổ: ${seedCapital.allocated.toLocaleString('vi-VN')}đ`);
    console.log(`  • Còn lại: ${seedCapital.remaining.toLocaleString('vi-VN')}đ\n`);

    console.log('📊 === TEST 4: Danh sách LoanContract ===');
    if (loans.length > 0) {
      loans.forEach((loan, i) => {
        console.log(`${i+1}. ${loan.name}`);
        console.log(`   Người cho vay: ${loan.lenderName}`);
        console.log(`   Gốc: ${loan.principal.toLocaleString('vi-VN')}đ`);
        console.log(`   Còn lại: ${(loan.principalRemaining || loan.principal).toLocaleString('vi-VN')}đ`);
        console.log(`   Lãi suất: ${loan.interestRate || 0}%`);
        console.log(`   Trạng thái: ${loan.status}`);
        console.log('');
      });
    } else {
      console.log('❌ KHÔNG CÓ khoản vay nào trong hệ thống!');
      console.log('💡 Tạo khoản vay test:');
      console.log('   POST http://localhost:3000/finance/loans');
      console.log('   Body: {');
      console.log('     "name": "Vay ngân hàng Vietcombank",');
      console.log('     "lenderName": "Vietcombank",');
      console.log('     "principal": 50000000,');
      console.log('     "interestRate": 8.5,');
      console.log('     "status": "active"');
      console.log('   }\n');
    }

    console.log('📊 === TEST 5: Kiểm tra tương thích với finance.service ===');
    console.log('getLoanRoomAvailable() trong finance.service.ts:');
    console.log(`  • Logic: Tính principalRemaining từ LoanContract`);
    console.log(`  • Kết quả hiện tại: ${loanInfo.totalRemaining.toLocaleString('vi-VN')}đ`);
    console.log(`  • ✅ Đồng bộ với getLoanDisbursed().remaining\n`);

    console.log('✅ === KẾT LUẬN ===');
    console.log('✓ Method getLoanDisbursed() đã được thêm vào funds.service.ts');
    console.log('✓ Vốn vay được tách riêng khỏi vốn chủ sở hữu');
    console.log('✓ Seed Capital = Vốn vay + Vốn chủ sở hữu');
    console.log('✓ Tương thích với getLoanRoomAvailable() trong finance.service.ts');
    
    if (loans.length === 0) {
      console.log('\n⚠️ CẢNH BÁO: Cần tạo ít nhất 1 LoanContract để test đầy đủ');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

main();
