#!/usr/bin/env node

/**
 * Test script for the email embedding API endpoint
 * Run with: node test-email-embedding-api.js
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3002';
const TEST_USER_ID = 'test-user-email-embedding';

async function testEmailEmbeddingAPI() {
  console.log('🧪 Testing Email Embedding API Endpoint...\n');

  // Test 1: Test with missing user ID
  console.log('📋 Test 1: Missing User ID');
  try {
    const response = await fetch(`${API_BASE_URL}/api/email-embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    
    if (response.status === 401 && result.code === 'MISSING_USER_ID') {
      console.log('✅ Correctly rejected request without user ID');
    } else {
      console.log('❌ Unexpected response for missing user ID:', result);
    }
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }

  console.log('');

  // Test 2: Test with user ID in header
  console.log('📋 Test 2: User ID in Header');
  try {
    const response = await fetch(`${API_BASE_URL}/api/email-embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify({})
    });

    const result = await response.json();
    console.log(`Response Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(result, null, 2));

    if (result.success !== undefined) {
      console.log('✅ API endpoint is responding correctly');
    } else {
      console.log('❌ Unexpected response format');
    }
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }

  console.log('');

  // Test 3: Test with user ID in body
  console.log('📋 Test 3: User ID in Body');
  try {
    const response = await fetch(`${API_BASE_URL}/api/email-embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: TEST_USER_ID
      })
    });

    const result = await response.json();
    console.log(`Response Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(result, null, 2));

    if (result.success !== undefined) {
      console.log('✅ API endpoint accepts user ID in body');
    } else {
      console.log('❌ Unexpected response format');
    }
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }

  console.log('');

  // Test 4: Test health check
  console.log('📋 Test 4: Health Check');
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const result = await response.json();
    
    if (response.status === 200 && result.status === 'ok') {
      console.log('✅ Backend server is running');
    } else {
      console.log('❌ Backend server health check failed');
    }
  } catch (error) {
    console.error('❌ Backend server is not accessible:', error.message);
    console.log('💡 Make sure to start the backend server with: npm run dev');
  }

  console.log('\n🏁 Email Embedding API tests completed!');
  console.log('\n💡 To test with real Gmail integration:');
  console.log('   1. Start the backend server: npm run dev');
  console.log('   2. Ensure user has Gmail connected via Composio');
  console.log('   3. Set SUPERMEMORY_API_KEY in environment');
  console.log('   4. Call the API with a real user ID');
}

// Run the tests
testEmailEmbeddingAPI().catch(console.error); 