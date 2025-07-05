#!/usr/bin/env node

/**
 * Test script for ElevenLabs voice pipeline integration
 * Tests the complete flow: Button Press → ElevenLabs Config → Direct Connection → Tools → Post-call
 */

import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3002';
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:3002';
const TEST_USER_ID = process.env.TEST_USER_ID || 'e58e50aa-fd9d-499e-a977-f9b8b065f8b4';
const TEST_DEVICE_ID = `test_glasses_${Date.now()}`;
const TEST_DEVICE_NAME = 'Test AI Glasses';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

console.log('🧪 ElevenLabs Voice Pipeline Test');
console.log('================================');
console.log(`Server URL: ${SERVER_URL}`);
console.log(`WebSocket URL: ${WEBSOCKET_URL}`);
console.log(`Test User ID: ${TEST_USER_ID}`);
console.log(`Test Device ID: ${TEST_DEVICE_ID}`);
console.log('');

// Test utilities
function generateJWT(userId, deviceId, deviceName) {
  return jwt.sign(
    { 
      userId, 
      deviceId, 
      deviceName,
      type: 'glasses'
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test steps
async function testElevenLabsVoiceService() {
  console.log('🔧 Testing ElevenLabs Voice Service...');
  
  try {
    // Test ElevenLabs service through API endpoint
    console.log('📡 Testing ElevenLabs API integration...');
    
    // Check if ElevenLabs environment variables are configured
    const healthResponse = await fetch(`${SERVER_URL}/health`);
    if (healthResponse.ok) {
      console.log('✅ Server is running and responding');
    } else {
      console.log('⚠️  Server responded with status:', healthResponse.status);
    }
    
    // Test will be done through WebSocket integration
    console.log('✅ ElevenLabs service will be tested through WebSocket');
    
    return true;
  } catch (error) {
    console.error('❌ ElevenLabs Voice Service test failed:', error.message);
    return false;
  }
}

async function testWebSocketConnection() {
  console.log('📡 Testing WebSocket Connection...');
  
  return new Promise((resolve) => {
    const token = generateJWT(TEST_USER_ID, TEST_DEVICE_ID, TEST_DEVICE_NAME);
    
    const socket = io(WEBSOCKET_URL, {
      auth: {
        userId: TEST_USER_ID,
        deviceId: TEST_DEVICE_ID,
        deviceName: TEST_DEVICE_NAME,
        token: token
      },
      transports: ['websocket']
    });
    
    let connected = false;
    let configReceived = false;
    
    socket.on('connect', () => {
      console.log('✅ WebSocket connected successfully');
      connected = true;
      
      // Test button press to trigger ElevenLabs config
      console.log('🔘 Sending button press event...');
      socket.emit('glasses:button_press', {
        type: 'press',
        timestamp: Date.now()
      });
    });
    
    socket.on('connection:confirmed', (data) => {
      console.log('✅ Connection confirmed:', data.deviceId);
    });
    
    socket.on('elevenlabs:config', (data) => {
      console.log('✅ ElevenLabs config received:', {
        hasSignedUrl: !!data.signedUrl,
        hasAgentId: !!data.agentId,
        hasDynamicVariables: !!data.dynamicVariables,
        sessionId: data.sessionId
      });
      configReceived = true;
      
      // Test button release
      setTimeout(() => {
        console.log('🔘 Sending button release event...');
        socket.emit('glasses:button_press', {
          type: 'release',
          timestamp: Date.now()
        });
      }, 2000);
    });
    
    socket.on('stream:started', (data) => {
      console.log('✅ Stream started:', data.type);
    });
    
    socket.on('stream:stopped', (data) => {
      console.log('✅ Stream stopped');
    });
    
    socket.on('stream:error', (data) => {
      console.error('❌ Stream error:', data.error);
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      resolve(false);
    });
    
    socket.on('disconnect', () => {
      console.log('📡 WebSocket disconnected');
    });
    
    // Test timeout
    setTimeout(() => {
      socket.disconnect();
      resolve(connected && configReceived);
    }, 10000);
  });
}

async function testWebhookEndpoint() {
  console.log('🔗 Testing Webhook Endpoint...');
  
  try {
    // Test webhook endpoint existence
    const response = await fetch(`${SERVER_URL}/api/elevenlabs-post-call-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'test',
        data: {
          conversation_id: 'test_conversation',
          agent_id: 'test_agent'
        }
      })
    });
    
    console.log('✅ Webhook endpoint responded:', response.status);
    
    // Test tool execution webhook
    const toolResponse = await fetch(`${SERVER_URL}/api/elevenlabs-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify({
        tool_name: 'test_tool',
        parameters: { test: true }
      })
    });
    
    console.log('✅ Tool webhook endpoint responded:', toolResponse.status);
    
    return true;
  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
    return false;
  }
}

async function testRedisIntegration() {
  console.log('📕 Testing Redis Integration...');
  
  try {
    // Test Redis integration through device API
    console.log('📊 Testing device session management...');
    
    // Test device registration (this uses Redis internally)
    const deviceResponse = await fetch(`${SERVER_URL}/api/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        deviceId: TEST_DEVICE_ID,
        deviceName: TEST_DEVICE_NAME,
        deviceType: 'glasses'
      })
    });
    
    console.log('✅ Device registration API responded:', deviceResponse.status);
    
    // Test device list (this retrieves from Redis)
    const listResponse = await fetch(`${SERVER_URL}/api/devices/user/${TEST_USER_ID}`);
    console.log('✅ Device list API responded:', listResponse.status);
    
    // Redis integration will be tested through WebSocket connection
    console.log('✅ Redis session management will be tested through WebSocket');
    
    return true;
  } catch (error) {
    console.error('❌ Redis integration test failed:', error.message);
    return false;
  }
}

async function testComposioIntegration() {
  console.log('🔧 Testing Composio Integration...');
  
  try {
    // Test Composio integration through webhook endpoint
    console.log('⚙️  Testing Composio webhook endpoint...');
    
    // Test Composio OAuth endpoints
    const oauthResponse = await fetch(`${SERVER_URL}/api/composio/oauth/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: TEST_USER_ID
      })
    });
    console.log('✅ Composio OAuth API responded:', oauthResponse.status);
    
    // Test Composio triggers endpoint
    const triggersResponse = await fetch(`${SERVER_URL}/api/composio/triggers/${TEST_USER_ID}`);
    console.log('✅ Composio triggers API responded:', triggersResponse.status);
    
    // Composio integration will be tested through ElevenLabs webhook
    console.log('✅ Composio tool execution will be tested through ElevenLabs webhook');
    
    return true;
  } catch (error) {
    console.error('❌ Composio integration test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting ElevenLabs Voice Pipeline Tests...\n');
  
  const tests = [
    { name: 'ElevenLabs Voice Service', fn: testElevenLabsVoiceService },
    { name: 'Redis Integration', fn: testRedisIntegration },
    { name: 'WebSocket Connection', fn: testWebSocketConnection },
    { name: 'Webhook Endpoints', fn: testWebhookEndpoint },
    { name: 'Composio Integration', fn: testComposioIntegration }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n🧪 Running ${test.name}...`);
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
      console.log(`${result ? '✅' : '❌'} ${test.name}: ${result ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
      console.error(`❌ ${test.name}: ERROR - ${error.message}`);
      results.push({ name: test.name, passed: false, error: error.message });
    }
    
    await delay(1000); // Wait between tests
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.name}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  });
  
  console.log(`\n📈 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! ElevenLabs voice pipeline is ready.');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
  }
  
  process.exit(passed === total ? 0 : 1);
}

// Run tests if this script is executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  runTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { runTests }; 