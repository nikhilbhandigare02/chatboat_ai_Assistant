/**
 * SMS Service using Twilio
 * Handles sending SMS notifications for appointment confirmations
 */

import twilio from 'twilio';

class SMSService {
  constructor() {
    // Initialize Twilio client with environment variables
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    
    if (!this.accountSid || !this.authToken || !this.twilioPhoneNumber) {
      console.warn('[SMS] Twilio credentials not found in environment variables');
      this.client = null;
    } else {
      this.client = twilio(this.accountSid, this.authToken);
    }
  }

  /**
   * Send appointment confirmation SMS
   * @param {Object} appointmentDetails - Appointment information
   * @param {string} appointmentDetails.userName - Patient name
   * @param {string} appointmentDetails.userPhone - Patient phone number
   * @param {string} appointmentDetails.appointmentType - 'home' or 'center'
   * @param {string} appointmentDetails.appointmentTime - Time slot
   * @param {string} appointmentDetails.centerName - Center name (if applicable)
   * @param {string} appointmentDetails.centerAddress - Center address (if applicable)
   * @returns {Promise<Object>} - Result of SMS sending
   */
  async sendAppointmentConfirmation(appointmentDetails) {
    if (!this.client) {
      console.log('[SMS] Twilio not configured - skipping SMS sending');
      return {
        success: false,
        message: 'SMS service not configured',
        error: 'Missing Twilio credentials'
      };
    }

    const {
      userName,
      userPhone,
      appointmentType,
      appointmentTime,
      centerName,
      centerAddress
    } = appointmentDetails;

    if (!userPhone) {
      console.error('[SMS] No phone number provided for SMS');
      return {
        success: false,
        message: 'No phone number provided',
        error: 'Missing phone number'
      };
    }

    try {
      // Format phone number (ensure it starts with + for international format)
      const formattedPhone = this.formatPhoneNumber(userPhone);
      
      // Create SMS message
      const smsMessage = this.buildAppointmentMessage({
        userName,
        appointmentType,
        appointmentTime,
        centerName,
        centerAddress
      });

      console.log(`[SMS] Sending appointment confirmation to ${formattedPhone}`);

      // Send SMS via Twilio
      const message = await this.client.messages.create({
        body: smsMessage,
        from: this.twilioPhoneNumber,
        to: formattedPhone
      });

      console.log(`[SMS] SMS sent successfully. SID: ${message.sid}`);
      
      return {
        success: true,
        message: 'SMS sent successfully',
        sid: message.sid,
        to: formattedPhone,
        body: smsMessage
      };

    } catch (error) {
      console.error('[SMS] Error sending SMS:', error);
      
      return {
        success: false,
        message: 'Failed to send SMS',
        error: error.message,
        errorCode: error.code
      };
    }
  }

  /**
   * Format phone number to E.164 format
   * @param {string} phoneNumber - Phone number to format
   * @returns {string} - Formatted phone number
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // If number doesn't start with country code, assume it's for the same country
    // For India, add +91 prefix if number is 10 digits
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    
    // Add + prefix for international format
    return '+' + cleaned;
  }

  /**
   * Build appointment confirmation message
   * @param {Object} details - Appointment details
   * @returns {string} - Formatted SMS message
   */
  buildAppointmentMessage(details) {
    const { userName, appointmentType, appointmentTime, centerName, centerAddress } = details;
    
    let message = `Dear ${userName},\n\n`;
    message += `Your medical appointment is confirmed for tomorrow at ${appointmentTime}.`;
    
    if (appointmentType === 'home') {
      message += ` A medical professional will visit you at your home.`;
      message += `\n\nPlease ensure:\n- Be available for the appointment\n- Keep ID proof and insurance card ready\n- Fasting may be required for blood tests`;
    } else {
      message += ` Location: ${centerName}`;
      message += `\nAddress: ${centerAddress}`;
      message += `\n\nPlease ensure:\n- Arrive 10 minutes early\n- Bring ID proof and insurance card\n- Fasting may be required for blood tests`;
    }
    
    message += `\n\nFor any queries, please contact our helpline.\n`;
    message += `Thank you for choosing MedInsure!`;
    
    return message;
  }

  /**
   * Test SMS service configuration
   * @returns {boolean} - True if service is properly configured
   */
  isConfigured() {
    return !!(this.client && this.accountSid && this.authToken && this.twilioPhoneNumber);
  }

  /**
   * Send test SMS (for development/testing)
   * @param {string} toPhoneNumber - Phone number to send test SMS
   * @returns {Promise<Object>} - Result of test SMS
   */
  async sendTestSMS(toPhoneNumber) {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'SMS service not configured',
        error: 'Missing Twilio credentials'
      };
    }

    try {
      const formattedPhone = this.formatPhoneNumber(toPhoneNumber);
      
      const message = await this.client.messages.create({
        body: 'This is a test SMS from MedInsure Appointment System. If you receive this, SMS service is working correctly.',
        from: this.twilioPhoneNumber,
        to: formattedPhone
      });

      console.log(`[SMS] Test SMS sent successfully. SID: ${message.sid}`);
      
      return {
        success: true,
        message: 'Test SMS sent successfully',
        sid: message.sid,
        to: formattedPhone
      };

    } catch (error) {
      console.error('[SMS] Error sending test SMS:', error);
      
      return {
        success: false,
        message: 'Failed to send test SMS',
        error: error.message
      };
    }
  }
}

// Create and export singleton instance
const smsService = new SMSService();
export default smsService;
