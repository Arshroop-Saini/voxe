#!/usr/bin/env node

/**
 * Test script for ElevenLabs Post-Call Webhook
 * 
 * This script simulates an ElevenLabs post-call webhook request
 * to verify the endpoint works correctly for memory storage.
 */

const testPostCallWebhook = async () => {
  const webhookUrl = 'http://localhost:3002/api/elevenlabs-post-call-webhook';
  
  // Simulate ElevenLabs post-call webhook payload (based on actual format from docs)
  const testPayload = {
    type: 'post_call_transcription',
    event_timestamp: Math.floor(Date.now() / 1000),
    data: {
      agent_id: process.env.ELEVENLABS_AGENT_ID || 'agent_01jy2a1j4rfthsywk014emsggj',
      conversation_id: 'test_conv_' + Date.now(),
      status: 'done',
      transcript: [
        {
          role: 'agent',
          message: 'Hello! How can I help you today?',
          tool_calls: null,
          tool_results: null,
          feedback: null,
          time_in_call_secs: 0,
          conversation_turn_metrics: null
        },
        {
          role: 'user',
          message: 'Can you send an email to test@example.com about our meeting tomorrow?',
          tool_calls: null,
          tool_results: null,
          feedback: null,
          time_in_call_secs: 3,
          conversation_turn_metrics: null
        },
        {
          role: 'agent',
          message: 'I\'ll send that email for you right away.',
          tool_calls: [
            {
              tool_name: 'send_email',
              parameters: {
                to: 'test@example.com',
                subject: 'Meeting Tomorrow',
                body: 'Hi, let\'s discuss our meeting tomorrow.'
              }
            }
          ],
          tool_results: [
            {
              tool_name: 'send_email',
              result: 'Email sent successfully'
            }
          ],
          feedback: null,
          time_in_call_secs: 10,
          conversation_turn_metrics: null
        }
      ],
      metadata: {
        start_time_unix_secs: Math.floor(Date.now() / 1000) - 30,
        call_duration_secs: 30,
        cost: 150,
        deletion_settings: {
          deletion_time_unix_secs: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
          deleted_logs_at_time_unix_secs: null,
          deleted_audio_at_time_unix_secs: null,
          deleted_transcript_at_time_unix_secs: null,
          delete_transcript_and_pii: true,
          delete_audio: true
        },
        feedback: {
          overall_score: null,
          likes: 0,
          dislikes: 0
        },
        authorization_method: 'authorization_header',
        charging: {
          dev_discount: true
        },
        termination_reason: ''
      },
      analysis: {
        evaluation_criteria_results: {},
        data_collection_results: {},
        call_successful: 'success',
        transcript_summary: 'User requested to send an email about a meeting. Agent successfully processed the request and sent the email to the specified recipient.'
      },
      conversation_initiation_client_data: {
        conversation_config_override: {
          agent: {
            prompt: null,
            first_message: null,
            language: 'en'
          },
          tts: {
            voice_id: null
          }
        },
        custom_llm_extra_body: {},
        dynamic_variables: {
          user_id: 'e58e50aa-fd9d-499e-a977-f9b8b065f8b4',
          user_name: 'Test User'
        }
      }
    }
  };

  try {
    console.log('🧪 Testing post-call webhook...');
    console.log('📡 Sending request to:', webhookUrl);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In production, ElevenLabs would send the signature header
        // 'ElevenLabs-Signature': 'actual_signature_would_be_here'
      },
      body: JSON.stringify(testPayload)
    });

    const responseText = await response.text();
    
    console.log('📊 Response Status:', response.status);
    console.log('📄 Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('📝 Response Body:', responseText);

    if (response.ok) {
      console.log('✅ Test passed! Post-call webhook is working correctly.');
      
      try {
        const responseData = JSON.parse(responseText);
        console.log('📊 Webhook processed successfully:');
        console.log('   - Conversation ID:', responseData.conversation_id);
        console.log('   - User ID:', responseData.user_id);
        console.log('   - Memories stored:', responseData.memories_stored);
        console.log('   - Status:', responseData.status);
      } catch (parseError) {
        console.log('⚠️ Could not parse response as JSON, but webhook returned 200');
      }
    } else {
      console.log('❌ Test failed! Webhook returned error status.');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('🔧 Make sure your backend server is running on port 3002');
  }
};

// Run the test
console.log('🚀 Starting ElevenLabs Post-Call Webhook Test');
console.log('📍 Make sure your backend server is running: npm run dev');
console.log('');

testPostCallWebhook();

// Also test the health check endpoint
const testHealthCheck = async () => {
  const healthUrl = 'http://localhost:3002/api/elevenlabs-post-call-webhook';
  
  try {
    console.log('\n🏥 Testing health check...');
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const responseData = await response.json();
    console.log('Health check response:', responseData);

    if (response.status === 200 && responseData.status === 'healthy') {
      console.log('✅ Health check PASSED!');
    } else {
      console.log('❌ Health check FAILED!');
    }

  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
};

// Run the tests
const runTests = async () => {
  console.log('🚀 Starting Post-Call Webhook Tests\n');
  
  await testHealthCheck();
  await testPostCallWebhook();
  
  console.log('\n🏁 Test completed!');
};

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { testPostCallWebhook, testHealthCheck }; 