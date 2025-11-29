/**
 * Script để kiểm tra và debug vấn đề Facebook token và adset permissions
 */
const mongoose = require('mongoose');

// Kết nối MongoDB
const MONGODB_URI = 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';

// Schema cho ApiToken
const apiTokenSchema = new mongoose.Schema({
  provider: String,
  token: String,
  status: String,
  isPrimary: Boolean,
  updatedAt: Date,
  createdAt: Date
}, { collection: 'api_tokens' });

// Schema cho AdGroup
const adGroupSchema = new mongoose.Schema({
  adGroupId: String,
  adAccountId: String,
  platform: String,
  isActive: Boolean,
}, { collection: 'ad_groups' });

// Schema cho AdAccount
const adAccountSchema = new mongoose.Schema({
  _id: String,
  isActive: Boolean,
  accountType: String,
}, { collection: 'ad_accounts' });

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const ApiToken = mongoose.model('ApiToken', apiTokenSchema);
    const AdGroup = mongoose.model('AdGroup', adGroupSchema);
    const AdAccount = mongoose.model('AdAccount', adAccountSchema);

    // 1. Kiểm tra tokens Facebook
    console.log('\n🔑 Checking Facebook tokens:');
    const tokens = await ApiToken.find({ provider: 'facebook' }).sort({ isPrimary: -1, updatedAt: -1 });
    if (tokens.length === 0) {
      console.log('❌ No Facebook tokens found in database');
    } else {
      tokens.forEach((token, index) => {
        console.log(`${index + 1}. Status: ${token.status}, Primary: ${token.isPrimary}, Token: ${token.token ? token.token.substring(0, 20) + '...' : 'None'}`);
      });
    }

    // 2. Kiểm tra AdGroups Facebook
    console.log('\n📊 Checking Facebook AdGroups:');
    const adGroups = await AdGroup.find({ platform: 'facebook', isActive: true });
    console.log(`Found ${adGroups.length} active Facebook AdGroups`);
    
    if (adGroups.length > 0) {
      console.log('Sample AdGroups:');
      adGroups.slice(0, 5).forEach((group, index) => {
        console.log(`${index + 1}. ID: ${group.adGroupId}, AccountID: ${group.adAccountId}`);
      });
    }

    // 3. Kiểm tra AdAccounts
    console.log('\n🏢 Checking AdAccounts:');
    const accIds = [...new Set(adGroups.map(g => String(g.adAccountId)))];
    const adAccounts = await AdAccount.find({ _id: { $in: accIds }, isActive: true, accountType: 'facebook' });
    console.log(`Found ${adAccounts.length} active Facebook AdAccounts out of ${accIds.length} referenced`);

    if (adAccounts.length > 0) {
      console.log('Active AdAccounts:');
      adAccounts.forEach((acc, index) => {
        console.log(`${index + 1}. ID: ${acc._id}`);
      });
    }

    // 4. Lấy danh sách AdGroups hợp lệ (có adAccount active)
    const activeAccSet = new Set(adAccounts.map(a => String(a._id)));
    const validGroups = adGroups.filter(g => activeAccSet.has(String(g.adAccountId)));
    console.log(`\n✅ Valid AdGroups for sync: ${validGroups.length}`);

    if (validGroups.length > 0) {
      console.log('AdGroups that will be synced:');
      validGroups.slice(0, 10).forEach((group, index) => {
        console.log(`${index + 1}. AdSetID: ${group.adGroupId}, AccountID: ${group.adAccountId}`);
      });
    }

    // 5. Test FB API access (nếu có token)
    if (tokens.length > 0 && tokens[0].token && tokens[0].status === 'active') {
      console.log('\n🧪 Testing Facebook API access...');
      const axios = require('axios');
      const token = tokens[0].token;
      
      if (validGroups.length > 0) {
        const testAdsetId = validGroups[0].adGroupId;
        console.log(`Testing with AdSet ID: ${testAdsetId}`);
        
        try {
          // Test basic adset info
          const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(testAdsetId)}`;
          const params = {
            fields: 'id,name,account_id,campaign_id,status',
            access_token: token,
          };
          
          const response = await axios.get(url, { params });
          console.log('✅ AdSet accessible:', response.data);
          
          // Test insights access
          const insightsUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(testAdsetId)}/insights`;
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const dayISO = yesterday.toISOString().slice(0, 10);
          
          const insightsParams = {
            fields: 'spend,cpm,cpc,frequency',
            time_range: JSON.stringify({ since: dayISO, until: dayISO }),
            level: 'adset',
            access_token: token,
          };
          
          const insightsResponse = await axios.get(insightsUrl, { params: insightsParams });
          console.log('✅ Insights accessible:', insightsResponse.data);
          
        } catch (error) {
          console.log('❌ Facebook API Error:', error?.response?.data || error.message);
        }
      }
    } else {
      console.log('\n❌ No valid Facebook token found for testing');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

main();