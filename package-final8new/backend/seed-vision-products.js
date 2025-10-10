/**
 * Seed sample products with Vision AI data to database
 * Run with: npm run seed:vision-products
 */

const { MongoClient } = require('mongodb');

// Sample products data
const sampleProducts = [
  {
    name: "iPhone 15 Pro Max",
    importPrice: 25000000,
    shippingCost: 200000,
    packagingCost: 100000,
    estimatedDeliveryDays: 3,
    status: "Hoạt động",
    images: [
      {
        url: "http://localhost:3000/uploads/samples/iphone-15-pro-max.jpg",
        description: "iPhone 15 Pro Max màu Titan Tự nhiên",
        isMainImage: true,
        uploadedAt: new Date(),
        aiAnalysis: {
          objects: ["điện thoại", "iphone", "smartphone"],
          colors: ["titan", "xám", "bạc"],
          features: ["camera pro", "titanium", "48mp", "usb-c"],
          keywords: ["iphone", "15", "pro", "max", "apple", "titanium", "camera"],
          confidence: 0.95
        }
      }
    ],
    searchKeywords: ["iphone", "15", "pro", "max", "apple", "titanium", "camera", "điện thoại"],
    aiDescription: "iPhone 15 Pro Max với khung Titanium cao cấp, camera Pro 48MP và chip A17 Pro mạnh mẽ",
    fanpageVariations: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "Laptop MacBook Air M2",
    importPrice: 22000000,
    shippingCost: 300000,
    packagingCost: 150000,
    estimatedDeliveryDays: 5,
    status: "Hoạt động",
    images: [
      {
        url: "http://localhost:3000/uploads/samples/macbook-air-m2.jpg",
        description: "MacBook Air M2 13 inch màu Midnight",
        isMainImage: true,
        uploadedAt: new Date(),
        aiAnalysis: {
          objects: ["laptop", "macbook", "computer"],
          colors: ["midnight", "đen", "xanh đậm"],
          features: ["m2 chip", "retina display", "magsafe", "thin design"],
          keywords: ["macbook", "air", "m2", "laptop", "apple", "midnight", "13inch"],
          confidence: 0.92
        }
      }
    ],
    searchKeywords: ["macbook", "air", "m2", "laptop", "apple", "midnight", "13inch", "máy tính"],
    aiDescription: "MacBook Air M2 13 inch với thiết kế siêu mỏng, chip M2 mạnh mẽ và thời lượng pin cả ngày",
    fanpageVariations: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "AirPods Pro 2",
    importPrice: 4500000,
    shippingCost: 50000,
    packagingCost: 30000,
    estimatedDeliveryDays: 2,
    status: "Hoạt động",
    images: [
      {
        url: "http://localhost:3000/uploads/samples/airpods-pro-2.jpg",
        description: "AirPods Pro thế hệ 2 với case sạc MagSafe",
        isMainImage: true,
        uploadedAt: new Date(),
        aiAnalysis: {
          objects: ["tai nghe", "airpods", "headphones"],
          colors: ["trắng", "white"],
          features: ["active noise cancelling", "magsafe", "wireless", "pro"],
          keywords: ["airpods", "pro", "2", "tai nghe", "apple", "anc", "magsafe"],
          confidence: 0.88
        }
      }
    ],
    searchKeywords: ["airpods", "pro", "2", "tai nghe", "apple", "anc", "magsafe", "không dây"],
    aiDescription: "AirPods Pro thế hệ 2 với chống ồn chủ động nâng cao và case sạc MagSafe tiện lợi",
    fanpageVariations: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

async function seedVisionProducts() {
  let client;
  
  try {
    // Connect to MongoDB (adjust connection string as needed)
    const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot-db';
    client = new MongoClient(connectionString);
    await client.connect();
    
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const productsCollection = db.collection('products');
    
    // Clear existing sample products
    await productsCollection.deleteMany({ 
      name: { $in: sampleProducts.map(p => p.name) } 
    });
    
    console.log('🗑️  Cleared existing sample products');
    
    // Insert new sample products
    const result = await productsCollection.insertMany(sampleProducts);
    
    console.log(`✅ Inserted ${result.insertedCount} sample products with Vision AI data`);
    
    // Verify insertion
    const count = await productsCollection.countDocuments({
      'images.aiAnalysis': { $exists: true }
    });
    
    console.log(`📊 Total products with AI analysis: ${count}`);
    
    // Show sample data
    console.log('\n=== INSERTED PRODUCTS ===');
    sampleProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   🧠 Keywords: ${product.searchKeywords.slice(0, 4).join(', ')}`);
      console.log(`   🎯 Confidence: ${(product.images[0].aiAnalysis.confidence * 100).toFixed(1)}%`);
    });
    
    console.log('\n🚀 Ready to test Vision AI features!');
    console.log('📝 Try these API calls:');
    console.log('   POST /products/find-similar');
    console.log('   POST /products/analyze-image');
    console.log('   GET /products/ai-stats');
    
  } catch (error) {
    console.error('❌ Error seeding products:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔐 Database connection closed');
    }
  }
}

// Run the seeding function
if (require.main === module) {
  seedVisionProducts().then(() => {
    console.log('✅ Seeding completed successfully!');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
}

module.exports = { seedVisionProducts };