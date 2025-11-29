/**
 * Script thêm Facebook token vào database và test sync
 */
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';
const FB_TOKEN = 'EAALpkpYobJ8BP2d4EyMqWk7Ua9P3yvOhH6dbIYylCL6cSk4yAvjQX294Km2Hf9ZCiouKqnJlIcUZCHkzz0qfvKjQiRo4x9mKHec1tk6yhRCaVYu0UKCBZCxCZBgavrFtXWJyoYql26iY9z5WcwMZAuHu49S429Eb5XsZCQ934woMrwqjpjJBgDSsuYVaD2ZA7tjRtXjyl5TRyWuL9C4jWrUfi7mUQPtEglRCucKN7AT';

const apiTokenSchema = new mongoose.Schema({
  provider: String,
  token: String,
  status: String,
  isPrimary: Boolean,
  name: String,
  updatedAt: Date,
  createdAt: Date
}, { collection: 'api_tokens' });

async function addTokenToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const ApiToken = mongoose.model('ApiToken', apiTokenSchema);

    // Check if token already exists
    const existingToken = await ApiToken.findOne({ token: FB_TOKEN });
    
    if (existingToken) {
      console.log('✅ Token already exists in database');
      console.log(`   ID: ${existingToken._id}`);
      console.log(`   Status: ${existingToken.status}`);
      return existingToken;
    }

    // Create new token
    const newToken = new ApiToken({
      name: 'Facebook Ads API Token - Active',
      token: FB_TOKEN,
      provider: 'facebook',
      status: 'active',
      isPrimary: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newToken.save();
    console.log('✅ Token added to database successfully!');
    console.log(`   ID: ${newToken._id}`);
    console.log(`   Name: ${newToken.name}`);
    console.log(`   Provider: ${newToken.provider}`);
    console.log(`   Status: ${newToken.status}`);
    console.log(`   Primary: ${newToken.isPrimary}`);

    return newToken;

  } catch (error) {
    console.error('❌ Error adding token:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Also add as environment variable temporarily
async function setEnvironmentVariable() {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    // Read existing .env file
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Check if FB_ADS_ACCESS_TOKEN already exists
    if (envContent.includes('FB_ADS_ACCESS_TOKEN=')) {
      // Replace existing token
      envContent = envContent.replace(
        /# FB_ADS_ACCESS_TOKEN=.*|FB_ADS_ACCESS_TOKEN=.*/g,
        `FB_ADS_ACCESS_TOKEN=${FB_TOKEN}`
      );
    } else {
      // Add new token
      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `FB_ADS_ACCESS_TOKEN=${FB_TOKEN}\n`;
    }
    
    // Write back to .env file
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Token added to .env file');
    console.log('⚠️ You need to restart the backend server to use the new token');
    
  } catch (error) {
    console.log('❌ Could not update .env file:', error.message);
  }
}

async function main() {
  console.log('🔧 Adding Facebook token to system...\n');
  
  // 1. Add to database
  console.log('1️⃣ Adding token to database...');
  await addTokenToDatabase();
  
  // 2. Add to environment file  
  console.log('\n2️⃣ Adding token to .env file...');
  await setEnvironmentVariable();
  
  console.log('\n✅ Token setup completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Restart backend server to load new token');
  console.log('2. Check Chi Phí Quảng Cáo sync');
  console.log('3. Monitor for successful data retrieval');
  console.log('\n🎯 Expected result:');
  console.log('- No more "FB insights error" messages');
  console.log('- Real messaging metrics from Facebook');
  console.log('- Updated cost per conversation data');
}

main().catch(console.error);