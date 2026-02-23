/**
 * Kiểm tra cấu trúc dữ liệu Product và Quote
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

async function checkProductAndQuote() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('    KIỂM TRA PRODUCT VÀ QUOTE');
    console.log('═══════════════════════════════════════════════════════\n');
    
    // 1. Sample Product
    console.log('📦 PRODUCT SCHEMA:\n');
    const product = await db.collection('products').findOne({});
    
    if (product) {
      console.log('Sample Product:');
      console.log(`  name: ${product.name}`);
      console.log(`  importPrice: ${(product.importPrice || 0).toLocaleString()} đ (Giá nhập)`);
      console.log(`  shippingCost: ${(product.shippingCost || 0).toLocaleString()} đ (Chi phí vận chuyển)`);
      console.log(`  packagingCost: ${(product.packagingCost || 0).toLocaleString()} đ (Chi phí đóng gói)`);
      
      const totalCost = (product.importPrice || 0) + (product.shippingCost || 0) + (product.packagingCost || 0);
      console.log(`  → TỔNG GIÁ VỐN: ${totalCost.toLocaleString()} đ\n`);
      
      console.log('💡 Ý nghĩa:');
      console.log('  - importPrice: Giá mua/sản xuất sản phẩm');
      console.log('  - shippingCost: Chi phí vận chuyển khi nhập');
      console.log('  - packagingCost: Chi phí đóng gói');
      console.log('  - Tổng = Chi phí để có được 1 sản phẩm\n');
    } else {
      console.log('❌ No products found\n');
    }
    
    // 2. Sample Quote
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 QUOTE SCHEMA:\n');
    
    const quote = await db.collection('quotes').findOne({});
    
    if (quote) {
      console.log('Sample Quote:');
      console.log(`  product: ${quote.product}`);
      console.log(`  agentName: ${quote.agentName}`);
      console.log(`  unitPrice: ${(quote.unitPrice || 0).toLocaleString()} đ`);
      console.log(`  status: ${quote.status}`);
      console.log(`  validFrom: ${quote.validFrom}`);
      console.log(`  validUntil: ${quote.validUntil}\n`);
      
      console.log('💡 Ý nghĩa:');
      console.log('  - unitPrice: Giá BÁN cho đại lý (theo báo giá)');
      console.log('  - Đây là giá mà đại lý phải TRẢ cho công ty');
      console.log('  - Quote có thể khác nhau cho từng đại lý\n');
      
      // So sánh với Product
      if (product && quote.productId) {
        const quoteProduct = await db.collection('products').findOne({ _id: quote.productId });
        
        if (quoteProduct) {
          const productCost = (quoteProduct.importPrice || 0) + (quoteProduct.shippingCost || 0) + (quoteProduct.packagingCost || 0);
          const margin = quote.unitPrice - productCost;
          const marginPercent = productCost > 0 ? (margin / productCost * 100) : 0;
          
          console.log('📊 SO SÁNH GIÁ VỐN VÀ GIÁ BÁN:\n');
          console.log(`Product: ${quoteProduct.name}`);
          console.log(`  Giá vốn (Product): ${productCost.toLocaleString()} đ`);
          console.log(`  Giá bán (Quote): ${quote.unitPrice.toLocaleString()} đ`);
          console.log(`  Lợi nhuận: ${margin.toLocaleString()} đ (${marginPercent.toFixed(1)}%)\n`);
        }
      }
    } else {
      console.log('❌ No quotes found\n');
    }
    
    // 3. Thống kê
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 THỐNG KÊ:\n');
    
    const productCount = await db.collection('products').countDocuments();
    const quoteCount = await db.collection('quotes').countDocuments();
    
    console.log(`Total Products: ${productCount}`);
    console.log(`Total Quotes: ${quoteCount}\n`);
    
    // Tìm products không có quotes
    const productsWithoutQuotes = await db.collection('products').aggregate([
      {
        $lookup: {
          from: 'quotes',
          localField: '_id',
          foreignField: 'productId',
          as: 'quotes'
        }
      },
      {
        $match: {
          quotes: { $size: 0 }
        }
      },
      {
        $project: {
          name: 1,
          importPrice: 1,
          shippingCost: 1,
          packagingCost: 1
        }
      },
      { $limit: 5 }
    ]).toArray();
    
    if (productsWithoutQuotes.length > 0) {
      console.log(`⚠️  Products without Quotes (${productsWithoutQuotes.length}):\n`);
      productsWithoutQuotes.forEach(p => {
        const cost = (p.importPrice || 0) + (p.shippingCost || 0) + (p.packagingCost || 0);
        console.log(`  - ${p.name}: cost = ${cost.toLocaleString()} đ`);
      });
      console.log('');
    }
    
    // 4. Kết luận
    console.log('═══════════════════════════════════════════════════════');
    console.log('    KẾT LUẬN');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('CẤU TRÚC DỮ LIỆU:');
    console.log('');
    console.log('1. PRODUCT (Sản phẩm):');
    console.log('   - importPrice: Giá nhập/sản xuất');
    console.log('   - shippingCost: Chi phí vận chuyển');
    console.log('   - packagingCost: Chi phí đóng gói');
    console.log('   → Tổng = GIÁ VỐN của sản phẩm');
    console.log('');
    console.log('2. QUOTE (Báo giá):');
    console.log('   - unitPrice: Giá bán cho đại lý');
    console.log('   - Mỗi đại lý có thể có giá khác nhau');
    console.log('   - unitPrice > giá vốn → có lợi nhuận');
    console.log('');
    console.log('3. SUMMARY4 (Báo cáo tài chính):');
    console.log('   - paidToCompanyAmount: DOANH THU');
    console.log('     + External: unitPrice × qty (từ Quote)');
    console.log('     + Internal: deposit + COD');
    console.log('   - mustPayAmount: CHI PHÍ GIÁ VỐN');
    console.log('     + (importPrice + shippingCost + packagingCost) × qty');
    console.log('     + Từ Product, KHÔNG phải Quote!');
    console.log('   - profit: doanh thu - chi phí');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

checkProductAndQuote();
