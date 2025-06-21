/**
 * Integration test for Email Embedding Service
 * Tests the service connection and API integration
 */

const API_BASE_URL = 'http://localhost:3002/api';

async function testEmailEmbeddingService() {
  console.log('🧪 Testing Email Embedding Service Integration');
  console.log('=' .repeat(50));

  // Test 1: Health Check
  console.log('\n1️⃣ Testing health check...');
  try {
    const response = await fetch(`${API_BASE_URL}/email-embedding/status`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Health check passed:', data);
    } else {
      console.log('❌ Health check failed:', response.status, data);
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
  }

  // Test 2: API Endpoint Validation
  console.log('\n2️⃣ Testing API validation...');
  try {
    const response = await fetch(`${API_BASE_URL}/email-embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    
    if (response.status === 400 && data.code === 'VALIDATION_ERROR') {
      console.log('✅ Validation working correctly:', data.message);
    } else {
      console.log('❌ Unexpected validation response:', response.status, data);
    }
  } catch (error) {
    console.log('❌ Validation test error:', error.message);
  }

  // Test 3: Authentication Required
  console.log('\n3️⃣ Testing authentication requirement...');
  try {
    const response = await fetch(`${API_BASE_URL}/email-embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-123',
      },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    
    // We expect this to fail with Gmail connection issues, not auth issues
    if (response.status === 500 && data.details?.originalError?.includes('Gmail')) {
      console.log('✅ Authentication passed, Gmail connection expected error:', data.message);
    } else if (response.status === 401) {
      console.log('❌ Authentication failed unexpectedly:', data);
    } else {
      console.log('ℹ️  Unexpected response (may be OK):', response.status, data.message);
    }
  } catch (error) {
    console.log('❌ Authentication test error:', error.message);
  }

  // Test 4: Status Endpoint
  console.log('\n4️⃣ Testing status endpoint...');
  try {
    const response = await fetch(`${API_BASE_URL}/email-embedding/status/test-user-123`, {
      headers: {
        'x-user-id': 'test-user-123',
      },
    });
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Status endpoint working:', data);
    } else {
      console.log('ℹ️  Status endpoint response:', response.status, data);
    }
  } catch (error) {
    console.log('❌ Status endpoint error:', error.message);
  }

  console.log('\n🏁 Integration test completed!');
  console.log('=' .repeat(50));
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ with built-in fetch support');
  process.exit(1);
}

// Run the test
testEmailEmbeddingService().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
}); 