/**
 * Script kiểm tra Facebook Access Token và các tài khoản quảng cáo
 */
const axios = require('axios');
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';
const FB_TOKEN = 'EAALpkpYobJ8BP2d4EyMqWk7Ua9P3yvOhH6dbIYylCL6cSk4yAvjQX294Km2Hf9ZCiouKqnJlIcUZCHkzz0qfvKjQiRo4x9mKHec1tk6yhRCaVYu0UKCBZCxCZBgavrFtXWJyoYql26iY9z5WcwMZAuHu49S429Eb5XsZCQ934woMrwqjpjJBgDSsuYVaD2ZA7tjRtXjyl5TRyWuL9C4jWrUfi7mUQPtEglRCucKN7AT';

// Schemas
const apiTokenSchema = new mongoose.Schema({
  provider: String,
  token: String,
  status: String,
  isPrimary: Boolean,
  fanpageId: mongoose.Schema.Types.ObjectId,
  name: String,
  updatedAt: Date,
  createdAt: Date
}, { collection: 'api_tokens' });

const adGroupSchema = new mongoose.Schema({
  adGroupId: String,
  adAccountId: String,
  platform: String,
  isActive: Boolean,
  name: String
}, { collection: 'ad_groups' });

async function checkFacebookToken() {
  try {
    console.log('🔍 Checking Facebook Access Token...\n');

    // 1. Test token với Facebook Graph API
    console.log('1️⃣ Testing token with Facebook Graph API...');
    
    try {
      // Test basic token info
      const tokenInfoUrl = `https://graph.facebook.com/v19.0/me?access_token=${FB_TOKEN}`;
      const tokenResponse = await axios.get(tokenInfoUrl);
      console.log('✅ Token is valid!');
      console.log(`   User/Page: ${tokenResponse.data.name || tokenResponse.data.id}`);
      console.log(`   ID: ${tokenResponse.data.id}`);
    } catch (error) {
      console.log('❌ Token validation failed:');
      console.log(`   Error: ${error.response?.data?.error?.message || error.message}`);
      return;
    }

    // 2. Check token permissions
    console.log('\n2️⃣ Checking token permissions...');
    try {
      const permissionsUrl = `https://graph.facebook.com/v19.0/me/permissions?access_token=${FB_TOKEN}`;
      const permResponse = await axios.get(permissionsUrl);
      const permissions = permResponse.data?.data || [];
      
      console.log('   Permissions:');
      permissions.forEach(perm => {
        const status = perm.status === 'granted' ? '✅' : '❌';
        console.log(`   ${status} ${perm.permission}`);
      });

      // Check for required ads permissions
      const requiredPerms = ['ads_read', 'ads_management', 'business_management'];
      const hasAdsPerms = requiredPerms.some(perm => 
        permissions.find(p => p.permission === perm && p.status === 'granted')
      );
      
      if (hasAdsPerms) {
        console.log('✅ Token has ads-related permissions');
      } else {
        console.log('⚠️ Token may not have sufficient ads permissions');
      }
    } catch (error) {
      console.log('❌ Could not check permissions');
    }

    // 3. Try to get ad accounts accessible by this token
    console.log('\n3️⃣ Checking accessible Ad Accounts...');
    try {
      const adAccountsUrl = `https://graph.facebook.com/v19.0/me/adaccounts?access_token=${FB_TOKEN}`;
      const adAccountsResponse = await axios.get(adAccountsUrl);
      const adAccounts = adAccountsResponse.data?.data || [];
      
      console.log(`   Found ${adAccounts.length} accessible Ad Accounts:`);
      adAccounts.forEach((acc, index) => {
        console.log(`   ${index + 1}. ${acc.name} (${acc.id})`);
        console.log(`      Account ID: ${acc.account_id || 'N/A'}`);
        console.log(`      Status: ${acc.account_status || 'N/A'}`);
      });
    } catch (error) {
      console.log('❌ Could not get ad accounts:');
      console.log(`   Error: ${error.response?.data?.error?.message || error.message}`);
    }

    // 4. Connect to database and check current status
    console.log('\n4️⃣ Checking database status...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const ApiToken = mongoose.model('ApiToken', apiTokenSchema);
    const AdGroup = mongoose.model('AdGroup', adGroupSchema);

    // Check if token already exists in database
    const existingToken = await ApiToken.findOne({ 
      token: FB_TOKEN 
    });

    if (existingToken) {
      console.log('✅ Token already exists in database:');
      console.log(`   Name: ${existingToken.name}`);
      console.log(`   Status: ${existingToken.status}`);
      console.log(`   Primary: ${existingToken.isPrimary}`);
      console.log(`   Provider: ${existingToken.provider}`);
    } else {
      console.log('❌ Token NOT found in database');
      console.log('💡 You need to add this token to the system');
    }

    // 5. Check AdGroups and test with actual AdSet IDs
    console.log('\n5️⃣ Testing with current AdGroup IDs...');
    const adGroups = await AdGroup.find({ platform: 'facebook', isActive: true }).limit(3);
    
    if (adGroups.length === 0) {
      console.log('❌ No Facebook AdGroups found in database');
    } else {
      console.log(`Found ${adGroups.length} Facebook AdGroups. Testing first 3:`);
      
      for (const group of adGroups) {
        console.log(`\n   Testing AdSet: ${group.adGroupId}`);
        try {
          // Test basic adset info
          const adsetUrl = `https://graph.facebook.com/v19.0/${group.adGroupId}?fields=id,name,account_id,status&access_token=${FB_TOKEN}`;
          const adsetResponse = await axios.get(adsetUrl);
          console.log(`   ✅ AdSet accessible: ${adsetResponse.data.name || adsetResponse.data.id}`);
          console.log(`      Status: ${adsetResponse.data.status}`);
          console.log(`      Account: ${adsetResponse.data.account_id}`);

          // Test insights access
          const insightsUrl = `https://graph.facebook.com/v19.0/${group.adGroupId}/insights?fields=spend,impressions,clicks&date_preset=yesterday&access_token=${FB_TOKEN}`;
          const insightsResponse = await axios.get(insightsUrl);
          const insights = insightsResponse.data?.data || [];
          
          if (insights.length > 0) {
            console.log(`   ✅ Insights accessible: spend=${insights[0].spend}, impressions=${insights[0].impressions}`);
          } else {
            console.log(`   ⚠️ No insights data available for yesterday`);
          }
        } catch (error) {
          console.log(`   ❌ Error: ${error.response?.data?.error?.message || error.message}`);
        }
      }
    }

    // 6. Recommendations
    console.log('\n6️⃣ Recommendations:');
    
    if (!existingToken) {
      console.log('📝 To use this token, you need to:');
      console.log('   1. Add token to database via API or UI');
      console.log('   2. Set as active and primary');
      console.log('   3. Link to appropriate fanpages if needed');
      console.log('\n💡 Example API call:');
      console.log(`   POST /api/api-tokens`);
      console.log(`   Body: {`);
      console.log(`     "name": "Facebook Ads Token",`);
      console.log(`     "token": "${FB_TOKEN.substring(0, 20)}...",`);
      console.log(`     "provider": "facebook",`);
      console.log(`     "status": "active"`);
      console.log(`   }`);
    }

    console.log('\n🔧 Or set as environment variable:');
    console.log(`   FB_ADS_ACCESS_TOKEN="${FB_TOKEN}"`);

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n👋 Disconnected from MongoDB');
    }
  }
}

checkFacebookToken();