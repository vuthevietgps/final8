/**
 * Create test user and get JWT token
 */

const fetch = require('node-fetch');
const API_BASE = 'http://localhost:3000';

async function createTestUserAndLogin() {
  try {
    console.log('=== CREATE TEST USER & LOGIN ===\n');
    
    const testUser = {
      email: 'test@fanpage.com',
      password: 'test123',
      role: 'director',
      fullName: 'Test User for Fanpage',
      phone: '0123456789'
    };
    
    // 1. Try to create user via auth/register
    console.log('1. Creating test user via auth/register...');
    const createResult = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    console.log('Create Status:', createResult.status);
    
    if (createResult.status === 201 || createResult.status === 200) {
      const userData = await createResult.json();
      console.log('✅ User created successfully');
      console.log('User ID:', userData._id);
    } else if (createResult.status === 400) {
      const error = await createResult.json();
      if (error.message && error.message.includes('Email đã tồn tại')) {
        console.log('ℹ️ User already exists, proceeding to login...');
      } else {
        console.log('❌ Create user error:', error);
        return;
      }
    } else {
      console.log('❌ Failed to create user');
      const error = await createResult.text();
      console.log('Error:', error);
      return;
    }
    
    // 2. Login to get JWT
    console.log('\n2. Logging in to get JWT token...');
    const loginResult = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    
    console.log('Login Status:', loginResult.status);
    
    if (loginResult.ok) {
      const loginData = await loginResult.json();
      const token = loginData.access_token;
      console.log('✅ Login successful!');
      console.log('🎫 JWT Token:', token);
      
      // 3. Test token with protected endpoint
      console.log('\n3. Testing token with protected endpoint...');
      const testResult = await fetch(`${API_BASE}/fanpages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Test Status:', testResult.status);
      
      if (testResult.ok) {
        const fanpages = await testResult.json();
        console.log('✅ Token works! Fanpages endpoint accessible');
        console.log('Fanpages found:', Array.isArray(fanpages) ? fanpages.length : 'Unknown');
        
        // Save token to file for later use
        const fs = require('fs');
        fs.writeFileSync('jwt-token.txt', token);
        console.log('💾 Token saved to jwt-token.txt');
        
        return token;
        
      } else {
        console.log('❌ Token test failed');
        const error = await testResult.text();
        console.log('Error:', error);
      }
      
    } else {
      console.log('❌ Login failed');
      const error = await loginResult.text();
      console.log('Error:', error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Auto-run
createTestUserAndLogin();