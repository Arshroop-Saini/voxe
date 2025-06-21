#!/usr/bin/env node

/**
 * Test script to verify Supermemory connection
 * Run with: node test-supermemory-connection.js
 */

import dotenv from 'dotenv';
import Supermemory from 'supermemory';

// Load environment variables
dotenv.config();

async function testSupermemoryConnection() {
  console.log('🧪 Testing Supermemory connection...\n');

  // Check if API key is set
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  if (!apiKey) {
    console.error('❌ SUPERMEMORY_API_KEY not found in environment variables');
    console.log('Please add SUPERMEMORY_API_KEY to your .env file');
    process.exit(1);
  }

  console.log(`✅ API Key found: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 8)}`);

  try {
    // Initialize client
    const client = new Supermemory({
      apiKey: apiKey,
    });

    console.log('📡 Testing API connection...');

    // Test with a simple memory addition
    const testMemory = {
      content: 'Test connection from Voxe backend - Email embedding system initialization',
      containerTags: ['test_connection', 'voxe_backend'],
      customId: `test_connection_${Date.now()}`,
      metadata: {
        type: 'connection_test',
        timestamp: new Date().toISOString(),
        source: 'voxe_backend',
        feature: 'email_embedding',
        testRun: true
      }
    };

    const response = await client.memories.add(testMemory);

    if (response && response.id) {
      console.log('✅ Supermemory connection successful!');
      console.log(`📝 Test memory created with ID: ${response.id}`);
      console.log(`📊 Status: ${response.status}`);
      console.log('\n🎉 Ready to proceed with email embedding implementation!');
    } else {
      console.error('❌ Unexpected response format:', response);
    }

  } catch (error) {
    console.error('❌ Supermemory connection failed:');
    console.error('Error details:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.log('\n💡 This looks like an authentication issue. Please verify:');
      console.log('1. Your API key is correct');
      console.log('2. Your API key has the necessary permissions');
      console.log('3. Your Supermemory account is active');
    }

    process.exit(1);
  }
}

// Run the test
testSupermemoryConnection().catch(console.error); 