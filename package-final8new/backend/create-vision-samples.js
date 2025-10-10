/**
 * Create sample products with local images for Vision AI testing
 * Simple script without MongoDB connection - just generates JSON data
 */

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
    fanpageVariations: [
      {
        fanpageId: "sample_fanpage_1",
        customName: "iPhone 15 Pro Max - Chính hãng VN/A",
        customDescription: "🔥 iPhone 15 Pro Max mới nhất 2024\n✅ Chính hãng VN/A\n🎁 Tặng kèm ốp lưng + cường lực",
        price: 29990000,
        isActive: true,
        priority: 10
      }
    ]
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
    fanpageVariations: [
      {
        fanpageId: "sample_fanpage_1",
        customName: "MacBook Air M2 2022 - Like New",
        customDescription: "💻 MacBook Air M2 13\" 2022\n🔋 Pin trâu cả ngày\n⚡ Chip M2 siêu nhanh\n📦 Fullbox như mới",
        price: 25990000,
        isActive: true,
        priority: 8
      }
    ]
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
    fanpageVariations: [
      {
        fanpageId: "sample_fanpage_1",
        customName: "AirPods Pro 2 - Chống ồn siêu việt",
        customDescription: "🎧 AirPods Pro Gen 2\n🔇 Chống ồn ANC cực đỉnh\n🔋 Case sạc MagSafe\n🎵 Âm thanh Hi-Fi",
        price: 5490000,
        isActive: true,
        priority: 7
      }
    ]
  },
  {
    name: "Samsung Galaxy S24 Ultra",
    importPrice: 24000000,
    shippingCost: 200000,
    packagingCost: 100000,
    estimatedDeliveryDays: 3,
    status: "Hoạt động",
    images: [
      {
        url: "http://localhost:3000/uploads/samples/galaxy-s24-ultra.jpg",
        description: "Samsung Galaxy S24 Ultra màu Titanium Gray với S Pen",
        isMainImage: true,
        uploadedAt: new Date(),
        aiAnalysis: {
          objects: ["điện thoại", "samsung", "smartphone", "s pen"],
          colors: ["titanium", "xám", "gray"],
          features: ["s pen", "200mp camera", "titanium frame", "ai features"],
          keywords: ["samsung", "galaxy", "s24", "ultra", "s pen", "camera", "titanium"],
          confidence: 0.94
        }
      }
    ],
    searchKeywords: ["samsung", "galaxy", "s24", "ultra", "s pen", "camera", "titanium", "điện thoại"],
    aiDescription: "Samsung Galaxy S24 Ultra với camera 200MP, S Pen tích hợp và khung Titanium cao cấp",
    fanpageVariations: [
      {
        fanpageId: "sample_fanpage_1",
        customName: "Galaxy S24 Ultra - Flagship Android",
        customDescription: "📱 Samsung Galaxy S24 Ultra\n📷 Camera 200MP siêu nét\n✏️ S Pen tích hợp\n🤖 AI Galaxy thông minh",
        price: 28990000,
        isActive: true,
        priority: 9
      }
    ]
  },
  {
    name: "Ốp lưng iPhone 15 Pro Max",
    importPrice: 150000,
    shippingCost: 20000,
    packagingCost: 10000,
    estimatedDeliveryDays: 1,
    status: "Hoạt động",
    images: [
      {
        url: "http://localhost:3000/uploads/samples/iphone-case-15pro.jpg",
        description: "Ốp lưng silicone iPhone 15 Pro Max màu xanh dương",
        isMainImage: true,
        uploadedAt: new Date(),
        aiAnalysis: {
          objects: ["ốp lưng", "case", "phụ kiện"],
          colors: ["xanh dương", "blue"],
          features: ["silicone", "chống sốc", "mềm mại", "bảo vệ"],
          keywords: ["ốp lưng", "iphone", "15", "pro", "max", "silicone", "case"],
          confidence: 0.85
        }
      }
    ],
    searchKeywords: ["ốp lưng", "iphone", "15", "pro", "max", "silicone", "case", "bảo vệ"],
    aiDescription: "Ốp lưng silicone mềm cho iPhone 15 Pro Max, chống sốc và bảo vệ toàn diện",
    fanpageVariations: [
      {
        fanpageId: "sample_fanpage_1",
        customName: "Ốp iPhone 15 Pro Max - Silicone Premium",
        customDescription: "🛡️ Ốp lưng iPhone 15 Pro Max\n🌊 Silicone mềm mịn\n💪 Chống sốc 4 góc\n🎨 Nhiều màu sắc",
        price: 299000,
        isActive: true,
        priority: 5
      }
    ]
  }
];

console.log('=== SAMPLE PRODUCTS WITH VISION AI DATA ===\n');

sampleProducts.forEach((product, index) => {
  console.log(`${index + 1}. ${product.name}`);
  console.log(`   💰 Giá nhập: ${product.importPrice.toLocaleString()}đ`);
  console.log(`   🖼️  Ảnh: ${product.images[0].url}`);
  console.log(`   🧠 AI Keywords: ${product.searchKeywords.slice(0, 5).join(', ')}`);
  console.log(`   📝 AI Description: ${product.aiDescription.slice(0, 80)}...`);
  console.log(`   🎯 Confidence: ${(product.images[0].aiAnalysis.confidence * 100).toFixed(1)}%`);
  console.log('');
});

console.log('\n=== VISION AI TESTING SCENARIOS ===');
console.log('1. 🔍 Search "iphone" → Should return iPhone 15 Pro Max');
console.log('2. 🔍 Search "laptop apple" → Should return MacBook Air M2');
console.log('3. 🔍 Search "tai nghe không dây" → Should return AirPods Pro 2');
console.log('4. 🔍 Search "samsung camera" → Should return Galaxy S24 Ultra');
console.log('5. 🔍 Search "ốp lưng bảo vệ" → Should return iPhone case');

console.log('\n=== API ENDPOINTS TO TEST ===');
console.log('POST /products/find-similar');
console.log('Body: { "query": "iphone", "fanpageId": "sample_fanpage_1", "limit": 3 }');
console.log('');
console.log('POST /products/analyze-image');
console.log('Body: { "imageUrl": "http://localhost:3000/uploads/samples/iphone-15-pro-max.jpg" }');
console.log('');
console.log('POST /products/upload-images');
console.log('Form-data: images=[file], fanpageId=sample_fanpage_1');

console.log('\n✅ Sample data generated successfully!');
console.log('📂 Place sample images in: backend/uploads/samples/');
console.log('🚀 Use these products to test Vision AI features');