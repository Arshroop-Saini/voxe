const fetch = require('node-fetch');

// Test script for ElevenLabs webhook integration
// This simulates what ElevenLabs would send to your webhook

const WEBHOOK_URL = 'https://ac70-2601-586-4980-a50-942-33be-17f0-abbf.ngrok-free.app/api/elevenlabs-webhook';

async function testWebhook() {
  const webhookUrl = WEBHOOK_URL;
  
  // Test payload that ElevenLabs would send
  const testPayload = {
    tool_name: 'gmail_send_email',
    parameters: {
      to: 'test@example.com',
      subject: 'Test Email from ElevenLabs Webhook',
      body: 'This is a test email sent via the ElevenLabs webhook integration with Composio OAuth.'
    },
    user_id: 'test-user-123' // Replace with actual user ID from your system
  };

  try {
    console.log('🧪 Testing ElevenLabs webhook...');
    console.log('Payload:', JSON.stringify(testPayload, null, 2));
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testPayload.user_id
      },
      body: JSON.stringify(testPayload)
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.log('Raw response:', responseText);
      throw new Error(`Failed to parse JSON response: ${parseError.message}`);
    }
    
    console.log('\n📊 Response Status:', response.status);
    console.log('📊 Response:', JSON.stringify(result, null, 2));
    
    if (response.ok && result.success) {
      console.log('\n✅ Webhook test successful!');
      console.log('🎯 Tools used:', result.tools_used);
    } else {
      console.log('\n❌ Webhook test failed');
      console.log('Error:', result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('\n💥 Test failed with error:', error.message);
  }
}

// Instructions for testing
console.log(`
🔧 ElevenLabs Webhook Test Instructions:

1. Make sure your backend is running: cd voxe-backend && npm run dev
2. Make sure you have a user with Gmail OAuth connected
3. Update the user_id in this script to match your test user
4. Run this test: node scripts/testElevenLabsWebhook.js

This test simulates what ElevenLabs would send to your webhook.
If successful, it means your ElevenLabs agent can use the same OAuth 
connections that your chat system uses!
`);

testWebhook(); 