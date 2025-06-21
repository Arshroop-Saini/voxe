/**
 * Comprehensive validation test script for Email Embedding API
 * Tests all validation scenarios, error handling, and response formatting
 */

const BASE_URL = 'http://localhost:3002';

/**
 * Test configuration
 */
const TEST_CONFIG = {
  validUserId: 'test-user-123',
  invalidUserIds: [
    null,
    undefined,
    '',
    '   ',
    'user with spaces',
    'user@with#special!chars',
    'a'.repeat(256), // Too long
    123, // Wrong type
    {},  // Wrong type
    []   // Wrong type
  ],
  testEndpoint: '/api/email-embedding'
};

/**
 * Test helper functions
 */
class TestRunner {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
  }

  async runTest(testName, testFunction) {
    this.totalTests++;
    console.log(`\n🧪 Running: ${testName}`);
    
    try {
      const result = await testFunction();
      if (result.passed) {
        this.passedTests++;
        console.log(`✅ PASSED: ${testName}`);
      } else {
        console.log(`❌ FAILED: ${testName} - ${result.message}`);
      }
      
      this.testResults.push({
        name: testName,
        passed: result.passed,
        message: result.message,
        details: result.details
      });
    } catch (error) {
      console.log(`❌ ERROR: ${testName} - ${error.message}`);
      this.testResults.push({
        name: testName,
        passed: false,
        message: error.message,
        details: error.stack
      });
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.totalTests}`);
    console.log(`Passed: ${this.passedTests}`);
    console.log(`Failed: ${this.totalTests - this.passedTests}`);
    console.log(`Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
    
    const failedTests = this.testResults.filter(t => !t.passed);
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`  - ${test.name}: ${test.message}`);
      });
    }
  }
}

/**
 * HTTP request helper
 */
async function makeRequest(method, path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data
    };
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

/**
 * Validation Tests
 */
const ValidationTests = {
  // Test 1: Valid request with header
  async testValidRequestWithHeader() {
    const response = await makeRequest('POST', TEST_CONFIG.testEndpoint, {
      headers: {
        'x-user-id': TEST_CONFIG.validUserId
      },
      body: {}
    });

    const passed = response.status === 200 || response.status === 207;
    return {
      passed,
      message: passed ? 'Valid request processed successfully' : `Unexpected status: ${response.status}`,
      details: response
    };
  },

  // Test 2: Valid request with body
  async testValidRequestWithBody() {
    const response = await makeRequest('POST', TEST_CONFIG.testEndpoint, {
      body: {
        user_id: TEST_CONFIG.validUserId
      }
    });

    const passed = response.status === 200 || response.status === 207;
    return {
      passed,
      message: passed ? 'Valid request with body processed successfully' : `Unexpected status: ${response.status}`,
      details: response
    };
  },

  // Test 3: Missing user ID
  async testMissingUserId() {
    const response = await makeRequest('POST', TEST_CONFIG.testEndpoint, {
      body: {}
    });

    const passed = response.status === 400 && 
                   response.data.code === 'VALIDATION_ERROR' &&
                   response.data.success === false;
    
    return {
      passed,
      message: passed ? 'Missing user ID properly rejected' : 'Did not properly reject missing user ID',
      details: response
    };
  },

  // Test 4: Invalid user ID formats
  async testInvalidUserIdFormats() {
    const results = [];
    
    for (const invalidUserId of TEST_CONFIG.invalidUserIds) {
      try {
        const response = await makeRequest('POST', TEST_CONFIG.testEndpoint, {
          headers: {
            'x-user-id': invalidUserId
          },
          body: {}
        });

        const isRejected = response.status === 400 && response.data.code === 'VALIDATION_ERROR';
        results.push({
          value: invalidUserId,
          rejected: isRejected,
          status: response.status
        });
      } catch (error) {
        // Some invalid values might cause request errors, which is also acceptable
        results.push({
          value: invalidUserId,
          rejected: true,
          error: error.message
        });
      }
    }

    const allRejected = results.every(r => r.rejected);
    return {
      passed: allRejected,
      message: allRejected ? 'All invalid user IDs properly rejected' : 'Some invalid user IDs were accepted',
      details: results
    };
  },

  // Test 5: Wrong Content-Type
  async testWrongContentType() {
    const response = await makeRequest('POST', TEST_CONFIG.testEndpoint, {
      headers: {
        'Content-Type': 'text/plain',
        'x-user-id': TEST_CONFIG.validUserId
      },
      body: 'invalid body'
    });

    const passed = response.status === 400;
    return {
      passed,
      message: passed ? 'Wrong content type properly rejected' : 'Wrong content type was accepted',
      details: response
    };
  },

  // Test 6: Unexpected fields in body
  async testUnexpectedFields() {
    const response = await makeRequest('POST', TEST_CONFIG.testEndpoint, {
      headers: {
        'x-user-id': TEST_CONFIG.validUserId
      },
      body: {
        user_id: TEST_CONFIG.validUserId,
        unexpected_field: 'should be rejected',
        another_field: 123
      }
    });

    const passed = response.status === 400 && 
                   response.data.code === 'VALIDATION_ERROR';
    
    return {
      passed,
      message: passed ? 'Unexpected fields properly rejected' : 'Unexpected fields were accepted',
      details: response
    };
  },

  // Test 7: Rate limiting
  async testRateLimit() {
    const requests = [];
    const userId = `rate-test-${Date.now()}`;
    
    // Make multiple rapid requests to trigger rate limit
    for (let i = 0; i < 12; i++) {
      requests.push(
        makeRequest('POST', TEST_CONFIG.testEndpoint, {
          headers: {
            'x-user-id': userId
          },
          body: {}
        })
      );
    }

    const responses = await Promise.allSettled(requests);
    const rateLimitedResponses = responses.filter(r => 
      r.status === 'fulfilled' && r.value.status === 429
    );

    const passed = rateLimitedResponses.length > 0;
    return {
      passed,
      message: passed ? 'Rate limiting is working' : 'Rate limiting not triggered',
      details: {
        totalRequests: responses.length,
        rateLimitedCount: rateLimitedResponses.length,
        statuses: responses.map(r => r.status === 'fulfilled' ? r.value.status : 'error')
      }
    };
  },

  // Test 8: Response format validation
  async testResponseFormat() {
    const response = await makeRequest('POST', TEST_CONFIG.testEndpoint, {
      headers: {
        'x-user-id': TEST_CONFIG.validUserId
      },
      body: {}
    });

    const hasRequiredFields = response.data.hasOwnProperty('success') &&
                              response.data.hasOwnProperty('message') &&
                              (response.data.success ? response.data.hasOwnProperty('data') : response.data.hasOwnProperty('error'));

    const passed = hasRequiredFields;
    return {
      passed,
      message: passed ? 'Response format is valid' : 'Response format is invalid',
      details: {
        responseFields: Object.keys(response.data),
        response: response.data
      }
    };
  },

  // Test 9: Security headers
  async testSecurityHeaders() {
    const response = await makeRequest('POST', TEST_CONFIG.testEndpoint, {
      headers: {
        'x-user-id': TEST_CONFIG.validUserId
      },
      body: {}
    });

    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection'
    ];

    const hasSecurityHeaders = requiredHeaders.every(header => 
      response.headers.hasOwnProperty(header)
    );

    return {
      passed: hasSecurityHeaders,
      message: hasSecurityHeaders ? 'Security headers present' : 'Missing security headers',
      details: {
        presentHeaders: Object.keys(response.headers).filter(h => h.startsWith('x-')),
        requiredHeaders
      }
    };
  },

  // Test 10: Status endpoint
  async testStatusEndpoint() {
    const response = await makeRequest('GET', `${TEST_CONFIG.testEndpoint}/status/${TEST_CONFIG.validUserId}`);

    const passed = response.status === 200 && response.data.success === true;
    return {
      passed,
      message: passed ? 'Status endpoint working' : 'Status endpoint failed',
      details: response
    };
  }
};

