const https = require('https');
const http = require('http');

const testWebhook = async () => {
  const webhookData = {
    object: 'page',
    entry: [{
      id: '841956248994132',
      time: Date.now(),
      messaging: [{
        sender: { id: '24776034528751852' },
        recipient: { id: '841956248994132' },
        timestamp: Date.now(),
        message: {
          mid: 'test_' + Date.now(),
          text: 'Test AI ngay bây giờ'
        }
      }]
    }]
  };

  const postData = JSON.stringify(webhookData);
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/webhook/messenger',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log('Response status:', res.statusCode);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Response:', data));
  });

  req.on('error', (error) => {
    console.error('Error:', error.message);
  });

  req.write(postData);
  req.end();
};

testWebhook();