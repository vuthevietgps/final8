/**
 * Test Ad Group capture via HTTP API
 */

const baseUrl = 'http://localhost:3000';

async function testAdGroupCapture() {
  try {
    console.log('🧪 Testing Ad Group ID capture via API...\n');

    // Test messages with Ad Group IDs
    const testMessages = [
      {
        fanpageId: '68dc963f6aae1be4065bde6',
        senderPsid: 'TEST_AD_USER_001',
        content: 'Xin chào, tôi muốn mua sản phẩm từ quảng cáo',
        direction: 'in',
        adGroupId: 'AG_TEST_001',
        awaitingHuman: true
      },
      {
        fanpageId: '68dc963f6aae1be4065bde6', 
        senderPsid: 'TEST_AD_USER_002',
        content: 'Em tên Linh, ở Hà Nội, muốn đặt 2 sản phẩm, sđt: 0987654321',
        direction: 'in',
        adGroupId: 'AG_TEST_002',
        awaitingHuman: true
      }
    ];

    for(const msg of testMessages) {
      const response = await fetch(`${baseUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(msg)
      });

      if(response.ok) {
        const result = await response.json();
        console.log(`✅ Created message with Ad Group ${msg.adGroupId}:`, result._id);
      } else {
        console.log(`❌ Failed to create message: ${response.status}`);
      }
    }

    console.log('\n📋 Test messages created! Check the conversation list UI.');
    console.log('🎯 Expected Ad Group badges: AG_TEST_001, AG_TEST_002');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAdGroupCapture();