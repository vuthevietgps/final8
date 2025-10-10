// Test script để kiểm tra media backend functionality
const baseUrl = 'http://localhost:3000';

async function testMediaEndpoints() {
  console.log('Testing media endpoints...');
  
  try {
    // Test API endpoint
    console.log('\n1. Testing API endpoint: GET /api/media');
    const response = await fetch(`${baseUrl}/api/media`);
    console.log('Status:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.items && data.items.length > 0) {
        // Test static file access
        const firstItem = data.items[0];
        console.log('\n2. Testing static file access:', firstItem.url);
        
        const staticUrl = `${baseUrl}${firstItem.url}`;
        console.log('Full static URL:', staticUrl);
        
        const staticResponse = await fetch(staticUrl);
        console.log('Static file status:', staticResponse.status);
        console.log('Content-Type:', staticResponse.headers.get('content-type'));
        
        if (staticResponse.ok) {
          console.log('✅ Static file served successfully');
        } else {
          console.log('❌ Static file serving failed');
        }
      } else {
        console.log('No media items found in database');
      }
    } else {
      console.log('❌ API endpoint failed');
    }
  } catch (error) {
    console.error('Error testing endpoints:', error);
  }
}

testMediaEndpoints();