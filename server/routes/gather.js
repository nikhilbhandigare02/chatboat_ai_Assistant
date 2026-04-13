import express from 'express';
import twilio from 'twilio';
import bookingFlowController from '../services/bookingFlowController.js';
import twilioTTSHelper from '../services/twilioTTSHelper.js';

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

// Session storage for voice calls (maps callSid to sessionId)
const voiceSessionMap = new Map();

// Track retry attempts for each call
const retryAttempts = new Map();

// Handle speech input from caller
router.post('/', async (req, res) => {
  const twiml = new VoiceResponse();
  const userSpeech = req.body.SpeechResult;
  const callSid = req.body.CallSid;
  const from = req.body.From;

  // Extract patient context from query parameters
  const patientName = req.query.patientName || '';
  const userId = req.query.userId || '1';
  const hasExistingAppointment = req.query.hasExistingAppointment === 'true';

  console.log(`[GATHER] ${callSid} User (${patientName || 'Anonymous'}) said: ${userSpeech}`);
  if (hasExistingAppointment) {
    console.log(`[GATHER] Voice route detected existing appointment, handling direct reschedule flow`);
  }

  if (!userSpeech || userSpeech.trim() === '') {
    try {
      // Get current retry count
      const currentAttempts = retryAttempts.get(callSid) || 0;

      if (currentAttempts >= 1) {
        // Second attempt - hang up
        const byeMessage = 'I understand you may be busy. Thank you for calling MedInsure. Goodbye!';
        const byeAudioUrl = await twilioTTSHelper.generateAudioURL(byeMessage);
        twiml.play(byeAudioUrl);
        twiml.hangup();
      } else {
        // First attempt - ask again
        retryAttempts.set(callSid, currentAttempts + 1);
        const retryMessage = 'I didn\'t catch that. Could you please say it again?';
        const retryAudioUrl = await twilioTTSHelper.generateAudioURL(retryMessage);
        twiml.play(retryAudioUrl);

        const gather = twiml.gather({
          input: 'speech',
          action: `/voice/gather?userId=${encodeURIComponent(userId)}&patientName=${encodeURIComponent(patientName)}&callSid=${encodeURIComponent(callSid)}`,
          method: 'POST',
          speechTimeout: 'auto',
          language: 'en-IN'
        });
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      twiml.say('I encountered an error. Please try again.');
      twiml.hangup();
    }

    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  try {
    let sessionId = voiceSessionMap.get(callSid);
    let response;

    // If no existing session, start a new one and process the user input
    if (!sessionId) {
      console.log(`[GATHER] Starting new booking session for user ${userId}`);
      
      if (hasExistingAppointment) {
        // Voice route already detected existing appointment, create session and handle direct reschedule
        console.log(`[GATHER] Handling direct reschedule flow for existing appointment`);
        const startResult = await bookingFlowController.startSession(userId, 'call');
        if (!startResult.success) {
          const errorMessage = "I'm sorry, I can only help you with booking your medical appointment.";
          const errorAudioUrl = await twilioTTSHelper.generateAudioURL(errorMessage);
          twiml.play(errorAudioUrl);
          twiml.hangup();
          res.type('text/xml');
          res.send(twiml.toString());
          return;
        }
        sessionId = startResult.sessionId;
        voiceSessionMap.set(callSid, sessionId);
        retryAttempts.delete(callSid);
        
        // Process user input directly for reschedule/continue/cancel
        console.log(`[GATHER] Processing direct reschedule input: "${userSpeech}"`);
        response = await bookingFlowController.handleUserInput(sessionId, userSpeech);
      } else {
        // Normal flow - start session and check for appointments
        const startResult = await bookingFlowController.startSession(userId, 'call');
        if (!startResult.success) {
          const errorMessage = "I'm sorry, I can only help you with booking your medical appointment. I'm here to assist you with scheduling your mandatory medical check-up through MedInsure.";
          const errorAudioUrl = await twilioTTSHelper.generateAudioURL(errorMessage);
          twiml.play(errorAudioUrl);
          twiml.hangup();
          res.type('text/xml');
          res.send(twiml.toString());
          return;
        }
        sessionId = startResult.sessionId;
        voiceSessionMap.set(callSid, sessionId);
        // Reset retry counter for new session
        retryAttempts.delete(callSid);

        // Check if this session has existing appointments
        if (startResult.currentStep === 'existing_appointment_check') {
          console.log(`[GATHER] User has existing appointments, showing options`);
          // Don't process user input yet, just show the existing appointment options
          response = startResult;
        } else {
          // Now process the user's initial input against the new session
          console.log(`[GATHER] Processing initial user input: "${userSpeech}"`);
          response = await bookingFlowController.handleUserInput(sessionId, userSpeech);
        }
      }
    } else {
      // Handle user input in existing session
      // Reset retry counter when user provides speech
      retryAttempts.delete(callSid);
      console.log(`[GATHER] Processing input for existing session: "${userSpeech}"`);
      response = await bookingFlowController.handleUserInput(sessionId, userSpeech);
    }

    if (!response.success) {
      const failMessage = 'Sorry, I didn\'t understand that. Let me ask again.';
      const failAudioUrl = await twilioTTSHelper.generateAudioURL(failMessage);
      twiml.play(failAudioUrl);

      if (response.options && response.options.length > 0) {
        const gather = twiml.gather({
          input: 'speech',
          action: `/voice/gather?userId=${encodeURIComponent(userId)}&patientName=${encodeURIComponent(patientName)}&callSid=${encodeURIComponent(callSid)}`,
          method: 'POST',
          speechTimeout: 'auto',
          language: 'en-IN',
          enhanced: true
        });

        const responseAudioUrl = await twilioTTSHelper.generateAudioURL(response.message);
        gather.play(responseAudioUrl);
      }
    } else {
      const responseAudioUrl = await twilioTTSHelper.generateAudioURL(response.message);
      twiml.play(responseAudioUrl);

      if (response.type === 'confirmation') {
        const confirmMessage = 'Thank you for using MedInsure. Goodbye!';
        const confirmAudioUrl = await twilioTTSHelper.generateAudioURL(confirmMessage);
        twiml.play(confirmAudioUrl);
        twiml.hangup();
        voiceSessionMap.delete(callSid);
        res.type('text/xml');
        res.send(twiml.toString());
        return;
      }
    }

    if (response.options && response.options.length > 0) {
      const gather = twiml.gather({
        input: 'speech',
        action: `/voice/gather?userId=${encodeURIComponent(userId)}&patientName=${encodeURIComponent(patientName)}&callSid=${encodeURIComponent(callSid)}`,
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-IN',
        enhanced: true
      });

      const optionsAudioUrl = await twilioTTSHelper.generateAudioURL(response.options.join(' or '));
      gather.play(optionsAudioUrl);
    } else {
      // Goodbye if no options (shouldn't reach here due to confirmation check above)
      const goodbyeMessage = 'Thank you for calling MedInsure. Have a great day!';
      const goodbyeAudioUrl = await twilioTTSHelper.generateAudioURL(goodbyeMessage);
      twiml.play(goodbyeAudioUrl);
      twiml.hangup();
    }
  } catch (error) {
    console.error('Error processing speech:', error);

    const errorMessage = "I'm sorry, I can only help you with booking your medical appointment. I'm here to assist you with scheduling your mandatory medical check-up through MedInsure.";
    const errorAudioUrl = await twilioTTSHelper.generateAudioURL(errorMessage);
    twiml.play(errorAudioUrl);
    twiml.hangup();
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

export default router;
