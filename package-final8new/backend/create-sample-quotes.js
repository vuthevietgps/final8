const mongoose = require('mongoose');

// Quote schema
const QuoteSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  price: { type: Number, required: true, min: 0 },
  status: { type: String, required: true },
  expiryDate: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  notes: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

async function createSampleQuotes() {
  // Connect to MongoDB
  await mongoose.connect('mongodb+srv://nhancanpham:Quan19111982@anhquan.9vkbp.mongodb.net/dongbodulieuweb?retryWrites=true&w=majority&appName=anhquan');
  console.log('Connected to MongoDB');
  
  const Quote = mongoose.model('Quote', QuoteSchema);
  
  // Xóa quotes cũ
  await Quote.deleteMany({});
  console.log('Cleared existing quotes');
  
  // Tạo sample quotes dựa trên các productId/agentId thực tế từ logs
  const sampleQuotes = [
    {
      productId: new mongoose.Types.ObjectId('68b7835cf402c3931acd7b35'), // Thẻ Tập Huấn 3 năm
      agentId: new mongoose.Types.ObjectId('68bfa75d2cbc0f781d9de469'), // Giấy Phép Vào Phố
      price: 230000,
      status: 'Đã duyệt',
      isActive: true,
      notes: 'Quote for Thẻ Tập Huấn 3 năm - Giấy Phép Vào Phố'
    },
    {
      productId: new mongoose.Types.ObjectId('68b7835cf402c3931acd7b35'), // Thẻ Tập Huấn 3 năm  
      agentId: new mongoose.Types.ObjectId('68bfae652cbc0f781d9de478'), // Mạnh Nguyễn
      price: 250000,
      status: 'Đã duyệt',
      isActive: true,
      notes: 'Quote for Thẻ Tập Huấn 3 năm - Mạnh Nguyễn'
    },
    {
      productId: new mongoose.Types.ObjectId('68b725607ec5d28a0d499d1e'), // Phù Hiệu Xe 3 Năm
      agentId: new mongoose.Types.ObjectId('68bfae652cbc0f781d9de478'), // Mạnh Nguyễn
      price: 180000,
      status: 'Đã duyệt',
      isActive: true,
      notes: 'Quote for Phù Hiệu Xe 3 Năm - Mạnh Nguyễn'
    },
    {
      productId: new mongoose.Types.ObjectId('68b7255f7ec5d28a0d499d12'), // Phù Hiệu Xe 7 năm
      agentId: new mongoose.Types.ObjectId('68bfae652cbc0f781d9de478'), // Mạnh Nguyễn
      price: 320000,
      status: 'Đã duyệt',
      isActive: true,
      notes: 'Quote for Phù Hiệu Xe 7 năm - Mạnh Nguyễn'
    },
    {
      productId: new mongoose.Types.ObjectId('68b7833df402c3931acd7b2e'), // Thẻ Tập Huấn 5 năm
      agentId: new mongoose.Types.ObjectId('68b9af7afb7a0875783bcf19'), // Trần Thị Vui
      price: 280000,
      status: 'Đã duyệt',
      isActive: true,
      notes: 'Quote for Thẻ Tập Huấn 5 năm - Trần Thị Vui'
    },
    {
      productId: new mongoose.Types.ObjectId('68b725607ec5d28a0d499d1e'), // Phù Hiệu Xe 3 Năm
      agentId: new mongoose.Types.ObjectId('68bfa2352cbc0f781d9de418'), // Nội Bộ
      price: 170000,
      status: 'Đã duyệt',
      isActive: true,
      notes: 'Quote for Phù Hiệu Xe 3 Năm - Nội Bộ'
    },
    {
      productId: new mongoose.Types.ObjectId('68bfd76fc56b6ca5c4bbe910'), // Thẻ Lái Xe
      agentId: new mongoose.Types.ObjectId('68bfae652cbc0f781d9de478'), // Mạnh Nguyễn
      price: 200000,
      status: 'Đã duyệt',
      isActive: true,
      notes: 'Quote for Thẻ Lái Xe - Mạnh Nguyễn'
    },
    {
      productId: new mongoose.Types.ObjectId('68b782a1f402c3931acd7b1c'), // Phù Hiệu Xe 1 Năm
      agentId: new mongoose.Types.ObjectId('68bfae652cbc0f781d9de478'), // Mạnh Nguyễn
      price: 120000,
      status: 'Đã duyệt',
      isActive: true,
      notes: 'Quote for Phù Hiệu Xe 1 Năm - Mạnh Nguyễn'
    }
  ];
  
  // Insert quotes
  const result = await Quote.insertMany(sampleQuotes);
  console.log(`Created ${result.length} sample quotes`);
  
  // Verify data
  const count = await Quote.countDocuments({ status: 'Đã duyệt' });
  console.log(`Total approved quotes: ${count}`);
  
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

createSampleQuotes().catch(console.error);