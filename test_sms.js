/**
 * Test SMS Service
 * This script tests the SMS functionality for appointment confirmations
 */

import smsService from './server/services/smsService.js';
import { getUserById } from './server/services/bookingMockData.js';

async function testSMSService() {
  console.log('=== Testing SMS Service ===\n');

  // Test 1: Check if SMS service is configured
  console.log('1. Checking SMS service configuration...');
  const isConfigured = smsService.isConfigured();
  console.log(`   SMS Service Configured: ${isConfigured}`);
  
  if (!isConfigured) {
    console.log('   Please set the following environment variables:');
    console.log('   - TWILIO_ACCOUNT_SID');
    console.log('   - TWILIO_AUTH_TOKEN');
    console.log('   - TWILIO_PHONE_NUMBER');
    console.log('\nSkipping SMS tests...\n');
    return;
  }

  // Test 2: Send test SMS
  console.log('\n2. Sending test SMS...');
  const testPhoneNumber = '+919876543210'; // Use Amit's phone number for testing
  
  try {
    const testResult = await smsService.sendTestSMS(testPhoneNumber);
    console.log('   Test SMS Result:', testResult);
  } catch (error) {
    console.error('   Test SMS Error:', error.message);
  }

  // Test 3: Send appointment confirmation SMS
  console.log('\n3. Testing appointment confirmation SMS...');
  
  // Get a test user
  const testUser = getUserById(1); // Amit
  if (!testUser) {
    console.log('   Test user not found');
    return;
  }

  const appointmentDetails = {
    userName: testUser.name,
    userPhone: testUser.phone,
    appointmentType: 'center',
    appointmentTime: '8:00 AM',
    centerName: 'HealthCare Diagnostic Center',
    centerAddress: '123 Medical Plaza, Downtown'
  };

  try {
    const confirmationResult = await smsService.sendAppointmentConfirmation(appointmentDetails);
    console.log('   Appointment SMS Result:', confirmationResult);
  } catch (error) {
    console.error('   Appointment SMS Error:', error.message);
  }

  // Test 4: Test home visit SMS
  console.log('\n4. Testing home visit confirmation SMS...');
  
  const homeVisitDetails = {
    userName: testUser.name,
    userPhone: testUser.phone,
    appointmentType: 'home',
    appointmentTime: '9:00 AM',
    centerName: null,
    centerAddress: null
  };

  try {
    const homeVisitResult = await smsService.sendAppointmentConfirmation(homeVisitDetails);
    console.log('   Home Visit SMS Result:', homeVisitResult);
  } catch (error) {
    console.error('   Home Visit SMS Error:', error.message);
  }

  console.log('\n=== SMS Service Test Complete ===');
}

// Test phone number formatting
function testPhoneFormatting() {
  console.log('\n=== Testing Phone Number Formatting ===\n');
  
  const testNumbers = [
    '9876543210',
    '+919876543210',
    '09876543210',
    '98765-43210',
    '(987) 654-3210'
  ];

  testNumbers.forEach(number => {
    const formatted = smsService.formatPhoneNumber(number);
    console.log(`${number} -> ${formatted}`);
  });
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  testSMSService();
  testPhoneFormatting();
}

export { testSMSService, testPhoneFormatting };
