/**
 * Script tạo sample products với AI analysis data để test Vision AI system
 */
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dongbodulieu:dongbodulieu@cluster0.4bigi.mongodb.net/management_system';

// Sample products with AI-enhanced data
const sampleProducts = [
  {
    name: 'iPhone 15 Pro Max 256GB',
    categoryId: null, // Will be set dynamically
    importPrice: 25000000,
    shippingCost: 500000,
    packagingCost: 100000,
    estimatedDeliveryDays: 2,
    status: 'Hoạt động',
    images: [
      {
        url: 'https://cdn.tgdd.vn/Products/Images/42/299033/iphone-15-pro-max-blue-thumbnew-600x600.jpg',
        description: 'iPhone 15 Pro Max màu xanh titanium',
        isMainImage: true,
        uploadedAt: new Date(),
        aiAnalysis: {
          objects: ['iPhone', 'smartphone', 'điện thoại', 'Apple'],
          colors: ['xanh', 'titanium', 'xanh dương'],
          features: ['camera pro', 'màn hình super retina', 'chip A17 Pro', 'USB-C'],
          keywords: ['iphone', 'apple', '15 pro max', 'smartphone', 'camera', 'titanium'],
          confidence: 0.95
        }
      },
      {
        url: 'https://cdn.tgdd.vn/Products/Images/42/299033/iphone-15-pro-max-blue-2-600x600.jpg',
        description: 'Mặt lưng iPhone 15 Pro Max',
        isMainImage: false,
        uploadedAt: new Date(),
        aiAnalysis: {
          objects: ['iPhone', 'camera module', 'logo Apple'],
          colors: ['xanh titanium', 'đen'],
          features: ['camera 3 ống kính', 'flash LED', 'thiết kế cao cấp'],
          keywords: ['camera', 'apple logo', 'titanium', 'premium'],
          confidence: 0.88
        }
      }
    ],
    searchKeywords: ['iphone', 'apple', '15 pro max', 'smartphone', 'camera', 'titanium', 'xanh', 'điện thoại'],
    aiDescription: 'iPhone 15 Pro Max màu xanh titanium với hệ thống camera Pro tiên tiến, chip A17 Pro mạnh mẽ và thiết kế premium bền bỉ',
    fanpageVariations: [],
    notes: 'Sản phẩm flagship của Apple, camera chuyên nghiệp',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  
  {
    name: 'Samsung Galaxy S24 Ultra 512GB',
    categoryId: null,
    importPrice: 28000000,
    shippingCost: 500000,
    packagingCost: 120000,
    estimatedDeliveryDays: 1,
    status: 'Hoạt động',
    images: [
      {
        url: 'https://cdn.tgdd.vn/Products/Images/42/307174/samsung-galaxy-s24-ultra-grey-thumbnew-600x600.jpg',
        description: 'Samsung Galaxy S24 Ultra màu xám titanium',
        isMainImage: true,
        uploadedAt: new Date(),
        aiAnalysis: {
          objects: ['Samsung Galaxy', 'smartphone', 'điện thoại', 'S Pen'],
          colors: ['xám', 'titanium', 'đen'],
          features: ['S Pen', 'camera zoom', 'màn hình cong', 'thiết kế kim loại'],
          keywords: ['samsung', 'galaxy', 's24 ultra', 's pen', 'camera zoom', 'titanium'],
          confidence: 0.93
        }
      }
    ],
    searchKeywords: ['samsung', 'galaxy', 's24 ultra', 's pen', 'camera zoom', 'titanium', 'smartphone'],
    aiDescription: 'Samsung Galaxy S24 Ultra với S Pen tích hợp, camera zoom 100x và thiết kế titanium cao cấp',
    fanpageVariations: [],
    notes: 'Note series flagship, S Pen độc quyền',
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    name: 'MacBook Air M3 13 inch 256GB',
    categoryId: null,
    importPrice: 32000000,
    shippingCost: 800000,
    packagingCost: 200000,
    estimatedDeliveryDays: 3,
    status: 'Hoạt động',
    images: [
      {
        url: 'https://cdn.tgdd.vn/Products/Images/44/322096/macbook-air-13-inch-m3-2024-starlight-thumbnew-600x600.jpg',
        description: 'MacBook Air M3 màu starlight',
        isMainImage: true,
        uploadedAt: new Date(),
        aiAnalysis: {
          objects: ['MacBook', 'laptop', 'máy tính', 'Apple'],
          colors: ['vàng nhạt', 'starlight', 'bạc'],
          features: ['màn hình retina', 'bàn phím magic', 'trackpad lớn', 'thiết kế mỏng'],
          keywords: ['macbook', 'air', 'm3', 'laptop', 'apple', 'starlight', 'retina'],
          confidence: 0.91
        }
      }
    ],
    searchKeywords: ['macbook', 'air', 'm3', 'laptop', 'apple', 'máy tính', 'starlight', 'retina'],
    aiDescription: 'MacBook Air M3 13 inch màu starlight với hiệu năng vượt trội, thiết kế siêu mỏng nhẹ',
    fanpageVariations: [],
    notes: 'Laptop Apple mới nhất, chip M3 mạnh mẽ',
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    name: 'AirPods Pro 2nd Generation USB-C',
    categoryId: null,
    importPrice: 6500000,
    shippingCost: 200000,
    packagingCost: 50000,
    estimatedDeliveryDays: 1,
    status: 'Hoạt động',
    images: [
      {
        url: 'https://cdn.tgdd.vn/Products/Images/54/289781/airpods-pro-2nd-generation-usb-c-thumbnew-600x600.jpg',
        description: 'AirPods Pro gen 2 với case USB-C',
        isMainImage: true,
        uploadedAt: new Date(),
        aiAnalysis: {
          objects: ['AirPods', 'tai nghe', 'case sạc', 'earbuds'],
          colors: ['trắng', 'white'],
          features: ['chống ồn active', 'spatial audio', 'USB-C', 'trong suốt'],
          keywords: ['airpods', 'pro', 'tai nghe', 'apple', 'usb-c', 'chống ồn'],
          confidence: 0.89
        }
      }
    ],
    searchKeywords: ['airpods', 'pro', 'tai nghe', 'apple', 'usb-c', 'chống ồn', 'wireless'],
    aiDescription: 'AirPods Pro thế hệ 2 với chống ồn chủ động, âm thanh spatial và case USB-C tiện lợi',
    fanpageVariations: [],
    notes: 'Tai nghe cao cấp, chống ồn tốt nhất',
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    name: 'iPad Pro 12.9 inch M2 Wi-Fi 128GB',
    categoryId: null,
    importPrice: 25000000,
    shippingCost: 600000,
    packagingCost: 150000,
    estimatedDeliveryDays: 2,
    status: 'Hoạt động',
    images: [
      {
        url: 'https://cdn.tgdd.vn/Products/Images/522/289881/ipad-pro-12-9-inch-m2-wifi-xam-thumbnew-600x600.jpg',
        description: 'iPad Pro 12.9 inch M2 màu xám',
        isMainImage: true,
        uploadedAt: new Date(),
        aiAnalysis: {
          objects: ['iPad', 'tablet', 'máy tính bảng', 'Apple'],
          colors: ['xám', 'space gray', 'đen'],
          features: ['màn hình liquid retina', 'chip M2', 'camera pro', 'USB-C'],
          keywords: ['ipad', 'pro', 'tablet', 'm2', 'apple', '12.9 inch', 'xám'],
          confidence: 0.94
        }
      }
    ],
    searchKeywords: ['ipad', 'pro', 'tablet', 'm2', 'apple', '12.9', 'màn hình lớn', 'xám'],
    aiDescription: 'iPad Pro 12.9 inch với chip M2 mạnh mẽ, màn hình Liquid Retina siêu sắc nét cho công việc chuyên nghiệp',
    fanpageVariations: [],
    notes: 'Tablet cao cấp nhất, thay thế laptop',
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    name: 'Apple Watch Series 9 GPS 45mm',
    categoryId: null,
    importPrice: 10500000,
    shippingCost: 300000,
    packagingCost: 80000,
    estimatedDeliveryDays: 2,
    status: 'Hoạt động',
    images: [
      {
        url: 'https://cdn.tgdd.vn/Products/Images/7077/309736/apple-watch-series-9-gps-45mm-midnight-aluminum-thumbnew-600x600.jpg',
        description: 'Apple Watch Series 9 màu midnight aluminum',
        isMainImage: true,
        uploadedAt: new Date(),
        aiAnalysis: {
          objects: ['Apple Watch', 'đồng hồ thông minh', 'smartwatch', 'dây đeo'],
          colors: ['đen', 'midnight', 'aluminum'],
          features: ['màn hình always-on', 'GPS', 'theo dõi sức khỏe', 'chống nước'],
          keywords: ['apple watch', 'series 9', 'smartwatch', 'gps', '45mm', 'midnight'],
          confidence: 0.92
        }
      }
    ],
    searchKeywords: ['apple watch', 'series 9', 'smartwatch', 'đồng hồ', 'gps', '45mm', 'midnight', 'sức khỏe'],
    aiDescription: 'Apple Watch Series 9 GPS 45mm màu midnight với chip S9 mạnh mẽ, theo dõi sức khỏe toàn diện',
    fanpageVariations: [],
    notes: 'Smartwatch cao cấp, theo dõi sức khỏe tốt',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

async function createSampleProducts() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    
    // Get or create category
    let category = await db.collection('productcategories').findOne({ name: 'Điện tử' });
    if (!category) {
      const categoryResult = await db.collection('productcategories').insertOne({
        name: 'Điện tử',
        description: 'Các sản phẩm công nghệ và điện tử',
        color: '#007bff',
        icon: '📱',
        code: 'ELECTRONICS',
        productCount: 0,
        notes: 'Danh mục sản phẩm công nghệ',
        order: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      category = { _id: categoryResult.insertedId };
    }

    // Update products with category ID
    const productsToInsert = sampleProducts.map(product => ({
      ...product,
      categoryId: category._id
    }));

    // Check if products already exist
    const existingCount = await db.collection('products').countDocuments({
      name: { $in: sampleProducts.map(p => p.name) }
    });

    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing products. Skipping insertion to avoid duplicates.`);
      console.log('Delete existing products first if you want to recreate them.');
      return;
    }

    // Insert products
    const result = await db.collection('products').insertMany(productsToInsert);
    console.log(`✅ Created ${result.insertedCount} sample products with AI analysis data`);

    // Update category product count
    const productCount = await db.collection('products').countDocuments({ categoryId: category._id });
    await db.collection('productcategories').updateOne(
      { _id: category._id },
      { 
        $set: { 
          productCount: productCount,
          updatedAt: new Date()
        }
      }
    );

    console.log('✅ Updated category product count');

    // Display created products
    console.log('\n📦 Created Products:');
    productsToInsert.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   💰 Price: ${product.importPrice.toLocaleString()}đ`);
      console.log(`   🔍 Keywords: ${product.searchKeywords.slice(0, 5).join(', ')}`);
      console.log(`   🖼️  Images: ${product.images.length}`);
      console.log(`   🤖 AI Analysis: ${product.images[0].aiAnalysis.confidence * 100}% confidence`);
      console.log('');
    });

    console.log('\n🎯 Summary:');
    console.log(`   Total products: ${productsToInsert.length}`);
    console.log(`   Total images: ${productsToInsert.reduce((sum, p) => sum + p.images.length, 0)}`);
    console.log(`   Total keywords: ${productsToInsert.reduce((sum, p) => sum + p.searchKeywords.length, 0)}`);
    console.log(`   Avg confidence: ${(productsToInsert.reduce((sum, p) => sum + p.images[0].aiAnalysis.confidence, 0) / productsToInsert.length * 100).toFixed(1)}%`);

    console.log('\n🧪 Test the API endpoints:');
    console.log('   POST /products/find-similar');
    console.log('   GET /products/ai-stats');
    console.log('   POST /products/analyze-image');

  } catch (error) {
    console.error('❌ Error creating sample products:', error);
  } finally {
    await client.close();
    console.log('📊 Database connection closed');
  }
}

// Export for usage as module or run directly
if (require.main === module) {
  createSampleProducts().catch(console.error);
}

module.exports = { createSampleProducts, sampleProducts };