import express from 'express';
import { translateText } from '../services/translator.js';
import twilio from 'twilio';
import bookingFlowController from '../services/bookingFlowController.js';
import twilioTTSHelper from '../services/twilioTTSHelper.js';

const router = express.Router();
const VoiceResponse = twilio.twiml.VoiceResponse;

// Handle incoming voice calls
router.post('/', async (req, res) => {
  const twiml = new VoiceResponse();

  // Extract patient context from query parameters
  const patientName = req.query.patientName || req.body.patientName || '';
  const userId = req.query.userId || req.body.userId || '1'; // Default to user 1 for demo
  const callSid = req.body.CallSid || '';
  const language = req.query.language || req.body.language || 'en';

  console.log(`[VOICE] Incoming call - callSid: ${callSid}, userId: ${userId}, name: ${patientName}, language: ${language}`);

  try {
    // Check for existing appointments first
    const sqliteService = (await import('../services/sqliteService.js')).default;
    const existingAppointments = await sqliteService.getUserAppointments(userId);
    
    let questionText;
    
    if (existingAppointments.success && existingAppointments.appointments.length > 0) {
      // User has existing appointments - show reschedule options
      const appointment = existingAppointments.appointments[0];
      const userName = patientName || 'valued customer';
      
      let appointmentDetails = '';
      if (appointment.appointment_type === 'home') {
        appointmentDetails = `Home visit scheduled for tomorrow at ${appointment.appointment_time}`;
      } else {
        appointmentDetails = `Appointment at ${appointment.center_name} tomorrow at ${appointment.appointment_time}`;
      }
      
      questionText = await translateText(`Hi ${userName}, I see you already have an appointment set up: ${appointmentDetails}. What would you like to do with it? You can reschedule, keep it as is, or cancel it.`, language);
    } else {
      // No existing appointments - normal booking flow
      const greeting = patientName
        ? `Welcome ${patientName}!`
        : 'Welcome to Health India AI.';
      const translatedGreeting = await translateText(greeting, language);

      const greetingAudioUrl = await twilioTTSHelper.generateAudioURL(translatedGreeting, language);
      twiml.play(greetingAudioUrl);

      questionText = await translateText('How can I help you today? Would you prefer having a doctor visit you at home, or would you rather go to a diagnostic center?', language);
    }

    const questionAudioUrl = await twilioTTSHelper.generateAudioURL(questionText, language);

    // Gather speech input
    const hasExistingAppointment = existingAppointments.success && existingAppointments.appointments.length > 0;
    
    let recognitionLanguage = 'en-IN';
    if (language === 'hi') recognitionLanguage = 'hi-IN';
    if (language === 'mr') recognitionLanguage = 'mr-IN';

    const gatherParams = {
      input: 'speech',
      action: `/voice/gather?userId=${encodeURIComponent(userId)}&patientName=${encodeURIComponent(patientName)}&callSid=${encodeURIComponent(callSid)}&hasExistingAppointment=${encodeURIComponent(hasExistingAppointment)}&language=${encodeURIComponent(language)}`,
      method: 'POST',
      speechTimeout: 'auto',
      language: recognitionLanguage,
      enhanced: true
    };

    const gather = twiml.gather(gatherParams);
    gather.play(questionAudioUrl);

    // If no input, repeat
    twiml.redirect(`/voice?userId=${encodeURIComponent(userId)}&patientName=${encodeURIComponent(patientName)}`);

    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error in voice route:', error);

    try {
      const errorMessage = await translateText('I apologize, but I encountered an error. Please try again later.', language);
      const errorAudioUrl = await twilioTTSHelper.generateAudioURL(errorMessage, language);
      const twiml = new VoiceResponse();
      twiml.play(errorAudioUrl);
      twiml.hangup();
      res.type('text/xml');
      res.send(twiml.toString());
      return;
    } catch(err) {}

    const twiml = new VoiceResponse();
    twiml.say(
      {
        voice: 'Alice',
        language: 'en-US'
      },
      'I apologize, but I encountered an error. Please try again later.'
    );
    twiml.hangup();

    res.type('text/xml');
    res.send(twiml.toString());
  }
});

export default router;
