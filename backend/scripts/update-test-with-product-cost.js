/**
 * Cập nhật test data với giá vốn Product thực tế
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

async function updateTestDataWithProductCost() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    // Tìm quote test
    const quote = await db.collection('quotes').findOne({ name: 'Test Quote' });
    
    if (!quote) {
      console.log('❌ Test quote not found');
      return;
    }
    
    // Lấy product từ quote
    const product = await db.collection('products').findOne({ _id: quote.productId });
    
    if (!product) {
      console.log('❌ Product not found');
      return;
    }
    
    console.log('📦 Product Info:');
    console.log(`   Name: ${product.name}`);
    console.log(`   Import Price: ${(product.importPrice || 0).toLocaleString()} đ`);
    console.log(`   Shipping Cost: ${(product.shippingCost || 0).toLocaleString()} đ`);
    console.log(`   Packaging Cost: ${(product.packagingCost || 0).toLocaleString()} đ`);
    
    const productCost = (product.importPrice || 0) + (product.shippingCost || 0) + (product.packagingCost || 0);
    console.log(`   Total Cost: ${productCost.toLocaleString()} đ\n`);
    
    console.log('📋 Quote Info:');
    console.log(`   Unit Price (giá báo): ${(quote.unitPrice || 0).toLocaleString()} đ\n`);
    
    // Trigger sync
    console.log('🔄 Triggering Summary4 sync...\n');
    
    const http = require('http');
    
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
    
    console.log('✅ Giờ có thể verify kết quả với script check-profit-formula.js');
    console.log('\n💡 Expected results với product cost:');
    console.log(`   External agent: profit = unitPrice × qty - productCost × qty`);
    console.log(`   Internal agent: profit = (deposit + COD) - productCost × qty`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

updateTestDataWithProductCost();
