/**
 * Test script for timeout functionality
 */

import bookingFlowController from './server/services/bookingFlowController.js';

async function testTimeout() {
  console.log('=== Testing Timeout Functionality ===\n');
  
  // Start a new session
  const userId = 'user123';
  const sessionResult = await bookingFlowController.startSession(userId, 'call');
  
  if (sessionResult.success) {
    const sessionId = sessionResult.sessionId;
    console.log(`Session started: ${sessionId}`);
    console.log(`Initial message: ${sessionResult.message}\n`);
    
    // Wait for timeout to trigger (30 seconds)
    console.log('Waiting 35 seconds for timeout to trigger...');
    
    setTimeout(async () => {
      // Simulate timeout by calling handleTimeout directly
      const timeoutResponse = await bookingFlowController.handleTimeout(sessionId);
      console.log('\n=== First Timeout ===');
      console.log(`Message: ${timeoutResponse.message}`);
      console.log(`Should end call: ${timeoutResponse.shouldEndCall}`);
      console.log(`Options: ${timeoutResponse.options.join(', ')}\n`);
      
      // Wait for second timeout
      setTimeout(async () => {
        console.log('Waiting another 35 seconds for second timeout...');
        setTimeout(async () => {
          const timeoutResponse2 = await bookingFlowController.handleTimeout(sessionId);
          console.log('\n=== Second Timeout ===');
          console.log(`Message: ${timeoutResponse2.message}`);
          console.log(`Should end call: ${timeoutResponse2.shouldEndCall}`);
          console.log(`Options: ${timeoutResponse2.options.join(', ')}\n`);
          
          // Wait for third timeout (should end call)
          setTimeout(async () => {
            console.log('Waiting final 35 seconds for third timeout...');
            setTimeout(async () => {
              const timeoutResponse3 = await bookingFlowController.handleTimeout(sessionId);
              console.log('\n=== Third Timeout (Should End Call) ===');
              console.log(`Message: ${timeoutResponse3.message}`);
              console.log(`Should end call: ${timeoutResponse3.shouldEndCall}`);
              console.log('Test completed!\n');
            }, 35000);
          }, 1000);
        }, 35000);
      }, 1000);
    }, 35000);
  } else {
    console.error('Failed to start session:', sessionResult.message);
  }
}

// Test user response after timeout
async function testUserResponseAfterTimeout() {
  console.log('\n=== Testing User Response After Timeout ===\n');
  
  const userId = 'user456';
  const sessionResult = await bookingFlowController.startSession(userId, 'call');
  
  if (sessionResult.success) {
    const sessionId = sessionResult.sessionId;
    console.log(`Session started: ${sessionId}`);
    
    // Simulate first timeout
    setTimeout(async () => {
      const timeoutResponse = await bookingFlowController.handleTimeout(sessionId);
      console.log('Timeout triggered:', timeoutResponse.message);
      
      // Simulate user responding after timeout
      setTimeout(async () => {
        console.log('\nUser responding with "home visit"...');
        const userResponse = await bookingFlowController.handleUserInput(sessionId, 'home visit');
        console.log('Response after timeout:', userResponse.message);
        console.log('Timeout should be reset and timer restarted\n');
      }, 2000);
    }, 35000);
  }
}

// Run tests
testTimeout();
testUserResponseAfterTimeout();
