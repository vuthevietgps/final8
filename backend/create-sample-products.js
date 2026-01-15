/**
 * Script tạo sản phẩm mẫu để test
 */
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/smarterp-dev';

const productCategorySchema = new mongoose.Schema({
  name: String,
  description: String,
  color: String,
  icon: String,
  code: String,
  productCount: { type: Number, default: 0 },
  notes: String,
  order: Number,
  isActive: { type: Boolean, default: true },
  createdAt: Date,
  updatedAt: Date
}, { collection: 'productcategories', timestamps: true });

const productSchema = new mongoose.Schema({
  name: String,
  categoryId: mongoose.Schema.Types.ObjectId,
  importPrice: Number,
  shippingCost: Number,
  packagingCost: Number,
  minStock: { type: Number, default: 10 },
  maxStock: { type: Number, default: 100 },
  estimatedDeliveryDays: { type: Number, default: 0 },
  usageDurationMonths: { type: Number, default: 12 },
  status: { type: String, enum: ['Hoạt động', 'Tạm dừng'], default: 'Hoạt động' },
  color: { type: String, default: '#3B82F6' },
  notes: String,
  resourceLink: String,
  images: [{}],
  aiDescription: String,
  searchKeywords: [String],
  fanpageVariations: [{}],
  sku: { type: String, unique: true, sparse: true },
  totalCost: { type: Number, default: 0 },
  suppliers: [{}],
  createdAt: Date,
  updatedAt: Date
}, { collection: 'products', timestamps: true });

async function createSampleProducts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Kết nối MongoDB thành công\n');

    const ProductCategory = mongoose.model('ProductCategory', productCategorySchema);
    const Product = mongoose.model('Product', productSchema);

    // Lấy danh sách categories
    const categories = await ProductCategory.find({ isActive: true }).limit(5);
    if (categories.length === 0) {
      console.log('❌ Không tìm thấy category nào. Vui lòng tạo category trước.');
      process.exit(1);
    }

    console.log(`📦 Tìm thấy ${categories.length} category:\n`);
    categories.forEach((cat, i) => {
      console.log(`  ${i + 1}. ${cat.name} (ID: ${cat._id})`);
    });
    console.log('\n');

    // Dữ liệu sản phẩm mẫu
    const sampleProducts = [
      {
        name: 'iPhone 15 Pro Max',
        categoryId: categories[0]._id,
        importPrice: 25000000,
        shippingCost: 500000,
        packagingCost: 200000,
        minStock: 5,
        maxStock: 50,
        estimatedDeliveryDays: 7,
        usageDurationMonths: 24,
        color: '#000000',
        notes: 'Điện thoại cao cấp từ Apple',
        searchKeywords: ['iphone', 'điện thoại', 'apple', 'premium'],
        status: 'Hoạt động'
      },
      {
        name: 'Samsung Galaxy S24',
        categoryId: categories[0]._id,
        importPrice: 20000000,
        shippingCost: 500000,
        packagingCost: 200000,
        minStock: 5,
        maxStock: 50,
        estimatedDeliveryDays: 7,
        usageDurationMonths: 24,
        color: '#1f2937',
        notes: 'Điện thoại flagship Samsung',
        searchKeywords: ['samsung', 'điện thoại', 'android', 'galaxy'],
        status: 'Hoạt động'
      },
      {
        name: 'iPad Pro 12.9"',
        categoryId: categories[0]._id,
        importPrice: 18000000,
        shippingCost: 400000,
        packagingCost: 150000,
        minStock: 3,
        maxStock: 30,
        estimatedDeliveryDays: 7,
        usageDurationMonths: 24,
        color: '#6b7280',
        notes: 'Máy tính bảng Apple cao cấp',
        searchKeywords: ['ipad', 'máy tính bảng', 'apple', 'tablet'],
        status: 'Hoạt động'
      },
      {
        name: 'Sony WH-1000XM5 Headphones',
        categoryId: categories[0]._id,
        importPrice: 8000000,
        shippingCost: 200000,
        packagingCost: 100000,
        minStock: 10,
        maxStock: 100,
        estimatedDeliveryDays: 5,
        usageDurationMonths: 12,
        color: '#374151',
        notes: 'Tai nghe chống ồn cao cấp Sony',
        searchKeywords: ['tai nghe', 'headphones', 'sony', 'wireless'],
        status: 'Hoạt động'
      },
      {
        name: 'Apple Watch Series 9',
        categoryId: categories[0]._id,
        importPrice: 10000000,
        shippingCost: 150000,
        packagingCost: 80000,
        minStock: 8,
        maxStock: 80,
        estimatedDeliveryDays: 5,
        usageDurationMonths: 18,
        color: '#000000',
        notes: 'Đồng hồ thông minh Apple',
        searchKeywords: ['đồng hồ', 'watch', 'smartwatch', 'apple'],
        status: 'Hoạt động'
      },
      {
        name: 'MacBook Pro 14" M3',
        categoryId: categories[0]._id,
        importPrice: 45000000,
        shippingCost: 800000,
        packagingCost: 300000,
        minStock: 2,
        maxStock: 20,
        estimatedDeliveryDays: 10,
        usageDurationMonths: 36,
        color: '#1f2937',
        notes: 'Laptop cao cấp Apple với chip M3',
        searchKeywords: ['laptop', 'macbook', 'apple', 'máy tính'],
        status: 'Hoạt động'
      }
    ];

    // Tạo sản phẩm
    const createdProducts = [];
    for (const productData of sampleProducts) {
      // Kiểm tra sản phẩm đã tồn tại
      const existing = await Product.findOne({ name: productData.name });
      if (existing) {
        console.log(`⏭️  Sản phẩm "${productData.name}" đã tồn tại, bỏ qua.`);
        continue;
      }

      // Tính totalCost
      productData.totalCost = productData.importPrice + productData.shippingCost + productData.packagingCost;

      const product = new Product(productData);
      await product.save();
      createdProducts.push(product);
      console.log(`✅ Tạo sản phẩm: "${product.name}" (ID: ${product._id})`);
    }

    console.log(`\n✨ Hoàn thành! Tạo ${createdProducts.length} sản phẩm mới.\n`);

    // Hiển thị summary
    const totalProducts = await Product.countDocuments();
    console.log(`📊 Tổng số sản phẩm trong hệ thống: ${totalProducts}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

createSampleProducts();
