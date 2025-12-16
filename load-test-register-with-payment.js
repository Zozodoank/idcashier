// Load testing script for registration with Duitku payment integration
import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://eypfeiqtvfxxiimhtycc.supabase.co'; // Replace with your Supabase URL
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/register-with-payment`;

// Test configuration
const CONCURRENT_REQUESTS = 10; // Number of concurrent requests
const TOTAL_REQUESTS = 50; // Total number of requests

// Generate random test data
const generateTestData = (index) => ({
  userData: {
    name: `Load Test User ${index}`,
    email: `loadtest${index}@example.com`,
    phone: `+6281234567${String(index).padStart(3, '0')}`,
    password: `securepassword${index}`,
    role: 'owner'
  },
  paymentData: {
    paymentAmount: 50000 + (index % 10000), // Varying amounts
    productDetails: 'IDCashier Registration Fee - Load Test',
    merchantOrderId: `LOAD-TEST-${Date.now()}-${index}`,
    customerVaName: `Load Test User ${index}`,
    customerEmail: `loadtest${index}@example.com`,
    customerPhone: `+6281234567${String(index).padStart(3, '0')}`,
    paymentMethod: 'VC'
  }
});

// Single request test
async function makeRequest(index) {
  const startTime = Date.now();
  try {
    const testData = generateTestData(index);
    
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result = await response.json();
    
    return {
      success: response.status === 201 && result.success,
      duration,
      status: response.status,
      userId: result.userId,
      paymentId: result.paymentId,
      error: result.error
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return {
      success: false,
      duration,
      error: error.message
    };
  }
}

// Concurrent requests test
async function runConcurrentRequests(startIndex, count) {
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(makeRequest(startIndex + i));
  }
  return Promise.all(promises);
}

// Main load test function
async function runLoadTest() {
  console.log(`Starting load test with ${TOTAL_REQUESTS} requests (${CONCURRENT_REQUESTS} concurrent)`);
  console.log('========================================================\n');

  const results = [];
  const startTime = Date.now();

  // Run requests in batches
  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
    const batchSize = Math.min(CONCURRENT_REQUESTS, TOTAL_REQUESTS - i);
    console.log(`Running batch ${Math.floor(i/CONCURRENT_REQUESTS) + 1}/${Math.ceil(TOTAL_REQUESTS/CONCURRENT_REQUESTS)} (${batchSize} requests)`);
    
    const batchResults = await runConcurrentRequests(i, batchSize);
    results.push(...batchResults);
    
    // Small delay between batches to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;

  // Analyze results
  const successfulRequests = results.filter(r => r.success).length;
  const failedRequests = results.length - successfulRequests;
  
  const durations = results.map(r => r.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  
  const successRate = (successfulRequests / results.length) * 100;

  // Print results
  console.log('\n========================================================');
  console.log('LOAD TEST RESULTS');
  console.log('========================================================');
  console.log(`Total requests: ${results.length}`);
  console.log(`Successful requests: ${successfulRequests}`);
  console.log(`Failed requests: ${failedRequests}`);
  console.log(`Success rate: ${successRate.toFixed(2)}%`);
  console.log(`Total time: ${(totalTime/1000).toFixed(2)} seconds`);
  console.log(`Average response time: ${avgDuration.toFixed(2)} ms`);
  console.log(`Min response time: ${minDuration} ms`);
  console.log(`Max response time: ${maxDuration} ms`);
  console.log(`Requests per second: ${(results.length/(totalTime/1000)).toFixed(2)}`);

  if (failedRequests > 0) {
    console.log('\n--- FAILED REQUESTS ---');
    results.filter(r => !r.success).forEach((result, index) => {
      console.log(`  ${index + 1}. Error: ${result.error}`);
    });
  }

  console.log('\n🎉 Load test completed!');
}

// Run the load test
runLoadTest();