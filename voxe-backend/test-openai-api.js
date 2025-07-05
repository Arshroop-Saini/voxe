// Test to demonstrate the OpenAI API issue
console.log('Testing Node.js File API...');

try {
  // This will fail in Node.js - File constructor doesn't exist
  const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
  console.log('✅ File API works:', testFile);
} catch (error) {
  console.log('❌ File API failed:', error.message);
  console.log('This is why your OpenAI API calls are failing!');
}

// Test if we have access to OpenAI API key
console.log('OpenAI API Key configured:', !!process.env.OPENAI_API_KEY); 