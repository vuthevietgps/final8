/**
 * Script migrate: Thêm poNumber cho các đơn nhập hàng cũ
 */
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: String,
  supplierId: mongoose.Schema.Types.ObjectId,
  status: String,
  items: [{}],
  createdAt: Date,
  updatedAt: Date
}, { collection: 'purchaseorders', timestamps: true });

async function migratePONumbers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Kết nối MongoDB thành công\n');

    const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

    // Tìm tất cả đơn không có poNumber
    const posWithoutNumber = await PurchaseOrder.find({ 
      poNumber: { $exists: false } 
    }).sort({ createdAt: 1 });

    if (posWithoutNumber.length === 0) {
      console.log('✅ Tất cả đơn hàng đã có poNumber.');
      process.exit(0);
    }

    console.log(`📦 Tìm thấy ${posWithoutNumber.length} đơn hàng cần cập nhật\n`);

    // Đếm số đơn đã có poNumber
    const maxPoNumber = await PurchaseOrder.findOne({ 
      poNumber: { $exists: true, $ne: null } 
    })
      .sort({ poNumber: -1 })
      .lean();

    let startNumber = 1;
    if (maxPoNumber?.poNumber) {
      // Extract số từ poNumber (VD: "PO-0005" -> 5)
      const match = maxPoNumber.poNumber.match(/\d+/);
      startNumber = match ? parseInt(match[0]) + 1 : 1;
    }

    console.log(`📊 Bắt đầu từ số: PO-${String(startNumber).padStart(4, '0')}\n`);

    let updated = 0;
    for (let i = 0; i < posWithoutNumber.length; i++) {
      const po = posWithoutNumber[i];
      const poNumber = `PO-${String(startNumber + i).padStart(4, '0')}`;
      
      await PurchaseOrder.updateOne(
        { _id: po._id },
        { poNumber }
      );
      
      console.log(`✅ ${poNumber} - Cập nhật thành công`);
      updated++;
    }

    console.log(`\n✨ Hoàn thành! Cập nhật ${updated} đơn hàng.\n`);

    // Hiển thị danh sách mới
    const allPos = await PurchaseOrder.find({})
      .select('poNumber createdAt')
      .sort({ createdAt: 1 })
      .limit(10);

    console.log('📋 Danh sách 10 đơn hàng mới nhất:\n');
    allPos.forEach((po, idx) => {
      console.log(`  ${idx + 1}. ${po.poNumber} (${po.createdAt.toLocaleDateString()})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

migratePONumbers();
