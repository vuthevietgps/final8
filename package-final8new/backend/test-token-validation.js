/**
 * Quick test script to verify token validation logic
 */

// Test Facebook token validation logic (simulate the class)
class FacebookValidator {
  async validate(rawToken) {
    try {
      console.log(`Testing token: ${rawToken.substring(0, 10)}...`);
      
      // Validate token by calling Facebook Graph API
      const response = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${encodeURIComponent(rawToken)}`);
      const data = await response.json();
      
      console.log('Facebook API Response Status:', response.status);
      console.log('Facebook API Response Data:', JSON.stringify(data, null, 2));
      
      if (response.ok && data.id) {
        // Token is valid, get permissions
        try {
          const permResponse = await fetch(`https://graph.facebook.com/me/permissions?access_token=${encodeURIComponent(rawToken)}`);
          const permData = await permResponse.json();
          const scopes = permResponse.ok && permData.data ? 
            permData.data.filter(p => p.status === 'granted').map(p => p.permission) : [];
          
          return { 
            status: 'valid', 
            message: `Token hợp lệ cho ${data.name || data.id}`, 
            scopes 
          };
        } catch {
          return { 
            status: 'valid', 
            message: `Token hợp lệ cho ${data.name || data.id}`, 
            scopes: [] 
          };
        }
      } else if (data.error) {
        const errorCode = data.error.code;
        const errorMessage = data.error.message;
        
        if (errorCode === 190) {
          return { status: 'expired', message: `Token hết hạn: ${errorMessage}` };
        } else if (errorCode === 102 || errorCode === 2500) {
          return { status: 'invalid', message: `Token không hợp lệ: ${errorMessage}` };
        } else {
          return { status: 'invalid', message: `Lỗi Facebook API: ${errorMessage}` };
        }
      } else {
        return { status: 'invalid', message: 'Token không hợp lệ - không nhận được phản hồi từ Facebook' };
      }
    } catch (error) {
      return { 
        status: 'invalid', 
        message: `Lỗi kết nối Facebook API: ${error.message}` 
      };
    }
  }
}

// Test with different token types
async function testTokens() {
  const validator = new FacebookValidator();
  
  // Test 1: Invalid token (gibberish)
  console.log('\n=== Test 1: Invalid Token ===');
  const result1 = await validator.validate('*************gdfg');
  console.log('Result:', result1);
  
  // Test 2: Short invalid token
  console.log('\n=== Test 2: Short Invalid Token ===');
  const result2 = await validator.validate('abc123');
  console.log('Result:', result2);
  
  // Test 3: Empty token
  console.log('\n=== Test 3: Empty Token ===');
  const result3 = await validator.validate('');
  console.log('Result:', result3);
  
  // Test 4: Well-formatted but fake token
  console.log('\n=== Test 4: Fake Well-Formatted Token ===');
  const result4 = await validator.validate('EAABwzLixnjYBO1234567890abcdefghijklmnopqrstuvwxyz');
  console.log('Result:', result4);
}

// Run tests
testTokens().catch(console.error);