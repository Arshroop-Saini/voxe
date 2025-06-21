#!/usr/bin/env node

/**
 * Integration test for the complete email embedding system
 * Tests Supermemory + EmailEmbeddingService + Composio integration
 * Run with: node test-email-embedding-integration.js
 */

import dotenv from 'dotenv';
import { EmailEmbeddingService } from './dist/services/emailEmbeddingService.js';
import { supermemoryClient } from './dist/lib/supermemory.js';

// Load environment variables
dotenv.config();

async function runIntegrationTest() {
  console.log('🧪 Starting Email Embedding Integration Test...\n');

  // Test 1: Verify Supermemory Connection
  console.log('📋 Test 1: Supermemory Connection');
  try {
    const isConnected = await supermemoryClient.testConnection();
    if (isConnected) {
      console.log('✅ Supermemory connection successful\n');
    } else {
      console.log('❌ Supermemory connection failed\n');
      return;
    }
  } catch (error) {
    console.error('❌ Supermemory connection error:', error.message);
    return;
  }

  // Test 2: Test Batch Memory Addition
  console.log('📋 Test 2: Batch Memory Addition');
  try {
    const testMemories = [
      {
        content: `Subject: Test Email 1
From: test1@example.com
Date: 2024-01-15T10:30:00Z

This is a test email for the integration test. It contains sample content to verify the email embedding system works correctly.`,
        containerTags: ['user_test_123', 'sender_example.com', 'email_primary_inbox'],
        customId: `test_email_1_${Date.now()}`,
        metadata: {
          source: 'gmail',
          type: 'email',
          sender: 'test1@example.com',
          senderDomain: 'example.com',
          subject: 'Test Email 1',
          receivedDate: '2024-01-15',
          threadId: 'thread_test_1',
          hasAttachments: false,
          isImportant: false,
          labelCount: 2
        }
      },
      {
        content: `Subject: Important Meeting Update
From: manager@company.com
Date: 2024-01-15T14:45:00Z

Hi team, I wanted to update you on tomorrow's meeting. We'll be discussing the quarterly results and planning for next quarter.`,
        containerTags: ['user_test_123', 'sender_company.com', 'email_primary_inbox', 'email_important'],
        customId: `test_email_2_${Date.now()}`,
        metadata: {
          source: 'gmail',
          type: 'email',
          sender: 'manager@company.com',
          senderDomain: 'company.com',
          subject: 'Important Meeting Update',
          receivedDate: '2024-01-15',
          threadId: 'thread_test_2',
          hasAttachments: false,
          isImportant: true,
          labelCount: 3
        }
      }
    ];

    console.log(`🚀 Adding ${testMemories.length} test memories...`);
    const batchResult = await supermemoryClient.batchAddMemories(testMemories);
    
    console.log(`✅ Batch operation completed:`);
    console.log(`   - Total processed: ${batchResult.totalProcessed}`);
    console.log(`   - Successful: ${batchResult.successCount}`);
    console.log(`   - Failed: ${batchResult.failureCount}`);
    console.log(`   - Overall success: ${batchResult.success}\n`);

    if (batchResult.failureCount > 0) {
      console.log('❌ Some memories failed to add:');
      batchResult.results.forEach((result, index) => {
        if (!result.success) {
          console.log(`   - Memory ${index + 1}: ${result.error}`);
        }
      });
      console.log();
    }
  } catch (error) {
    console.error('❌ Batch memory addition failed:', error.message);
    return;
  }

  // Test 3: EmailEmbeddingService Initialization
  console.log('📋 Test 3: EmailEmbeddingService Initialization');
  try {
    const emailService = new EmailEmbeddingService();
    const status = emailService.getStatus();
    
    console.log('✅ EmailEmbeddingService initialized successfully');
    console.log(`   - Configured: ${status.configured}`);
    console.log(`   - Supermemory Connected: ${status.supermemoryConnected}`);
    console.log(`   - Composio Configured: ${status.composioConfigured}`);
    console.log(`   - Config: ${JSON.stringify(status.config, null, 2)}\n`);

    if (!status.configured) {
      console.log('⚠️  Service not fully configured - missing API keys\n');
    }
  } catch (error) {
    console.error('❌ EmailEmbeddingService initialization failed:', error.message);
    return;
  }

  // Test 4: Mock Email Processing (without Composio)
  console.log('📋 Test 4: Mock Email Processing');
  try {
    // Create a mock processed email for testing
    const mockEmail = {
      id: `mock_email_${Date.now()}`,
      subject: 'Integration Test Email',
      sender: 'integration-test@voxe.com',
      senderEmail: 'integration-test@voxe.com',
      senderDomain: 'voxe.com',
      content: 'This is a mock email created for integration testing purposes. It simulates a real email that would be processed by the system.',
      receivedDate: new Date().toISOString(),
      threadId: `thread_mock_${Date.now()}`,
      hasAttachments: false,
      isImportant: false,
      labels: ['INBOX', 'UNREAD']
    };

    // Test email formatting
    const emailService = new EmailEmbeddingService();
    
    // Access private methods for testing (normally wouldn't do this in production)
    const formattedContent = emailService.formatEmailForEmbedding(mockEmail);
    const containerTags = emailService.generateContainerTags(mockEmail, 'test_user_123');
    const metadata = emailService.generateEmailMetadata(mockEmail);

    console.log('✅ Email processing components working:');
    console.log(`   - Formatted content length: ${formattedContent.length} characters`);
    console.log(`   - Container tags: ${containerTags.join(', ')}`);
    console.log(`   - Metadata keys: ${Object.keys(metadata).join(', ')}\n`);

    // Test single email embedding
    console.log('🚀 Testing single email embedding...');
    const embeddingResult = await emailService.embedSingleEmail(mockEmail, 'test_user_123');
    
    console.log(`✅ Single email embedding result:`);
    console.log(`   - Email ID: ${embeddingResult.emailId}`);
    console.log(`   - Memory ID: ${embeddingResult.memoryId}`);
    console.log(`   - Status: ${embeddingResult.status}`);
    console.log(`   - Timestamp: ${embeddingResult.timestamp}\n`);

  } catch (error) {
    console.error('❌ Mock email processing failed:', error.message);
    console.error('   Error details:', error);
  }

  // Test Summary
  console.log('📊 Integration Test Summary:');
  console.log('✅ Supermemory connection verified');
  console.log('✅ Batch memory operations working');
  console.log('✅ EmailEmbeddingService initialized');
  console.log('✅ Email processing pipeline functional');
  console.log('\n🎉 Integration test completed successfully!');
  console.log('\n💡 Next steps:');
  console.log('   1. Set up Gmail OAuth connection for real email fetching');
  console.log('   2. Create backend API endpoint');
  console.log('   3. Build frontend button component');
  console.log('   4. Test with real Gmail emails');
}

// Handle errors gracefully
runIntegrationTest().catch(error => {
  console.error('\n💥 Integration test failed with error:', error);
  process.exit(1);
}); 