/**
 * Script tạo dữ liệu mẫu cho Facebook advertising
 */
const mongoose = require('mongoose');

// Kết nối MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

// Schema cho ApiToken
const apiTokenSchema = new mongoose.Schema({
  provider: String,
  token: String,
  status: String,
  isPrimary: Boolean,
  updatedAt: Date,
  createdAt: Date
}, { collection: 'api_tokens' });

// Schema cho AdAccount
const adAccountSchema = new mongoose.Schema({
  _id: String,
  name: String,
  isActive: Boolean,
  accountType: String,
  currency: String,
  createdAt: Date,
  updatedAt: Date
}, { collection: 'ad_accounts' });

// Schema cho AdGroup
const adGroupSchema = new mongoose.Schema({
  adGroupId: String,
  adAccountId: String,
  name: String,
  platform: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}, { collection: 'ad_groups' });

// Schema cho AdvertisingCost
const advertisingCostSchema = new mongoose.Schema({
  adGroupId: String,
  date: Date,
  spentAmount: Number,
  cpm: Number,
  cpc: Number,
  frequency: Number,
  createdAt: Date,
  updatedAt: Date
}, { collection: 'advertising_costs' });

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const ApiToken = mongoose.model('ApiToken', apiTokenSchema);
    const AdAccount = mongoose.model('AdAccount', adAccountSchema);
    const AdGroup = mongoose.model('AdGroup', adGroupSchema);
    const AdvertisingCost = mongoose.model('AdvertisingCost', advertisingCostSchema);

    console.log('\n🏗️ Creating sample Facebook advertising data...');

    // 1. Tạo AdAccount mẫu
    const sampleAdAccounts = [
      {
        _id: 'act_123456789',
        name: 'Tài khoản quảng cáo chính',
        isActive: true,
        accountType: 'facebook',
        currency: 'VND',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: 'act_987654321', 
        name: 'Tài khoản quảng cáo phụ',
        isActive: true,
        accountType: 'facebook',
        currency: 'VND',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Xóa và tạo lại AdAccounts
    await AdAccount.deleteMany({ accountType: 'facebook' });
    const createdAccounts = await AdAccount.insertMany(sampleAdAccounts);
    console.log(`✅ Created ${createdAccounts.length} AdAccounts`);

    // 2. Tạo AdGroups mẫu (sử dụng ID từ hình ảnh)
    const sampleAdGroups = [
      {
        adGroupId: '120234808394010255',
        adAccountId: 'act_123456789',
        name: 'PHỤ HIỆU CHUẨN 24H',
        platform: 'facebook',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        adGroupId: '120231896551170766',
        adAccountId: 'act_123456789', 
        name: 'TKQC PHỤ HIỆU NGHĨA TÂN',
        platform: 'facebook',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        adGroupId: '120231631428830766',
        adAccountId: 'act_987654321',
        name: 'TKQC PHỤ HIỆU NGHĨA TÂN',  
        platform: 'facebook',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        adGroupId: '120233559622490455',
        adAccountId: 'act_123456789',
        name: 'TKQC THẾ TỬ DA NẴNG TQ',
        platform: 'facebook', 
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        adGroupId: '120233502783920455',
        adAccountId: 'act_987654321',
        name: 'TKQC THẾ TỬ DA NẴNG TQ',
        platform: 'facebook',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Xóa và tạo lại AdGroups Facebook
    await AdGroup.deleteMany({ platform: 'facebook' });
    const createdGroups = await AdGroup.insertMany(sampleAdGroups);
    console.log(`✅ Created ${createdGroups.length} AdGroups`);

    // 3. Tạo dữ liệu chi phí mẫu cho 5 ngày gần đây
    const costs = [];
    const today = new Date();
    
    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      sampleAdGroups.forEach((group, index) => {
        const baseCost = 100000 + (index * 50000); // Chi phí cơ bản khác nhau cho mỗi nhóm
        const randomFactor = 0.8 + Math.random() * 0.4; // Biến động 80%-120%
        
        costs.push({
          adGroupId: group.adGroupId,
          date: new Date(date.setHours(0, 0, 0, 0)),
          spentAmount: Math.round(baseCost * randomFactor),
          cpm: 30000 + Math.random() * 20000, // CPM từ 30k-50k
          cpc: 1200 + Math.random() * 800, // CPC từ 1.2k-2k
          frequency: 1 + Math.random() * 0.5, // Frequency từ 1-1.5
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });
    }

    // Xóa và tạo lại dữ liệu chi phí
    await AdvertisingCost.deleteMany({});
    const createdCosts = await AdvertisingCost.insertMany(costs);
    console.log(`✅ Created ${createdCosts.length} AdvertisingCost records`);

    // 4. Tạo mẫu ApiToken (không có token thật, chỉ để test cấu trúc)
    const sampleToken = {
      provider: 'facebook',
      token: 'EAAG...sample_token_here...', // Token mẫu
      status: 'inactive', // Đặt inactive vì không phải token thật
      isPrimary: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await ApiToken.deleteMany({ provider: 'facebook' });
    await ApiToken.create(sampleToken);
    console.log('✅ Created sample ApiToken (inactive)');

    // 5. Thống kê dữ liệu đã tạo
    console.log('\n📊 Summary of created data:');
    console.log(`- AdAccounts: ${await AdAccount.countDocuments({ accountType: 'facebook' })}`);
    console.log(`- AdGroups: ${await AdGroup.countDocuments({ platform: 'facebook' })}`);
    console.log(`- AdvertisingCosts: ${await AdvertisingCost.countDocuments()}`);
    console.log(`- ApiTokens (Facebook): ${await ApiToken.countDocuments({ provider: 'facebook' })}`);

    // 6. Tạo dữ liệu chat-message mẫu cho tính toán conversation cost
    const chatMessageSchema = new mongoose.Schema({
      senderId: String,
      text: String,
      timestamp: Date,
      isFromUser: Boolean,
      adGroupId: String, // Liên kết với adGroup
      conversationId: String
    }, { collection: 'chat_messages' });

    const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

    // Tạo các cuộc hội thoại mẫu
    const conversations = [];
    const conversationIds = [];
    
    for (let i = 0; i < 20; i++) {
      conversationIds.push(`conv_${Date.now()}_${i}`);
    }

    sampleAdGroups.forEach(group => {
      // Mỗi adGroup có 4 cuộc hội thoại
      for (let i = 0; i < 4; i++) {
        const convId = conversationIds[Math.floor(Math.random() * conversationIds.length)];
        const msgDate = new Date();
        msgDate.setDate(msgDate.getDate() - Math.floor(Math.random() * 7)); // Trong 7 ngày qua
        
        conversations.push({
          senderId: `user_${i}`,
          text: `Chào bạn, tôi quan tâm đến sản phẩm`,
          timestamp: msgDate,
          isFromUser: true,
          adGroupId: group.adGroupId,
          conversationId: convId
        });
      }
    });

    await ChatMessage.deleteMany({});
    const createdMessages = await ChatMessage.insertMany(conversations);
    console.log(`✅ Created ${createdMessages.length} ChatMessage records for conversation cost calculation`);

    console.log('\n🎉 Sample data creation completed!');
    console.log('\n⚠️  Note: To enable Facebook sync, you need to:');
    console.log('1. Get a valid Facebook Ads API token');
    console.log('2. Update the token in database or set FB_ADS_ACCESS_TOKEN environment variable');
    console.log('3. Update the AdGroup IDs with your actual Facebook AdSet IDs');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

main();
