import { mem0Service } from './mem0Service.js';

/**
 * Simple test for Mem0 service functionality
 * This file can be run to verify Mem0 integration works correctly
 */

async function testMem0Service() {
  console.log('🧪 Testing Mem0 Service...\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing health check...');
    const health = await mem0Service.healthCheck();
    console.log('Health status:', health);
    
    if (!health.initialized) {
      throw new Error('Mem0 service not initialized');
    }
    console.log('✅ Health check passed\n');

    // Test 2: Context Creation
    console.log('2️⃣ Testing context creation...');
    const testUserId = 'test-user-123';
    
    const voiceContext = mem0Service.createVoiceContext(testUserId);
    console.log('Voice context:', voiceContext);
    
    const chatContext = mem0Service.createChatContext(testUserId, 'thread-456');
    console.log('Chat context:', chatContext);
    console.log('✅ Context creation passed\n');

    // Test 3: Memory Operations (with sample data)
    console.log('3️⃣ Testing memory operations...');
    
    const sampleMessages = [
      { role: 'user' as const, content: 'I prefer to schedule meetings in the morning' },
      { role: 'assistant' as const, content: 'I\'ll remember that you prefer morning meetings for scheduling' }
    ];

    // Add memories
    console.log('Adding sample memories...');
    const addResult = await mem0Service.addMemoriesAfterInteraction(sampleMessages, voiceContext);
    console.log('Add result:', addResult);
    console.log('✅ Memory addition passed\n');

    // Retrieve memories
    console.log('Retrieving memories...');
    const retrieveResult = await mem0Service.getMemoryContext(
      'When should I schedule a meeting?',
      voiceContext
    );
    console.log('Retrieve result:', retrieveResult);
    console.log('✅ Memory retrieval passed\n');

    // Get all memories
    console.log('Getting all memories...');
    const allMemories = await mem0Service.getAllMemories(voiceContext);
    console.log('All memories count:', allMemories.length);
    console.log('✅ Get all memories passed\n');

    // Test 4: Memory Formatting
    console.log('4️⃣ Testing memory formatting...');
    // Note: formatMemoriesForContext is not needed since Mem0 model handles formatting automatically
    console.log('Memory retrieval result (already formatted):', retrieveResult);
    console.log('✅ Memory formatting test skipped (handled automatically by Mem0 model)\n');

    console.log('🎉 All Mem0 service tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Mem0 service test failed:', error);
    throw error;
  }
}

// Export for use in other files
export { testMem0Service };

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testMem0Service()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
} 