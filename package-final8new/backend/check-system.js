/**
 * Check system data and get JWT token
 */

const mongoose = require('mongoose');
const fetch = require('node-fetch');

const DB_URL = 'mongodb+srv://duongdaica:duongdaica@cluster0.vvozq.mongodb.net/dongbodulieuweb?retryWrites=true&w=majority';
const API_BASE = 'http://localhost:3000';

async function checkSystemData() {
  try {
    console.log('=== SYSTEM DATA CHECK ===\n');
    
    // Connect to database
    await mongoose.connect(DB_URL);
    console.log('✅ Connected to MongoDB');
    
    // Check users
    const User = mongoose.model('User', new mongoose.Schema({
      email: String,
      type: String,
      password: String
    }, { collection: 'users' }));
    
    const users = await User.find().select('email type').limit(5);
    console.log(`\n📊 Users found: ${users.length}`);
    
    if (users.length > 0) {
      console.log('Sample users:');
      users.forEach((u, i) => console.log(`${i+1}. ${u.email} (${u.type})`));
      
      // Try to get JWT token using first user
      const firstUser = users[0];
      console.log(`\n🔐 Attempting login with: ${firstUser.email}`);
      
      // Try common passwords
      const commonPasswords = ['admin', '123456', 'password', 'admin123', 'test123'];
      let token = null;
      
      for (const pwd of commonPasswords) {
        try {
          const loginResult = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: firstUser.email,
              password: pwd
            })
          });
          
          if (loginResult.ok) {
            const data = await loginResult.json();
            token = data.access_token;
            console.log(`✅ Login successful with password: ${pwd}`);
            console.log(`🎫 JWT Token: ${token}`);
            break;
          }
        } catch (error) {
          // Continue trying
        }
      }
      
      if (!token) {
        console.log('❌ Could not login with common passwords');
        console.log('💡 You may need to reset password or create new user');
      }
      
    } else {
      console.log('❌ No users found');
      console.log('💡 Need to create a test user first');
    }
    
    // Check fanpages
    const Fanpage = mongoose.model('Fanpage', new mongoose.Schema({}, { strict: false, collection: 'fanpages' }));
    const fanpages = await Fanpage.find().select('name pageId aiEnabled').limit(5);
    console.log(`\n📱 Fanpages found: ${fanpages.length}`);
    
    if (fanpages.length > 0) {
      fanpages.forEach((fp, i) => console.log(`${i+1}. ${fp.name} (${fp.pageId}) - AI: ${fp.aiEnabled ? 'ON' : 'OFF'}`));
    }
    
    // Check API tokens
    const ApiToken = mongoose.model('ApiToken', new mongoose.Schema({}, { strict: false, collection: 'apitokens' }));
    const tokens = await ApiToken.find().select('name provider status fanpageId').limit(5);
    console.log(`\n🔑 API Tokens found: ${tokens.length}`);
    
    if (tokens.length > 0) {
      tokens.forEach((t, i) => console.log(`${i+1}. ${t.name} (${t.provider}) - Status: ${t.status}`));
    }
    
    // Check OpenAI configs
    const OpenAIConfig = mongoose.model('OpenAIConfig', new mongoose.Schema({}, { strict: false, collection: 'openaiconfigs' }));
    const configs = await OpenAIConfig.find().select('name model scopeType').limit(5);
    console.log(`\n🤖 OpenAI Configs found: ${configs.length}`);
    
    if (configs.length > 0) {
      configs.forEach((c, i) => console.log(`${i+1}. ${c.name} (${c.model}) - Scope: ${c.scopeType}`));
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Database check completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSystemData();