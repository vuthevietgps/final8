const http = require('http');

let authToken = null;

async function login() {
  return new Promise((resolve, reject) => {
    const loginData = JSON.stringify({ email: 'admin@dropshipping.com', password: '123456' });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.access_token) {
          authToken = json.access_token;
          resolve(authToken);
        } else {
          reject(new Error('Login failed: ' + JSON.stringify(json)));
        }
      });
    });

    req.on('error', reject);
    req.write(loginData);
    req.end();
  });
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      const bodyStr = JSON.stringify(body);
      req.setHeader('Content-Length', Buffer.byteLength(bodyStr));
      req.write(bodyStr);
    }
    req.end();
  });
}

async function runTests() {
  console.log('========================================');
  console.log('USER MANAGEMENT CRUD TEST');
  console.log('========================================\n');

  await login();
  console.log('✅ Login successful\n');

  // Test 1: GET all users
  console.log('--- Test 1: GET /api/users ---');
  let result = await request('GET', '/api/users');
  console.log('Status:', result.status, result.status === 200 ? '✅' : '❌');
  console.log('Total users:', Array.isArray(result.data) ? result.data.length : 'Error');

  // Test 2: GET users by role
  console.log('\n--- Test 2: GET /api/users?role=director ---');
  result = await request('GET', '/api/users?role=director');
  console.log('Status:', result.status, result.status === 200 ? '✅' : '❌');
  console.log('Directors found:', Array.isArray(result.data) ? result.data.length : 'Error');

  // Test 3: GET agents
  console.log('\n--- Test 3: GET /api/users/agents ---');
  result = await request('GET', '/api/users/agents');
  console.log('Status:', result.status, result.status === 200 ? '✅' : '❌');
  console.log('Agents found:', Array.isArray(result.data) ? result.data.length : 'Error');

  // Test 4: GET suppliers
  console.log('\n--- Test 4: GET /api/users/suppliers ---');
  result = await request('GET', '/api/users/suppliers');
  console.log('Status:', result.status, result.status === 200 ? '✅' : '❌');
  console.log('Suppliers found:', Array.isArray(result.data) ? result.data.length : 'Error');

  // Test 5: CREATE new user
  console.log('\n--- Test 5: POST /api/users (Create) ---');
  const newUser = {
    fullName: 'Test User CRUD ' + Date.now(),
    email: 'testcrud' + Date.now() + '@test.com',
    password: 'Test@123',
    phone: '0123456789',
    role: 'employee',
    isActive: true
  };
  result = await request('POST', '/api/users', newUser);
  console.log('Status:', result.status, result.status === 201 ? '✅' : '❌');
  const createdUserId = result.data?._id;
  console.log('Created user ID:', createdUserId || 'Error: ' + JSON.stringify(result.data));

  // Test 6: GET single user
  if (createdUserId) {
    console.log('\n--- Test 6: GET /api/users/:id ---');
    result = await request('GET', `/api/users/${createdUserId}`);
    console.log('Status:', result.status, result.status === 200 ? '✅' : '❌');
    console.log('User email:', result.data?.email);

    // Test 7: UPDATE user
    console.log('\n--- Test 7: PATCH /api/users/:id ---');
    result = await request('PATCH', `/api/users/${createdUserId}`, { fullName: 'Updated Test User' });
    console.log('Status:', result.status, result.status === 200 ? '✅' : '❌');
    console.log('Updated name:', result.data?.fullName);

    // Test 8: DELETE user
    console.log('\n--- Test 8: DELETE /api/users/:id ---');
    result = await request('DELETE', `/api/users/${createdUserId}`);
    console.log('Status:', result.status, result.status === 200 ? '✅' : '❌');
    console.log('Deleted user:', result.data?.email);
  }

  // Test Salary Config
  console.log('\n========================================');
  console.log('SALARY CONFIG CRUD TEST');
  console.log('========================================\n');

  // Test 9: GET all salary configs
  console.log('--- Test 9: GET /api/salary-config ---');
  result = await request('GET', '/api/salary-config');
  console.log('Status:', result.status, result.status === 200 ? '✅' : '❌');
  console.log('Total configs:', Array.isArray(result.data) ? result.data.length : 'Error');

  // Get a user ID for testing
  const usersResult = await request('GET', '/api/users');
  const testUserId = usersResult.data?.[0]?._id;

  if (testUserId) {
    // Test 10: CREATE/UPSERT salary config
    console.log('\n--- Test 10: POST /api/salary-config (Create/Upsert) ---');
    result = await request('POST', '/api/salary-config', {
      userId: testUserId,
      hourlyRate: 75000,
      notes: 'Test salary config'
    });
    console.log('Status:', result.status, [200, 201].includes(result.status) ? '✅' : '❌');
    const configId = result.data?._id;
    console.log('Config ID:', configId || 'Error');

    if (configId) {
      // Test 11: UPDATE salary config
      console.log('\n--- Test 11: PATCH /api/salary-config/:id ---');
      result = await request('PATCH', `/api/salary-config/${configId}`, { hourlyRate: 80000 });
      console.log('Status:', result.status, result.status === 200 ? '✅' : '❌');
      console.log('Updated rate:', result.data?.hourlyRate);

      // Test 12: UPDATE field
      console.log('\n--- Test 12: PATCH /api/salary-config/:id/field ---');
      result = await request('PATCH', `/api/salary-config/${configId}/field`, { notes: 'Updated notes' });
      console.log('Status:', result.status, result.status === 200 ? '✅' : '❌');
      console.log('Updated notes:', result.data?.notes);
    }
  }

  console.log('\n========================================');
  console.log('ALL TESTS COMPLETE');
  console.log('========================================');
}

runTests().catch(console.error);
