import express from 'express';
import { translateText } from '../services/translator.js';
import twilio from 'twilio';
import bookingFlowController from '../services/bookingFlowController.js';
import twilioTTSHelper from '../services/twilioTTSHelper.js';
import sessionManager from '../services/bookingSessionManager.js';

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
  const language = req.query.language || 'en';

  let recognitionLanguage = 'en-IN';
  if (language === 'hi') recognitionLanguage = 'hi-IN';
  if (language === 'mr') recognitionLanguage = 'mr-IN';

  console.log(`[GATHER] ${callSid} User (${patientName || 'Anonymous'}) said: ${userSpeech} (lang: ${language})`);
  if (hasExistingAppointment) {
    console.log(`[GATHER] Voice route detected existing appointment, handling direct reschedule flow`);
  }

  if (!userSpeech || userSpeech.trim() === '') {
    try {
      // Get current retry count
      const currentAttempts = retryAttempts.get(callSid) || 0;

      if (currentAttempts >= 1) {
        // Second attempt - hang up
        const byeMessage = await translateText('I understand you may be busy. Thank you for calling Health India. Goodbye!', language);
        const byeAudioUrl = await twilioTTSHelper.generateAudioURL(byeMessage, language);
        twiml.play(byeAudioUrl);
        twiml.hangup();
      } else {
        // First attempt - ask again
        retryAttempts.set(callSid, currentAttempts + 1);
        const retryMessage = await translateText('I didn\'t catch that. Could you please say it again?', language);
        const retryAudioUrl = await twilioTTSHelper.generateAudioURL(retryMessage, language);
        twiml.play(retryAudioUrl);

        const gather = twiml.gather({
          input: 'speech',
          action: `/voice/gather?userId=${encodeURIComponent(userId)}&patientName=${encodeURIComponent(patientName)}&callSid=${encodeURIComponent(callSid)}&language=${encodeURIComponent(language)}`,
          method: 'POST',
          speechTimeout: 'auto',
          language: recognitionLanguage
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
        const startResult = await bookingFlowController.startSession(userId, 'call', language);
        if (!startResult.success) {
          const errorMessage = await translateText("I'm sorry, I can only help you with booking your medical appointment.", language);
          const errorAudioUrl = await twilioTTSHelper.generateAudioURL(errorMessage, language);
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
        const startResult = await bookingFlowController.startSession(userId, 'call', language);
        if (!startResult.success) {
          const errorMessage = await translateText("I'm sorry, I can only help you with booking your medical appointment. I'm here to assist you with scheduling your mandatory medical check-up through Health India.", language);
          const errorAudioUrl = await twilioTTSHelper.generateAudioURL(errorMessage, language);
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
      const failMessage = await translateText("Sorry, I didn\'t understand that. Let me ask again.", language);
      const failAudioUrl = await twilioTTSHelper.generateAudioURL(failMessage, language);
      twiml.play(failAudioUrl);

      if (response.options && response.options.length > 0) {
        const gather = twiml.gather({
          input: 'speech',
          action: `/voice/gather?userId=${encodeURIComponent(userId)}&patientName=${encodeURIComponent(patientName)}&callSid=${encodeURIComponent(callSid)}&language=${encodeURIComponent(language)}`,
          method: 'POST',
          speechTimeout: 'auto',
          language: recognitionLanguage,
          enhanced: true
        });

        const translatedResponseMsg = await translateText(response.message, language);
        const responseAudioUrl = await twilioTTSHelper.generateAudioURL(translatedResponseMsg, language);
        gather.play(responseAudioUrl);
      }
    } else {
      // It's a successful response (not an error message)
      if (response.type === 'confirmation') {
        const translatedResponseMsg = await translateText(response.message, language);
        const responseAudioUrl = await twilioTTSHelper.generateAudioURL(translatedResponseMsg, language);
        twiml.play(responseAudioUrl);

        const confirmMessage = await translateText('Thank you for using Health India. Goodbye!', language);
        const confirmAudioUrl = await twilioTTSHelper.generateAudioURL(confirmMessage, language);
        twiml.play(confirmAudioUrl);
        twiml.hangup();
        voiceSessionMap.delete(callSid);
        res.type('text/xml');
        res.send(twiml.toString());
        return;
      }

      // Create gather block for the user's next input
      const gather = twiml.gather({
        input: 'speech',
        action: `/voice/gather?userId=${encodeURIComponent(userId)}&patientName=${encodeURIComponent(patientName)}&callSid=${encodeURIComponent(callSid)}&language=${encodeURIComponent(language)}`,
        method: 'POST',
        speechTimeout: 'auto',
        language: recognitionLanguage,
        enhanced: true
      });

      // Play the main prompt message inside the Gather (so user can barge in)
      const translatedResponseMsg = await translateText(response.message, language);
      const responseAudioUrl = await twilioTTSHelper.generateAudioURL(translatedResponseMsg, language);
      gather.play(responseAudioUrl);

      // Play options if they exist
      if (response.options && response.options.length > 0) {
        const translatedResponseOptions = await translateText(response.options.join(' or '), language);
        const optionsAudioUrl = await twilioTTSHelper.generateAudioURL(translatedResponseOptions, language);
        gather.play(optionsAudioUrl);
      }
    }
  } catch (error) {
    console.error('Error processing speech:', error);

    const errorMessage = await translateText("I'm sorry, I can only help you with booking your medical appointment. I'm here to assist you with scheduling your mandatory medical check-up through Health India.", language);
    const errorAudioUrl = await twilioTTSHelper.generateAudioURL(errorMessage, language);
    twiml.play(errorAudioUrl);
    twiml.hangup();
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

export default router;
