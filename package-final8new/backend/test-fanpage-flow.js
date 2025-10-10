/**
 * Comprehensive Fanpage Flow Test
 * Tests: Create -> Save -> Token Validation -> UI Display -> Message Processing
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZmFucGFnZS5jb20iLCJzdWIiOiI2OGUwYTA3ZTNiMjg0YmQxYTc1NmUyMzIiLCJyb2xlIjoiZGlyZWN0b3IiLCJuYW1lIjoiVGVzdCBVc2VyIGZvciBGYW5wYWdlIiwiaWF0IjoxNzU5NTUxNjE0LCJleHAiOjE3NTk2MzgwMTR9.61oc7444hANLxxI9uXD95InosPzKc_mz-iPV5rSxl5g';

// Test data
const testFanpage = {
  pageId: 'TEST123456789',
  name: 'Test Fanpage Auto',
  accessToken: 'EAATest123InvalidToken', // Invalid token for testing
  status: 'active',
  description: 'Test fanpage cho việc kiểm tra flow',
  greetingScript: 'Xin chào! Chúng tôi có thể hỗ trợ gì cho bạn?',
  aiEnabled: true,
  messageQuota: 1000,
  subscriberCount: 100
};

async function makeRequest(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JWT_TOKEN}`
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const result = await response.json();
  
  return {
    status: response.status,
    data: result
  };
}

async function testFanpageFlow() {
  console.log('=== COMPREHENSIVE FANPAGE FLOW TEST ===\n');
  
  let createdFanpageId = null;
  
  try {
    // 1. Test Create Fanpage
    console.log('1. Creating fanpage...');
    const createResult = await makeRequest('/fanpages', 'POST', testFanpage);
    console.log('Create Status:', createResult.status);
    console.log('Create Response:', JSON.stringify(createResult.data, null, 2));
    
    if (createResult.status === 201 || createResult.status === 200) {
      createdFanpageId = createResult.data._id;
      console.log('✅ Fanpage created successfully with ID:', createdFanpageId);
    } else {
      console.log('❌ Failed to create fanpage');
      return;
    }
    
    // 2. Test List Fanpages
    console.log('\n2. Listing fanpages...');
    const listResult = await makeRequest('/fanpages');
    console.log('List Status:', listResult.status);
    console.log('Total fanpages:', Array.isArray(listResult.data) ? listResult.data.length : 'Unknown');
    
    const ourFanpage = Array.isArray(listResult.data) ? 
      listResult.data.find(fp => fp._id === createdFanpageId) : null;
    
    if (ourFanpage) {
      console.log('✅ Our fanpage found in list');
      console.log('Fanpage data:', {
        name: ourFanpage.name,
        pageId: ourFanpage.pageId,
        aiEnabled: ourFanpage.aiEnabled,
        accessToken: ourFanpage.accessToken // Should be masked
      });
    } else {
      console.log('❌ Our fanpage not found in list');
    }
    
    // 3. Test API Token Sync (should auto-import from fanpage)
    console.log('\n3. Testing API token sync...');
    const syncResult = await makeRequest('/api-tokens/sync/from-fanpages', 'POST');
    console.log('Sync Status:', syncResult.status);
    console.log('Sync Response:', JSON.stringify(syncResult.data, null, 2));
    
    // 4. Test API Token List (should include our fanpage token)
    console.log('\n4. Listing API tokens...');
    const tokensResult = await makeRequest('/api-tokens');
    console.log('Tokens Status:', tokensResult.status);
    
    if (Array.isArray(tokensResult.data)) {
      const ourToken = tokensResult.data.find(t => t.fanpageId === createdFanpageId);
      if (ourToken) {
        console.log('✅ API token found for our fanpage');
        console.log('Token info:', {
          name: ourToken.name,
          provider: ourToken.provider,
          status: ourToken.status,
          lastCheckStatus: ourToken.lastCheckStatus,
          isPrimary: ourToken.isPrimary
        });
        
        // 5. Test Token Validation
        console.log('\n5. Testing token validation...');
        const validateResult = await makeRequest(`/api-tokens/${ourToken._id}/validate`, 'POST', {});
        console.log('Validation Status:', validateResult.status);
        console.log('Validation Response:', JSON.stringify(validateResult.data, null, 2));
        
        if (validateResult.status === 200) {
          console.log('✅ Token validation completed');
          console.log('Token Status:', validateResult.data.lastCheckStatus);
          console.log('Token Message:', validateResult.data.lastCheckMessage);
        } else {
          console.log('❌ Token validation failed');
        }
      } else {
        console.log('❌ API token not found for our fanpage');
      }
    }
    
    // 6. Test OpenAI Config Creation
    console.log('\n6. Testing OpenAI config creation...');
    const aiConfigResult = await makeRequest(`/fanpages/${createdFanpageId}/create-ai-config`, 'POST');
    console.log('AI Config Status:', aiConfigResult.status);
    console.log('AI Config Response:', JSON.stringify(aiConfigResult.data, null, 2));
    
    // 7. Test Update Fanpage
    console.log('\n7. Testing fanpage update...');
    const updateData = {
      description: 'Updated test fanpage description',
      aiEnabled: true,
      messageQuota: 2000
    };
    const updateResult = await makeRequest(`/fanpages/${createdFanpageId}`, 'PATCH', updateData);
    console.log('Update Status:', updateResult.status);
    console.log('Update Response:', JSON.stringify(updateResult.data, null, 2));
    
    // 8. Test Get Single Fanpage
    console.log('\n8. Testing get single fanpage...');
    const getResult = await makeRequest(`/fanpages/${createdFanpageId}`);
    console.log('Get Status:', getResult.status);
    console.log('Get Response:', JSON.stringify(getResult.data, null, 2));
    
    // 9. Test Webhook Simulation (Message Processing)
    console.log('\n9. Testing webhook message processing...');
    const webhookData = {
      object: 'page',
      entry: [{
        id: testFanpage.pageId,
        messaging: [{
          sender: { id: 'test_user_123' },
          recipient: { id: testFanpage.pageId },
          timestamp: Date.now(),
          message: {
            mid: 'test_message_id',
            text: 'Hello, I need help with your products'
          }
        }]
      }]
    };
    
    const webhookResult = await makeRequest('/webhook/messenger', 'POST', webhookData);
    console.log('Webhook Status:', webhookResult.status);
    console.log('Webhook Response:', JSON.stringify(webhookResult.data, null, 2));
    
    console.log('\n=== TEST SUMMARY ===');
    console.log('✅ All tests completed. Check individual results above.');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    // Cleanup: Delete test fanpage
    if (createdFanpageId) {
      console.log('\n10. Cleaning up test fanpage...');
      try {
        const deleteResult = await makeRequest(`/fanpages/${createdFanpageId}`, 'DELETE');
        console.log('Delete Status:', deleteResult.status);
        if (deleteResult.status === 200) {
          console.log('✅ Test fanpage deleted successfully');
        }
      } catch (cleanupError) {
        console.log('⚠️ Cleanup failed:', cleanupError.message);
      }
    }
  }
}

// Database validation queries (run separately in MongoDB shell)
const mongoQueries = `
// Check fanpage collection
db.fanpages.find({pageId: "TEST123456789"}).pretty()

// Check api tokens collection
db.apitokens.find({fanpageId: ObjectId("fanpage_id_here")}).pretty()

// Check chat messages collection
db.chatmessages.find({fanpageId: "fanpage_id_here"}).sort({createdAt: -1}).limit(5).pretty()

// Check conversations collection
db.conversations.find({fanpageId: ObjectId("fanpage_id_here")}).pretty()

// Check openai configs collection
db.openaiconfigs.find({scopeRef: "fanpage_id_here"}).pretty()
`;

console.log('MongoDB Validation Queries:');
console.log(mongoQueries);

// Run the test if this file is executed directly
if (require.main === module) {
  console.log('To run this test:');
  console.log('1. Make sure backend server is running on localhost:3000');
  console.log('2. Replace JWT_TOKEN with a valid token');
  console.log('3. Run: node test-fanpage-flow.js');
  console.log('\\nUncomment the line below to run automatically:');
  testFanpageFlow();
}

module.exports = { testFanpageFlow, mongoQueries };