/**
 * Script cập nhật dữ liệu mẫu với messaging metrics mới
 */
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

const advertisingCostSchema = new mongoose.Schema({
  adGroupId: String,
  date: Date,
  spentAmount: Number,
  cpm: Number,
  cpc: Number,
  frequency: Number,
  // New messaging metrics
  impressions: Number,
  clicks: Number,
  reach: Number,
  messagingConversationStarted7d: Number,
  costPerMessagingConversation: Number,
  messagingFirstReply: Number,
  createdAt: Date,
  updatedAt: Date
}, { collection: 'advertising_costs' });

async function updateSampleData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const AdvertisingCost = mongoose.model('AdvertisingCost', advertisingCostSchema);

    console.log('\n🔄 Updating existing AdvertisingCost records with messaging metrics...');

    const existingCosts = await AdvertisingCost.find({});
    
    for (const cost of existingCosts) {
      const spentAmount = cost.spentAmount || 0;
      
      // Tạo metrics dựa trên chi phí hiện tại
      const impressions = Math.round(spentAmount * (20 + Math.random() * 10)); // 20-30x chi phí
      const clicks = Math.round(impressions * (0.01 + Math.random() * 0.02)); // CTR 1-3%
      const reach = Math.round(impressions * (0.6 + Math.random() * 0.3)); // Reach 60-90% impressions
      
      // Messaging metrics (chỉ có cho một số records)
      const hasMessagingObjective = Math.random() > 0.3; // 70% có messaging objective
      const messagingConversationStarted7d = hasMessagingObjective ? 
        Math.round(clicks * (0.05 + Math.random() * 0.15)) : 0; // 5-20% clicks thành conversation
      
      const costPerMessagingConversation = messagingConversationStarted7d > 0 ? 
        Math.round(spentAmount / messagingConversationStarted7d) : 0;
      
      const messagingFirstReply = Math.round(messagingConversationStarted7d * (0.7 + Math.random() * 0.3)); // 70-100% reply rate

      await AdvertisingCost.findByIdAndUpdate(cost._id, {
        impressions,
        clicks,
        reach,
        messagingConversationStarted7d,
        costPerMessagingConversation,
        messagingFirstReply,
        updatedAt: new Date()
      });
    }

    console.log(`✅ Updated ${existingCosts.length} AdvertisingCost records with messaging metrics`);

    // Hiển thị một vài record mẫu
    const sampleRecords = await AdvertisingCost.find({}).limit(3);
    
    console.log('\n📊 Sample updated records:');
    sampleRecords.forEach((record, index) => {
      console.log(`\n${index + 1}. AdGroup: ${record.adGroupId}`);
      console.log(`   Chi phí: ${record.spentAmount?.toLocaleString() || 0} VND`);
      console.log(`   Hiển thị: ${record.impressions?.toLocaleString() || 0}`);
      console.log(`   Click: ${record.clicks?.toLocaleString() || 0}`);
      console.log(`   Tiếp cận: ${record.reach?.toLocaleString() || 0}`);
      console.log(`   Hội thoại bắt đầu 7d: ${record.messagingConversationStarted7d || 0}`);
      console.log(`   Chi phí/Hội thoại FB: ${record.costPerMessagingConversation?.toLocaleString() || 0} VND`);
      console.log(`   Phản hồi đầu tiên: ${record.messagingFirstReply || 0}`);
      
      if (record.clicks && record.impressions) {
        const ctr = (record.clicks / record.impressions * 100).toFixed(2);
        console.log(`   CTR: ${ctr}%`);
      }
    });

    console.log('\n🎯 Messaging metrics được thêm thành công!');
    console.log('📋 Các trường mới đã được thêm vào:');
    console.log('- impressions: Số lượt hiển thị');
    console.log('- clicks: Số lượt click');  
    console.log('- reach: Số người tiếp cận');
    console.log('- messagingConversationStarted7d: Số hội thoại bắt đầu trong 7 ngày');
    console.log('- costPerMessagingConversation: Chi phí trên mỗi hội thoại (Facebook tính sẵn)');
    console.log('- messagingFirstReply: Số lượt phản hồi đầu tiên');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

updateSampleData();