const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  console.log('📊 KIỂM TRA DỮ LIỆU TEST\n');
  
  // Kiểm tra Summary5
  const summary5s = await db.collection('summary5s').find({
    testOrder2Id: { $in: ['TEST-ORDER-001', 'TEST-ORDER-002', 'TEST-ORDER-003'] }
  }).toArray();
  console.log(`Summary5: ${summary5s.length} orders`);
  summary5s.forEach(o => {
    console.log(`  - ${o.testOrder2Id}: ${o.collectedRevenue?.toLocaleString() || 0} đ (${o.orderDate})`);
  });
  
  // Kiểm tra Loans
  const loans = await db.collection('loancontracts').find({
    loanCode: 'LOAN-TEST-001'
  }).toArray();
  console.log(`\nLoans: ${loans.length} khoản`);
  loans.forEach(l => {
    console.log(`  - ${l.loanCode}: Vay ${l.loanAmount?.toLocaleString()}, Trả ${l.totalRepaid?.toLocaleString()}`);
  });
  
  // Kiểm tra Cashflows
  const cashflows = await db.collection('cashflowentries').find({
    entryCode: { $in: ['CF-TEST-001', 'CF-TEST-002', 'CF-TEST-003'] }
  }).toArray();
  console.log(`\nCashflows: ${cashflows.length} giao dịch`);
  cashflows.forEach(c => {
    console.log(`  - ${c.entryCode}: ${c.type} ${c.amount?.toLocaleString()} đ (${c.entryDate})`);
  });
  
  await mongoose.connection.close();
}

main().catch(console.error);
