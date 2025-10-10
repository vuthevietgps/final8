/**
 * Test script để tạo tin nhắn với Ad Group ID
 * Mô phỏng tin nhắn từ Facebook Ads với referral parameters
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://dongbodb:9nPJt6DFSuW4LpV@cluster0.scw0x.mongodb.net/dongbodulieu?retryWrites=true&w=majority';

// Schema definitions
const chatMessageSchema = new mongoose.Schema({
  fanpageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fanpage' },
  senderPsid: { type: String, required: true },
  content: { type: String, required: true },
  direction: { type: String, enum: ['in', 'out'], required: true },
  adGroupId: { type: String },
  awaitingHuman: { type: Boolean, default: false },
  receivedAt: { type: Date, default: Date.now },
  raw: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const conversationSchema = new mongoose.Schema({
  fanpageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fanpage' },
  senderPsid: { type: String, required: true },
  totalMessages: { type: Number, default: 0 },
  inboundCount: { type: Number, default: 0 },
  outboundCount: { type: Number, default: 0 },
  awaitingCount: { type: Number, default: 0 },
  lastMessageSnippet: String,
  lastDirection: { type: String, enum: ['in', 'out'] },
  lastMessageAt: Date,
  lastAdGroupId: String,
  hasAwaitingHuman: { type: Boolean, default: false },
  needsHuman: { type: Boolean, default: false },
  autoAiEnabled: { type: Boolean, default: true },
  orderDraftStatus: { type: String, enum: ['none','draft','awaiting','approved'], default: 'none' }
}, { timestamps: true });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);

async function createTestMessages() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create test messages with different Ad Group IDs
    const testMessages = [
      {
        fanpageId: '68dc963f6aae1be4065bde6',
        senderPsid: 'TEST_USER_001',
        content: 'Xin chào, tôi muốn mua sản phẩm này',
        direction: 'in',
        adGroupId: 'AG_12345',
        awaitingHuman: true,
        raw: {
          referral: {
            ref: 'ad_12345',
            source: 'ADS'
          }
        }
      },
      {
        fanpageId: '68dc963f6aae1be4065bde6',
        senderPsid: 'TEST_USER_002', 
        content: 'Em tên Linh, em ở Hà Nội, muốn đặt 2 sản phẩm',
        direction: 'in',
        adGroupId: 'AG_67890',
        awaitingHuman: true,
        raw: {
          referral: {
            ref: 'adset_67890',
            source: 'ADS'
          }
        }
      },
      {
        fanpageId: '68dc963f6aae1be4065bde6',
        senderPsid: 'TEST_USER_003',
        content: 'Chào shop, sản phẩm còn không?',
        direction: 'in',
        adGroupId: 'AG_99999',
        awaitingHuman: true,
        raw: {
          quick_reply: {
            payload: 'adgroup:99999'
          }
        }
      }
    ];

    // Delete existing test messages
    await ChatMessage.deleteMany({ senderPsid: { $in: ['TEST_USER_001', 'TEST_USER_002', 'TEST_USER_003'] } });
    await Conversation.deleteMany({ senderPsid: { $in: ['TEST_USER_001', 'TEST_USER_002', 'TEST_USER_003'] } });

    // Create new messages
    const createdMessages = await ChatMessage.insertMany(testMessages);
    console.log(`✅ Created ${createdMessages.length} test messages with Ad Group IDs`);

    // Create corresponding conversations with lastAdGroupId
    const conversations = testMessages.map(msg => ({
      fanpageId: msg.fanpageId,
      senderPsid: msg.senderPsid,
      totalMessages: 1,
      inboundCount: 1,
      outboundCount: 0,
      awaitingCount: 1,
      lastMessageSnippet: msg.content.slice(0, 120),
      lastDirection: msg.direction,
      lastMessageAt: new Date(),
      lastAdGroupId: msg.adGroupId,
      hasAwaitingHuman: true,
      needsHuman: true
    }));

    await Conversation.insertMany(conversations);
    console.log(`✅ Created ${conversations.length} test conversations with Ad Group data`);

    console.log('\n📋 Test Data Summary:');
    console.log('- TEST_USER_001: Ad Group AG_12345 (from referral ad_12345)');
    console.log('- TEST_USER_002: Ad Group AG_67890 (from referral adset_67890)'); 
    console.log('- TEST_USER_003: Ad Group AG_99999 (from quick_reply adgroup:99999)');
    console.log('\n🎯 You can now test the conversation list UI to see Ad Group badges!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

createTestMessages();