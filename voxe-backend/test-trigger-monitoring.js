#!/usr/bin/env node

/**
 * Trigger Monitoring Test Script
 * 
 * This script helps monitor and test trigger webhook events.
 * Run this alongside your backend to monitor trigger events in real-time.
 */

const BASE_URL = 'https://00cd-2601-586-4980-a50-e063-20a3-2ca0-7387.ngrok-free.app';
const USER_ID = '16fccbcf-363c-4c24-9ec0-4a0854c9a8bf'; // Your user ID from logs

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function timestamp() {
  return new Date().toISOString();
}

async function fetchTriggerEvents() {
  try {
    const response = await fetch(`${BASE_URL}/api/composio/triggers/events/${USER_ID}?limit=5`);
    const data = await response.json();
    
    if (data.success) {
      log(`\n📊 Recent Trigger Events (${data.count} found):`, colors.cyan);
      
      if (data.events.length === 0) {
        log('   No events found yet...', colors.yellow);
      } else {
        data.events.forEach((event, index) => {
          const status = event.processing_status === 'success' ? '✅' : 
                        event.processing_status === 'failed' ? '❌' : '⏳';
          
          log(`   ${index + 1}. ${status} ${event.event_type} - ${event.processed_at}`, colors.bright);
          
          if (event.trigger_configs) {
            log(`      App: ${event.trigger_configs.app_name}, Trigger: ${event.trigger_configs.trigger_name}`, colors.reset);
          }
          
          if (event.error_message) {
            log(`      Error: ${event.error_message}`, colors.red);
          }
        });
      }
    } else {
      log('❌ Failed to fetch events', colors.red);
    }
  } catch (error) {
    log(`❌ Error fetching events: ${error.message}`, colors.red);
  }
}

async function fetchTriggerStats() {
  try {
    const response = await fetch(`${BASE_URL}/api/composio/triggers/stats/${USER_ID}`);
    const data = await response.json();
    
    if (data.success) {
      log(`\n📈 Trigger Statistics:`, colors.magenta);
      log(`   Total Events: ${data.stats.totalEvents}`, colors.bright);
      log(`   Recent Events (24h): ${data.stats.recentEvents}`, colors.bright);
      
      if (Object.keys(data.stats.statusBreakdown).length > 0) {
        log(`   Status Breakdown:`, colors.bright);
        Object.entries(data.stats.statusBreakdown).forEach(([status, count]) => {
          const statusIcon = status === 'success' ? '✅' : status === 'failed' ? '❌' : '⏳';
          log(`     ${statusIcon} ${status}: ${count}`, colors.reset);
        });
      }
      
      if (Object.keys(data.stats.appBreakdown).length > 0) {
        log(`   App Breakdown:`, colors.bright);
        Object.entries(data.stats.appBreakdown).forEach(([app, count]) => {
          log(`     📱 ${app}: ${count}`, colors.reset);
        });
      }
    } else {
      log('❌ Failed to fetch stats', colors.red);
    }
  } catch (error) {
    log(`❌ Error fetching stats: ${error.message}`, colors.red);
  }
}

async function testWebhook() {
  try {
    log('\n🧪 Sending test webhook...', colors.yellow);
    
    const response = await fetch(`${BASE_URL}/api/composio/triggers/test-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: USER_ID,
        appName: 'gmail',
        triggerName: 'GMAIL_NEW_GMAIL_MESSAGE'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      log('✅ Test webhook sent successfully!', colors.green);
      log('   Check your backend logs for processing details', colors.bright);
    } else {
      log('❌ Test webhook failed', colors.red);
      log(`   Error: ${data.error}`, colors.red);
    }
  } catch (error) {
    log(`❌ Error sending test webhook: ${error.message}`, colors.red);
  }
}

async function checkWebhookHealth() {
  try {
    const response = await fetch(`${BASE_URL}/api/composio/webhook/health`);
    const data = await response.json();
    
    if (data.status === 'healthy') {
      log(`✅ Webhook endpoint is healthy`, colors.green);
      log(`   Environment: ${data.environment}`, colors.reset);
      log(`   Webhook Secret: ${data.webhookSecret}`, colors.reset);
    } else {
      log('❌ Webhook endpoint is unhealthy', colors.red);
    }
  } catch (error) {
    log(`❌ Webhook endpoint not reachable: ${error.message}`, colors.red);
  }
}

function showMenu() {
  log('\n🎯 Trigger Monitoring Menu:', colors.cyan);
  log('   1. Check recent trigger events', colors.bright);
  log('   2. Show trigger statistics', colors.bright);
  log('   3. Send test webhook', colors.bright);
  log('   4. Check webhook health', colors.bright);
  log('   5. Monitor continuously (every 10s)', colors.bright);
  log('   6. Exit', colors.bright);
  log('\nChoose an option (1-6): ', colors.yellow);
}

async function monitorContinuously() {
  log('\n🔄 Starting continuous monitoring (press Ctrl+C to stop)...', colors.cyan);
  
  const interval = setInterval(async () => {
    log(`\n⏰ ${timestamp()}`, colors.blue);
    await fetchTriggerEvents();
    await fetchTriggerStats();
    log('─'.repeat(50), colors.reset);
  }, 10000);
  
  process.on('SIGINT', () => {
    clearInterval(interval);
    log('\n👋 Monitoring stopped', colors.yellow);
    process.exit(0);
  });
}

// Main execution
async function main() {
  log('🚀 Trigger Monitoring Tool', colors.bright);
  log(`📡 Backend URL: ${BASE_URL}`, colors.reset);
  log(`👤 User ID: ${USER_ID}`, colors.reset);
  
  // Check initial health
  await checkWebhookHealth();
  
  if (process.argv.includes('--test')) {
    // Quick test mode
    await testWebhook();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
    await fetchTriggerEvents();
    return;
  }
  
  if (process.argv.includes('--monitor')) {
    // Continuous monitoring mode
    await monitorContinuously();
    return;
  }
  
  // Interactive mode
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  function askForInput() {
    showMenu();
    rl.question('', async (answer) => {
      switch (answer.trim()) {
        case '1':
          await fetchTriggerEvents();
          break;
        case '2':
          await fetchTriggerStats();
          break;
        case '3':
          await testWebhook();
          break;
        case '4':
          await checkWebhookHealth();
          break;
        case '5':
          rl.close();
          await monitorContinuously();
          return;
        case '6':
          log('\n👋 Goodbye!', colors.yellow);
          rl.close();
          return;
        default:
          log('\n❌ Invalid option, please choose 1-6', colors.red);
      }
      
      // Ask again
      setTimeout(askForInput, 1000);
    });
  }
  
  askForInput();
}

// Handle global errors
process.on('unhandledRejection', (error) => {
  log(`❌ Unhandled error: ${error.message}`, colors.red);
});

// Run the script
main().catch(error => {
  log(`❌ Script error: ${error.message}`, colors.red);
  process.exit(1);
}); 