/**
 * Quick Fanpage Test - No JWT Required
 * Tests basic API connectivity and data flow
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000';

async function quickTest() {
  console.log('=== QUICK FANPAGE CONNECTIVITY TEST ===\n');
  
  try {
    // 1. Test backend health
    console.log('1. Testing backend health...');
    const healthResult = await fetch(`${API_BASE}/health`);
    console.log('Health Status:', healthResult.status);
    if (healthResult.ok) {
      const data = await healthResult.json();
      console.log('Health Response:', data);
      console.log('✅ Backend is running');
    } else {
      console.log('❌ Backend health check failed');
      return;
    }
    
    // 2. Test API Tokens endpoint (no auth required for listing)
    console.log('\n2. Testing API Tokens endpoint...');
    const tokensResult = await fetch(`${API_BASE}/api-tokens`);
    console.log('Tokens Status:', tokensResult.status);
    
    if (tokensResult.ok) {
      const tokens = await tokensResult.json();
      console.log('✅ API Tokens endpoint working');
      console.log('Total tokens:', Array.isArray(tokens) ? tokens.length : 'Unknown');
      
      if (Array.isArray(tokens) && tokens.length > 0) {
        const sample = tokens[0];
        console.log('Sample token:', {
          name: sample.name,
          provider: sample.provider,
          status: sample.status,
          lastCheckStatus: sample.lastCheckStatus,
          fanpageId: sample.fanpageId ? 'Has fanpage ID' : 'No fanpage ID'
        });
      }
    } else {
      console.log('⚠️ API Tokens endpoint requires auth');
    }
    
    // 3. Test Fanpages endpoint
    console.log('\n3. Testing Fanpages endpoint...');
    const fanpagesResult = await fetch(`${API_BASE}/fanpages`);
    console.log('Fanpages Status:', fanpagesResult.status);
    
    if (fanpagesResult.ok) {
      const fanpages = await fanpagesResult.json();
      console.log('✅ Fanpages endpoint working');
      console.log('Total fanpages:', Array.isArray(fanpages) ? fanpages.length : 'Unknown');
      
      if (Array.isArray(fanpages) && fanpages.length > 0) {
        const sample = fanpages[0];
        console.log('Sample fanpage:', {
          name: sample.name,
          pageId: sample.pageId,
          aiEnabled: sample.aiEnabled,
          accessToken: sample.accessToken, // Should be masked
          openAIConfigId: sample.openAIConfigId ? 'Has AI config' : 'No AI config'
        });
      }
    } else {
      console.log('⚠️ Fanpages endpoint requires auth');
    }
    
    // 4. Test OpenAI Configs endpoint
    console.log('\n4. Testing OpenAI Configs endpoint...');
    const configsResult = await fetch(`${API_BASE}/openai-configs`);
    console.log('Configs Status:', configsResult.status);
    
    if (configsResult.ok) {
      const configs = await configsResult.json();
      console.log('✅ OpenAI Configs endpoint working');
      console.log('Total configs:', Array.isArray(configs) ? configs.length : 'Unknown');
      
      if (Array.isArray(configs) && configs.length > 0) {
        const sample = configs[0];
        console.log('Sample config:', {
          name: sample.name,
          model: sample.model,
          scopeType: sample.scopeType,
          scopeRef: sample.scopeRef,
          isDefault: sample.isDefault
        });
      }
    } else {
      console.log('⚠️ OpenAI Configs endpoint requires auth');
    }
    
    // 5. Test MongoDB connection via any endpoint
    console.log('\n5. Testing database connectivity...');
    if (fanpagesResult.ok || tokensResult.ok || configsResult.ok) {
      console.log('✅ Database connection working (endpoints returned data)');
    } else {
      console.log('⚠️ Cannot verify database connection without auth');
    }
    
    console.log('\n=== TEST SUMMARY ===');
    console.log('✅ Basic connectivity test completed');
    console.log('📌 To test full CRUD operations, you need:');
    console.log('   1. Valid JWT token');
    console.log('   2. Proper permissions');
    console.log('   3. Run the comprehensive test: node test-fanpage-flow.js');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.log('💡 Make sure backend server is running on localhost:3000');
    console.log('💡 Check if MongoDB is connected');
  }
}

// Auto-run the test
quickTest();