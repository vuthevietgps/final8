/**
 * Script kiểm tra dữ liệu messaging metrics đã được lưu chưa
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

async function checkMessagingData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const AdvertisingCost = mongoose.model('AdvertisingCost', advertisingCostSchema);

    console.log('\n📊 Checking advertising costs with messaging metrics...');

    // Lấy tất cả records
    const costs = await AdvertisingCost.find({}).sort({ date: -1 }).limit(10);
    
    console.log(`Found ${costs.length} advertising cost records`);

    if (costs.length === 0) {
      console.log('❌ No advertising cost records found!');
      return;
    }

    // Kiểm tra có messaging metrics không
    let hasMessagingMetrics = 0;
    let hasImpressions = 0;
    let hasClicks = 0;
    let hasConversations = 0;

    console.log('\n📋 Sample records:');
    costs.slice(0, 5).forEach((record, index) => {
      console.log(`\n${index + 1}. Record ID: ${record._id}`);
      console.log(`   AdGroup ID: ${record.adGroupId}`);
      console.log(`   Date: ${record.date?.toISOString().slice(0,10)}`);
      console.log(`   Chi phí: ${record.spentAmount?.toLocaleString() || 0} VND`);
      console.log(`   CPM: ${record.cpm || 0}`);
      console.log(`   CPC: ${record.cpc || 0}`);
      
      // Kiểm tra messaging metrics
      console.log(`   --- Messaging Metrics ---`);
      console.log(`   Hiển thị: ${record.impressions?.toLocaleString() || 0}`);
      console.log(`   Click: ${record.clicks?.toLocaleString() || 0}`);
      console.log(`   Tiếp cận: ${record.reach?.toLocaleString() || 0}`);
      console.log(`   Hội thoại bắt đầu 7d: ${record.messagingConversationStarted7d || 0}`);
      console.log(`   Chi phí/Hội thoại FB: ${record.costPerMessagingConversation?.toLocaleString() || 0} VND`);
      console.log(`   Phản hồi đầu tiên: ${record.messagingFirstReply || 0}`);

      // Đếm metrics
      if (record.impressions > 0) hasImpressions++;
      if (record.clicks > 0) hasClicks++;
      if (record.messagingConversationStarted7d > 0) hasConversations++;
      if (record.impressions > 0 || record.clicks > 0 || record.messagingConversationStarted7d > 0) {
        hasMessagingMetrics++;
      }
    });

    console.log('\n📈 Statistics:');
    console.log(`- Total records: ${costs.length}`);
    console.log(`- Records with messaging metrics: ${hasMessagingMetrics}`);
    console.log(`- Records with impressions: ${hasImpressions}`);
    console.log(`- Records with clicks: ${hasClicks}`);
    console.log(`- Records with conversations: ${hasConversations}`);

    // Kiểm tra schema structure
    console.log('\n🔧 Schema structure check:');
    const sampleRecord = costs[0];
    const fields = Object.keys(sampleRecord.toObject());
    console.log('Available fields:', fields);

    const messagingFields = [
      'impressions', 'clicks', 'reach', 
      'messagingConversationStarted7d', 
      'costPerMessagingConversation', 
      'messagingFirstReply'
    ];

    console.log('\nMessaging fields status:');
    messagingFields.forEach(field => {
      const exists = fields.includes(field);
      console.log(`  ${field}: ${exists ? '✅ Present' : '❌ Missing'}`);
    });

    // Test API endpoint
    console.log('\n🌐 Testing API endpoint...');
    const axios = require('axios');
    
    try {
      const response = await axios.get('http://localhost:3000/api/advertising-cost', {
        timeout: 5000
      });
      
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const firstRecord = response.data[0];
        console.log('✅ API accessible');
        console.log('Sample API response fields:', Object.keys(firstRecord));
        
        // Kiểm tra messaging fields trong API response
        console.log('\nMessaging fields in API response:');
        messagingFields.forEach(field => {
          const exists = firstRecord.hasOwnProperty(field);
          const value = firstRecord[field];
          console.log(`  ${field}: ${exists ? '✅' : '❌'} ${exists ? `(${value})` : ''}`);
        });
      } else {
        console.log('⚠️ API returned empty or invalid data');
      }
    } catch (error) {
      console.log(`❌ API Error: ${error.message}`);
      console.log('Make sure backend server is running on port 3000');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkMessagingData();