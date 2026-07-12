/**
 * Debug: Kiểm tra xem populate có lấy được product cost không
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function debugPopulate() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    // Get a test order with populate
    const order = await db.collection('testorder2').findOne({ testCase: { $exists: true } });
    
    if (!order) {
      console.log('❌ No test order found');
      return;
    }
    
    console.log('📦 Test Order (raw):');
    console.log(`   productId type: ${typeof order.productId}`);
    console.log(`   productId value: ${order.productId}\n`);
    
    // Get product directly
    const product = await db.collection('products').findOne({ _id: order.productId });
    
    if (!product) {
      console.log('❌ Product not found');
      return;
    }
    
    console.log('📦 Product (direct query):');
    console.log(`   name: ${product.name}`);
    console.log(`   importPrice: ${product.importPrice}`);
    console.log(`   shippingCost: ${product.shippingCost}`);
    console.log(`   packagingCost: ${product.packagingCost}`);
    console.log(`   → Total Cost: ${product.importPrice + product.shippingCost + product.packagingCost}\n`);
    
    // Simulate Mongoose populate
    const MongooseSchema = require('mongoose').Schema;
    const mongoose = require('mongoose');
    
    if (!mongoose.connection.readyState) {
      await mongoose.connect(MONGODB_URI);
    }
    
    const TestOrder2Schema = new MongooseSchema({
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }
    }, { collection: 'testorder2' });
    
    const ProductSchema = new MongooseSchema({
      name: String,
      importPrice: Number,
      shippingCost: Number,
      packagingCost: Number
    }, { collection: 'products' });
    
    const TestOrder2Model = mongoose.models.TestOrder2 || mongoose.model('TestOrder2', TestOrder2Schema);
    const ProductModel = mongoose.models.Product || mongoose.model('Product', ProductSchema);
    
    const populatedOrder = await TestOrder2Model
      .findOne({ testCase: { $exists: true } })
      .populate('productId', 'name importPrice shippingCost packagingCost')
      .lean();
    
    console.log('📦 Test Order (với populate):');
    console.log(`   productId type: ${typeof populatedOrder.productId}`);
    console.log(`   productId._id: ${populatedOrder.productId?._id}`);
    console.log(`   productId.name: ${populatedOrder.productId?.name}`);
    console.log(`   productId.importPrice: ${populatedOrder.productId?.importPrice}`);
    console.log(`   productId.shippingCost: ${populatedOrder.productId?.shippingCost}`);
    console.log(`   productId.packagingCost: ${populatedOrder.productId?.packagingCost}\n`);
    
    if (populatedOrder.productId) {
      const cost = (populatedOrder.productId.importPrice || 0) + 
                   (populatedOrder.productId.shippingCost || 0) + 
                   (populatedOrder.productId.packagingCost || 0);
      console.log(`✅ Populate WORKS! Total cost: ${cost}`);
    } else {
      console.log('❌ Populate FAILED');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

debugPopulate();
