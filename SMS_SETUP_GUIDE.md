# SMS Notification Setup Guide

This guide explains how to configure and use SMS notifications for appointment confirmations in the MedInsure Chatbot system.

## Overview

The system now automatically sends SMS confirmations to patients when their appointments are successfully booked. The SMS includes:
- Patient name
- Appointment time (tomorrow)
- Location details (center address or home visit)
- Important instructions
- Contact information

## Prerequisites

1. **Twilio Account**: You need a Twilio account with SMS capabilities
2. **Twilio Phone Number**: A Twilio phone number capable of sending SMS
3. **Environment Configuration**: Proper environment variables set

## Setup Instructions

### 1. Get Twilio Credentials

1. Sign up for a Twilio account at https://www.twilio.com/
2. Get your Account SID from the Twilio Console
3. Get your Auth Token from the Twilio Console
4. Purchase a Twilio phone number (or use an existing one)

### 2. Configure Environment Variables

Create a `.env` file in the `server` directory with the following variables:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Other existing variables
GROQ_API_KEY=your_groq_api_key_here
SERVER_URL=http://localhost:3001
PORT=3001
```

**Important**: The `.env` file should be in the `server/` directory, not the root directory.

### 3. Verify Phone Numbers in User Data

The demo users now have phone numbers configured:

```javascript
// server/services/bookingMockData.js
export const DEMO_USERS = [
  { id: 1, name: 'Amit', phone: '+919876543210' },
  { id: 2, name: 'Neha', phone: '+919876543211' },
  { id: 3, name: 'Rahul', phone: '+919876543212' },
  { id: 4, name: 'Sneha', phone: '+919876543213' },
  { id: 5, name: 'Vikram', phone: '+919876543214' }
];
```

For production, update these with real patient phone numbers in your database.

## Testing SMS Functionality

### 1. Run the SMS Test

```bash
node test_sms.js
```

This will:
- Check if SMS service is properly configured
- Send a test SMS
- Send appointment confirmation SMS examples
- Test phone number formatting

### 2. Test via Booking Flow

1. Start the application: `npm run dev`
2. Start the server: `npm start` (in a separate terminal)
3. Complete an appointment booking through the chat interface
4. Check the console logs for SMS sending status
5. Verify SMS is received on the configured phone number

## SMS Message Templates

### Diagnostic Center Appointment

```
Dear [Patient Name],

Your medical appointment is confirmed for tomorrow at [Time]. Location: [Center Name]
Address: [Center Address]

Please ensure:
- Arrive 10 minutes early
- Bring ID proof and insurance card
- Fasting may be required for blood tests

For any queries, please contact our helpline.
Thank you for choosing MedInsure!
```

### Home Visit Appointment

```
Dear [Patient Name],

Your medical appointment is confirmed for tomorrow at [Time]. A medical professional will visit you at your home.

Please ensure:
- Be available for the appointment
- Keep ID proof and insurance card ready
- Fasting may be required for blood tests

For any queries, please contact our helpline.
Thank you for choosing MedInsure!
```

## Phone Number Format

The system automatically formats phone numbers to E.164 format:

- `9876543210` becomes `+919876543210` (assumes Indian number)
- `+919876543210` remains `+919876543210`
- `09876543210` becomes `+919876543210`

## Error Handling

The SMS service includes comprehensive error handling:

1. **Missing Configuration**: If Twilio credentials are not set, SMS sending is skipped but booking continues
2. **Invalid Phone Number**: Logs error but doesn't fail the booking process
3. **Twilio API Errors**: Logs detailed error information for debugging
4. **Network Issues**: Graceful failure with retry recommendations

## Integration Points

### 1. SMS Service (`server/services/smsService.js`)

Core SMS functionality including:
- Twilio client initialization
- Phone number formatting
- Message template building
- Error handling

### 2. Booking Flow Controller (`server/services/bookingFlowController.js`)

Integration point where SMS is sent:
- After appointment is saved to database
- Before session is marked as completed
- Uses user phone number from user data

### 3. User Data (`server/services/bookingMockData.js`)

Contains user phone numbers for SMS sending.

## Troubleshooting

### Common Issues

1. **SMS Not Sending**
   - Check environment variables are set correctly
   - Verify Twilio account has SMS credits
   - Check phone number format is valid

2. **Configuration Errors**
   - Ensure `.env` file is in `server/` directory
   - Verify all required variables are present
   - Check for typos in variable names

3. **Phone Number Issues**
   - Ensure phone numbers are in valid format
   - Verify country codes are correct
   - Check if phone numbers can receive SMS

### Debug Logging

The system provides detailed logging:

```
[BookingFlow] Appointment saved to database for user 1
[BookingFlow] SMS confirmation sent to +919876543210
[SMS] SMS sent successfully. SID: SMxxxxxxxxxxxxxxxxxxxxxxxx
```

## Production Considerations

1. **Real Phone Numbers**: Replace demo phone numbers with actual patient numbers
2. **SMS Costs**: Monitor Twilio SMS usage and costs
3. **Rate Limiting**: Consider implementing rate limiting for SMS sending
4. **Compliance**: Ensure SMS communications comply with local regulations
5. **Database Integration**: Store SMS delivery status in your database

## Security Notes

- Keep Twilio credentials secure and never commit them to version control
- Use environment variables for all sensitive configuration
- Regularly rotate Twilio Auth Tokens
- Monitor Twilio account for unusual activity

## Support

For issues with:
- **Twilio Service**: Contact Twilio support
- **Integration**: Check application logs and configuration
- **Phone Number Issues**: Verify phone number formats and carrier compatibility
