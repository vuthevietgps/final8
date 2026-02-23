const http = require('http');

// Step 1: Login
const loginData = JSON.stringify({ email: 'admin@dropshipping.com', password: '123456' });

const loginOptions = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

const loginReq = http.request(loginOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Login response status:', res.statusCode);
    try {
      const json = JSON.parse(data);
      if (json.access_token) {
        console.log('Login successful! Token obtained.');
        testUsersAPI(json.access_token);
      } else {
        console.log('Login failed:', json);
      }
    } catch (e) {
      console.log('Login response:', data);
    }
  });
});

loginReq.on('error', (e) => console.log('Login error:', e.message));
loginReq.write(loginData);
loginReq.end();

function testUsersAPI(token) {
  console.log('\n=== Testing Users API ===');
  
  // GET /api/users
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/users',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('GET /api/users - Status:', res.statusCode);
      try {
        const users = JSON.parse(data);
        console.log('Total users:', Array.isArray(users) ? users.length : 'N/A');
        if (Array.isArray(users) && users.length > 0) {
          console.log('First user:', { email: users[0].email, role: users[0].role, fullName: users[0].fullName });
        }
      } catch (e) {
        console.log('Response:', data.substring(0, 200));
      }
      
      // Test GET /api/salary-config
      testSalaryConfigAPI(token);
    });
  });

  req.on('error', (e) => console.log('Users API error:', e.message));
  req.end();
}

function testSalaryConfigAPI(token) {
  console.log('\n=== Testing Salary Config API ===');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/salary-config',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('GET /api/salary-config - Status:', res.statusCode);
      try {
        const configs = JSON.parse(data);
        console.log('Total configs:', Array.isArray(configs) ? configs.length : 'N/A');
        if (Array.isArray(configs) && configs.length > 0) {
          console.log('First config:', { 
            userId: configs[0].userId?._id || configs[0].userId, 
            userName: configs[0].userId?.fullName,
            hourlyRate: configs[0].hourlyRate 
          });
        }
      } catch (e) {
        console.log('Response:', data.substring(0, 200));
      }
      
      console.log('\n=== API Test Complete ===');
    });
  });

  req.on('error', (e) => console.log('Salary Config API error:', e.message));
  req.end();
}