/**
 * Performance Tests
 */
const PerformanceTests = {
  // Test response time
  async testResponseTime() {
    const startTime = Date.now();
    
    const response = await makeRequest('POST', TEST_CONFIG.testEndpoint, {
      headers: {
        'x-user-id': TEST_CONFIG.validUserId
      },
      body: {}
    });

    const responseTime = Date.now() - startTime;
    const passed = responseTime < 30000; // 30 seconds max

    return {
      passed,
      message: passed ? `Response time: ${responseTime}ms` : `Response too slow: ${responseTime}ms`,
      details: {
        responseTime,
        status: response.status
      }
    };
  },

  // Test concurrent requests
  async testConcurrentRequests() {
    const concurrentRequests = 5;
    const requests = [];

    for (let i = 0; i < concurrentRequests; i++) {
      requests.push(
        makeRequest('POST', TEST_CONFIG.testEndpoint, {
          headers: {
            'x-user-id': `concurrent-test-${i}`
          },
          body: {}
        })
      );
    }

    const startTime = Date.now();
    const responses = await Promise.allSettled(requests);
    const totalTime = Date.now() - startTime;

    const successfulResponses = responses.filter(r => 
      r.status === 'fulfilled' && (r.value.status === 200 || r.value.status === 207)
    );

    const passed = successfulResponses.length === concurrentRequests;
    return {
      passed,
      message: passed ? `All ${concurrentRequests} concurrent requests succeeded` : 
                       `Only ${successfulResponses.length}/${concurrentRequests} requests succeeded`,
      details: {
        totalTime,
        successfulCount: successfulResponses.length,
        totalCount: concurrentRequests
      }
    };
  }
};

/**
 * Main test execution
 */
async function runAllTests() {
  console.log('🚀 Starting Email Embedding API Validation Tests');
  console.log('='.repeat(60));
  
  const runner = new TestRunner();

  // Validation Tests
  console.log('\n📋 VALIDATION TESTS');
  console.log('-'.repeat(30));
  
  await runner.runTest('Valid Request with Header', ValidationTests.testValidRequestWithHeader);
  await runner.runTest('Valid Request with Body', ValidationTests.testValidRequestWithBody);
  await runner.runTest('Missing User ID', ValidationTests.testMissingUserId);
  await runner.runTest('Invalid User ID Formats', ValidationTests.testInvalidUserIdFormats);
  await runner.runTest('Wrong Content Type', ValidationTests.testWrongContentType);
  await runner.runTest('Unexpected Fields', ValidationTests.testUnexpectedFields);
  await runner.runTest('Rate Limiting', ValidationTests.testRateLimit);
  await runner.runTest('Response Format', ValidationTests.testResponseFormat);
  await runner.runTest('Security Headers', ValidationTests.testSecurityHeaders);
  await runner.runTest('Status Endpoint', ValidationTests.testStatusEndpoint);

  // Performance Tests
  console.log('\n⚡ PERFORMANCE TESTS');
  console.log('-'.repeat(30));
  
  await runner.runTest('Response Time', PerformanceTests.testResponseTime);
  await runner.runTest('Concurrent Requests', PerformanceTests.testConcurrentRequests);

  // Print final summary
  runner.printSummary();
  
  // Exit with appropriate code
  const success = runner.passedTests === runner.totalTests;
  process.exit(success ? 0 : 1);
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ with built-in fetch support');
  console.log('💡 Alternatively, install node-fetch: npm install node-fetch');
  process.exit(1);
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
}); 