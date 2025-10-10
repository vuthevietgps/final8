/**
 * Simple Fanpage Test - Manual Step by Step
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZmFucGFnZS5jb20iLCJzdWIiOiI2OGUwYTA3ZTNiMjg0YmQxYTc1NmUyMzIiLCJyb2xlIjoiZGlyZWN0b3IiLCJuYW1lIjoiVGVzdCBVc2VyIGZvciBGYW5wYWdlIiwiaWF0IjoxNzU5NTUxNjE0LCJleHAiOjE3NTk2MzgwMTR9.61oc7444hANLxxI9uXD95InosPzKc_mz-iPV5rSxl5g';

// Test các endpoint một cách đơn giản
async function testEndpoint(endpoint, method = 'GET', data = null) {
  try {
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
    
    console.log(`\\n=== Testing ${method} ${endpoint} ===`);
    console.log('Request:', data ? JSON.stringify(data, null, 2) : 'No body');
    
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const result = await response.text(); // Use text first to avoid JSON parse errors
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    try {
      const jsonResult = JSON.parse(result);
      console.log('Response:', JSON.stringify(jsonResult, null, 2));
      return { status: response.status, data: jsonResult };
    } catch (e) {
      console.log('Response (text):', result);
      return { status: response.status, data: result };
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return { status: 'ERROR', data: error.message };
  }
}

async function runStepByStep() {
  console.log('=== STEP BY STEP FANPAGE TEST ===');
  
  // Step 1: Test health
  await testEndpoint('/health');
  
  // Step 2: List existing fanpages
  await testEndpoint('/fanpages');
  
  // Step 3: List existing tokens
  await testEndpoint('/api-tokens');
  
  // Step 4: Create test fanpage
  const testFanpage = {
    pageId: 'TEST_' + Date.now(),
    name: 'Test Fanpage Simple',
    accessToken: 'FAKE_TOKEN_' + Date.now(),
    status: 'active',
    description: 'Simple test fanpage'
  };
  
  const createResult = await testEndpoint('/fanpages', 'POST', testFanpage);
  
  if (createResult.status === 201 && createResult.data && createResult.data._id) {
    const fanpageId = createResult.data._id;
    console.log('\\n✅ Fanpage created with ID:', fanpageId);
    
    // Step 5: Get the created fanpage
    await testEndpoint(`/fanpages/${fanpageId}`);
    
    // Step 6: Try to create AI config
    await testEndpoint(`/fanpages/${fanpageId}/create-ai-config`, 'POST');
    
    // Step 7: Update fanpage
    await testEndpoint(`/fanpages/${fanpageId}`, 'PATCH', {
      description: 'Updated description',
      aiEnabled: true
    });
    
    // Step 8: Delete fanpage (cleanup)
    await testEndpoint(`/fanpages/${fanpageId}`, 'DELETE');
    
  } else {
    console.log('\\n❌ Failed to create fanpage, skipping further tests');
  }
  
  console.log('\\n=== TEST COMPLETED ===');
}

// Run the test
runStepByStep();