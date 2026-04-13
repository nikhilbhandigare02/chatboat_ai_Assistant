/**
 * Appointment Booking Flow Controller
 * Handles the conversation state machine for appointment booking
 * Supports multiple channels: chat, voice, call
 */

import sessionManager from './bookingSessionManager.js';
import { extractIntent } from './dynamicIntentExtractor.js';
import sqliteService from './sqliteService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  DEMO_USERS,
  FLOW_TYPES,
  STEPS,
  TIME_SLOTS,
  DIAGNOSTIC_CENTERS,
  checkSlotAvailability,
  getAvailableSlots,
  getUserById,
  getCenterById
} from './bookingMockData.js';

class BookingFlowController {
  /**
   * Start a new booking session
   */
  async startSession(userId, channelType = 'chat') {
    // Validate user
    const user = getUserById(userId);
    if (!user) {
      return {
        success: false,
        message: 'Invalid user ID',
        error: 'User not found'
      };
    }

    const sessionId = sessionManager.createSession(userId, channelType);
    const session = sessionManager.getSession(sessionId);

    // Update with user name
    sessionManager.updateSession(sessionId, { userName: user.name });

    // Check for existing appointments
    try {
      const existingAppointments = await sqliteService.getUserAppointments(userId);
      if (existingAppointments.success && existingAppointments.appointments.length > 0) {
        // Store existing appointments in session
        sessionManager.updateSession(sessionId, { 
          existingAppointments: existingAppointments.appointments,
          currentStep: STEPS.EXISTING_APPOINTMENT_CHECK
        });

        const response = this.getExistingAppointmentMessage(session);
        
        // Add message to transcript
        if (response && response.message) {
          session.transcript.push({
            role: 'assistant',
            content: response.message,
            timestamp: new Date().toISOString()
          });
        }

        return {
          success: true,
          sessionId,
          userId,
          userName: user.name,
          ...response
        };
      }
    } catch (error) {
      console.error('[BookingFlow] Error checking existing appointments:', error);
    }

    // Get entry message for new booking
    const response = this.getEntryMessage(session);

    // Add entry message to transcript
    if (response && response.message) {
      session.transcript.push({
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString()
      });
    }

    return {
      success: true,
      sessionId,
      userId,
      userName: user.name,
      ...response
    };
  }

  /**
   * Handle user input and return next step
   * Now uses AI intent extraction for natural language understanding
   */
  async handleUserInput(sessionId, userInput) {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        message: 'Session not found',
        error: 'Invalid session ID'
      };
    }

    // Add user message to transcript
    session.transcript.push({
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString()
    });

    const currentStep = session.currentStep;

    // Use AI to extract intent from natural language
    const extractedInput = await extractIntent(userInput, currentStep);

    let response;

    switch (currentStep) {
      case STEPS.ENTRY:
        response = this.handleFlowSelection(session, extractedInput);
        break;

      case STEPS.FLOW_SELECTION:
        response = this.handleFlowSelection(session, extractedInput);
        break;

      case STEPS.CENTER_SELECTION:
        response = this.handleCenterSelection(session, extractedInput);
        break;

      case STEPS.DISTANCE_CONFIRMATION:
        response = this.handleDistanceConfirmation(session, extractedInput);
        break;

      case STEPS.TIME_SELECTION:
        response = this.handleTimeSelection(session, extractedInput);
        break;

      case STEPS.EXISTING_APPOINTMENT_CHECK:
        response = this.handleExistingAppointmentResponse(session, extractedInput);
        break;

      case STEPS.RESCHEDULE_OPTIONS:
        response = this.handleRescheduleOptions(session, extractedInput);
        break;

      case STEPS.RESCHEDULE_TIME_SELECTION:
        response = this.handleRescheduleTimeSelection(session, extractedInput);
        break;

      default:
        response = {
          success: false,
          message: 'Invalid step',
          error: 'Unknown step in flow'
        };
    }

    // Add assistant response to transcript
    if (response && response.message) {
      session.transcript.push({
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString()
      });
    }

    return response;
  }

  /**
   * Handle flow selection (Home vs Diagnostic Center)
   */
  handleFlowSelection(session, userInput) {
    const input = userInput.toString().trim().toLowerCase();
    const userName = session.userName || 'friend';

    // Handle out_of_scope responses
    if (input === 'out_of_scope') {
      return {
        success: true,
        message: "I can help you schedule your mandatory medical check‑up. Would you like a doctor to visit your home, or would you prefer to go to a diagnostic center?",
        options: ['Home Visit', 'Diagnostic Center Visit'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.ENTRY
      };
    }

    // Handle incomplete responses
    if (input === 'incomplete') {
      return {
        success: true,
        message: "I'm sorry, I didn't catch the complete request. Could you please tell me your preference?\n\nWould you prefer a doctor to visit you at home, or would you like to visit one of our diagnostic centers?\n\n.",
        options: ['Home Visit', 'Diagnostic Center Visit'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.ENTRY
      };
    }

    if (input === '1' || input === 'one' || input === 'home' || input === 'home visit') {
      // Home Visit selected
      sessionManager.updateSession(session.sessionId, {
        selectedFlow: FLOW_TYPES.HOME,
        currentStep: STEPS.TIME_SELECTION
      });

      return this.getHomeVisitTimeSelection(session);
    } else if (input === '2' || input === 'two' || input === 'center' || input === 'diagnostic' || input === 'diagnostic center') {
      // Diagnostic Center selected
      sessionManager.updateSession(session.sessionId, {
        selectedFlow: FLOW_TYPES.CENTER,
        currentStep: STEPS.CENTER_SELECTION
      });

      return this.getCenterSelection(session);
    } else {
      // Invalid input - ask again with acknowledgment
      return {
        success: true,
        message: `Sorry, I didn't catch that. Would you like a home visit, or would you prefer a diagnostic center?`,
        options: ['Home Visit', 'Diagnostic Center Visit'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.ENTRY
      };
    }
  }

  /**
   * Handle center selection
   */
  handleCenterSelection(session, userInput) {
    const input = userInput.toString().trim();

    // Handle out_of_scope responses
    if (input === 'out_of_scope') {
      return {
        success: true,
        message: "I can help you book your medical check‑up. Nearby options include HealthCare (about 2 km), City Lab (around 5 km), and MedPlus (about 8 km). Which would you like to choose?",
        options: ['HealthCare', 'City Lab', 'MedPlus'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.CENTER_SELECTION
      };
    }

    // Handle incomplete responses
    if (input === 'incomplete') {
      return {
        success: true,
        message: "I didn't catch the center name. You can choose HealthCare, City Lab, or MedPlus — which works for you?",
        options: ['HealthCare', 'City Lab', 'MedPlus'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.CENTER_SELECTION
      };
    }

    if (isNaN(input) || input < 1 || input > 3) {
      // Invalid center number - help user
      return {
        success: true,
        message: `Sorry, I didn't catch that. Which center would you like — HealthCare, City Lab, or MedPlus?`,
        options: ['HealthCare', 'City Lab', 'MedPlus'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.CENTER_SELECTION
      };
    }

    const selectedCenter = DIAGNOSTIC_CENTERS[input - 1];

    if (selectedCenter.isFar) {
      // Center is far - need confirmation
      sessionManager.updateSession(session.sessionId, {
        selectedCenter: selectedCenter.id,
        currentStep: STEPS.DISTANCE_CONFIRMATION
      });

      return this.getDistanceConfirmation(session, selectedCenter);
    } else {
      // Center is near - go to time selection
      sessionManager.updateSession(session.sessionId, {
        selectedCenter: selectedCenter.id,
        currentStep: STEPS.TIME_SELECTION
      });

      return this.getDiagnosticCenterTimeSelection(session, selectedCenter);
    }
  }

  /**
   * Handle distance confirmation
   */
  handleDistanceConfirmation(session, userInput) {
    const input = userInput.toString().trim().toLowerCase();

    // Handle out_of_scope responses
    if (input === 'out_of_scope') {
      const center = getCenterById(session.selectedCenter);
      return {
        success: true,
        message: "You've chosen " + center.name + ". It's about " + center.distance + " from you. Does that work, or would you prefer a closer center? You can just say yes or no.",
        options: ['Yes', 'No'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.DISTANCE_CONFIRMATION
      };
    }

    // Handle incomplete responses
    if (input === 'incomplete') {
      const center = getCenterById(session.selectedCenter);
      return {
        success: true,
        message: "I didn't catch that. " + center.name + " is about " + center.distance + " from you. Is that okay? Please say yes or no.",
        options: ['Yes', 'No'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.DISTANCE_CONFIRMATION
      };
    }

    if (input === 'yes' || input === '1' || input === 'one' || input === 'okay' || input === 'ok') {
      // User wants to proceed
      const center = getCenterById(session.selectedCenter);

      sessionManager.updateSession(session.sessionId, {
        currentStep: STEPS.TIME_SELECTION
      });

      return this.getDiagnosticCenterTimeSelection(session, center);
    } else if (input === 'no' || input === '2' || input === 'two' || input === 'nope') {
      // User wants to select different center
      sessionManager.updateSession(session.sessionId, {
        selectedCenter: null,
        currentStep: STEPS.CENTER_SELECTION
      });

      return this.getCenterSelection(session);
    } else {
      // Invalid input
      const center = getCenterById(session.selectedCenter);
      return {
        success: true,
        message: `Sorry, I didn't catch that. Do you want to continue with ${center.name} or choose a different center? Please say "yes" or "no".`,
        options: ['Yes', 'No'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.DISTANCE_CONFIRMATION
      };
    }
  }

  /**
   * Handle time selection
   */
  async handleTimeSelection(session, userInput) {
    console.log(`[DEBUG] handleTimeSelection called with userInput: ${userInput}`);
    
    const input = userInput.toString().trim();

    // Handle out_of_scope responses
    if (input === 'out_of_scope') {
      return {
        success: true,
        message: "I can help you with your booking. What time in the morning works best for you? For example, you can say seven am, eight am, or nine am.",
        options: ['7 AM', '8 AM', '9 AM'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.TIME_SELECTION
      };
    }

    // Handle incomplete responses
    if (input === 'incomplete') {
      return {
        success: true,
        message: "I didn't catch the time. Could you tell me a time in the morning that suits you — for example, seven am, eight am, or nine am?",
        options: ['7 AM', '8 AM', '9 AM'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.TIME_SELECTION
      };
    }

    // Handle invalid response from intent extractor
    if (input === 'invalid') {
      return {
        success: true,
        message: `That time isn’t available. Please share a time between seven and nine in the morning — for example, seven am, eight am, or nine am.`,
        options: ['7 AM', '8 AM', '9 AM'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.TIME_SELECTION
      };
    }

    const availableSlots = getAvailableSlots(TIME_SLOTS, session.selectedFlow);

    // First check if input is a specific time format (like "8 AM", "8:30 AM", "8 a.m.", etc.)
    const timeMatch = input.match(/^(\d{1,2})(?::(\d{2}))?\s*(?:a\.?m\.?|p\.?m\.?)?$/i);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      
      // Determine AM/PM - default to AM for morning hours
      let period = 'AM';
      if (input.toLowerCase().includes('pm') || input.toLowerCase().includes('p.m.')) {
        period = 'PM';
      }
      
      // For hours 7-9, assume AM unless explicitly PM
      if (hour >= 7 && hour <= 9 && !input.toLowerCase().includes('pm') && !input.toLowerCase().includes('p.m.')) {
        period = 'AM';
      }
      
      const extractedTime = `${hour}:${minute.toString().padStart(2, '0')} ${period}`;
      console.log(`[DEBUG] Extracted time: ${extractedTime}`);
      
      // Check if this time matches one of our predefined slots
      const matchingSlot = TIME_SLOTS.find(slot => slot === extractedTime);
      if (matchingSlot) {
        // Found exact match in predefined slots
        const slotIndex = TIME_SLOTS.indexOf(matchingSlot);
        
        // Check if slot is available
        if (!checkSlotAvailability(matchingSlot, session.selectedFlow)) {
          return this.getUnavailableSlotMessage(session, matchingSlot);
        }
        
        // Time is available - proceed with booking
        sessionManager.updateSession(session.sessionId, {
          selectedTime: matchingSlot,
          currentStep: STEPS.CONFIRMATION
        });
        return this.getConfirmationMessage(session);
      } else {
        // Time format is valid but not in our predefined slots
        if (checkSlotAvailability(extractedTime, session.selectedFlow)) {
          // Time is within valid range but not a predefined slot
          sessionManager.updateSession(session.sessionId, {
            selectedTime: extractedTime,
            currentStep: STEPS.CONFIRMATION
          });
          return this.getConfirmationMessage(session);
        } else {
          // Time is outside valid range
          return {
            success: true,
            message: `I'm sorry, but "${extractedTime}" is not available. Please choose a time between 7:00 AM and 9:00 AM.`,
            options: ['7 AM', '8 AM', '9 AM'],
            type: 'selection',
            channelType: session.channelType,
            currentStep: STEPS.TIME_SELECTION
          };
        }
      }
    }

    // Check if it's a more complex time format (like "8:30 AM" with explicit AM/PM)
    const complexTimeMatch = input.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm|a\.m\.|p\.m\.)/i);
    if (complexTimeMatch) {
      const hour = complexTimeMatch[1];
      const minute = complexTimeMatch[2];
      const period = complexTimeMatch[3].replace(/\./g, '').toUpperCase();
      const extractedTime = `${hour}:${minute} ${period}`;
      
      // Validate the extracted time is within allowed range
      if (checkSlotAvailability(extractedTime, session.selectedFlow)) {
        // Time is valid - proceed with booking
        sessionManager.updateSession(session.sessionId, {
          selectedTime: extractedTime,
          currentStep: STEPS.CONFIRMATION
        });
        return this.getConfirmationMessage(session);
      } else {
        // Time is outside valid range
        return {
          success: true,
          message: `I'm sorry, but "${extractedTime}" is not available. Please choose a time between 7:00 AM and 9:00 AM.`,
          options: ['7 AM', '8 AM', '9 AM'],
          type: 'selection',
          channelType: session.channelType,
          currentStep: STEPS.TIME_SELECTION
        };
      }
    }

    // If not a time format, treat as slot number selection
    const parsedInput = parseInt(input);
    
    // Validate selection is a number between 1 and 3
    if (isNaN(parsedInput) || parsedInput < 1 || parsedInput > 3) {
      // Invalid input
      return {
        success: true,
        message: `I didn’t quite catch that. Please tell me a morning time that works for you — seven am, eight am, or nine am are available.`,
        options: ['7 AM', '8 AM', '9 AM'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.TIME_SELECTION
      };
    }

    const selectedTime = TIME_SLOTS[parsedInput - 1];

    // Check if slot is available
    if (!checkSlotAvailability(selectedTime, session.selectedFlow)) {
      // Slot not available - show available slots
      sessionManager.updateSession(session.sessionId, {
        currentStep: STEPS.TIME_SELECTION
      });

      return this.getUnavailableSlotMessage(session, selectedTime);
    }

    // Time is available - confirm booking
    sessionManager.updateSession(session.sessionId, {
      selectedTime: selectedTime,
      currentStep: STEPS.CONFIRMATION
    });

    return await this.getConfirmationMessage(session);
  }

  /**
   * Handle existing appointment response
   */
  handleExistingAppointmentResponse(session, userInput) {
    const input = userInput.toString().trim().toLowerCase();
    const userName = session.userName || 'friend';

    // Handle out_of_scope responses
    if (input === 'out_of_scope') {
      return {
        success: true,
        message: "I can help you with your existing appointment. You can choose to reschedule, continue with your current appointment, or cancel. What would you like to do?",
        options: ['Reschedule', 'Continue', 'Cancel'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.EXISTING_APPOINTMENT_CHECK
      };
    }

    // Handle incomplete responses
    if (input === 'incomplete') {
      return {
        success: true,
        message: "I didn't catch that. Would you like to reschedule your appointment, continue with it as scheduled, or cancel it?",
        options: ['Reschedule', 'Continue', 'Cancel'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.EXISTING_APPOINTMENT_CHECK
      };
    }

    if (input === '1' || input === 'one' || input === 'reschedule' || input === 'change' || input === 'modify') {
      // User wants to reschedule
      sessionManager.updateSession(session.sessionId, {
        currentStep: STEPS.RESCHEDULE_OPTIONS
      });
      return this.getRescheduleOptionsMessage(session);
    } else if (input === '2' || input === 'two' || input === 'continue' || input === 'keep' || input === 'as is') {
      // User wants to continue with existing appointment
      return this.getContinueExistingAppointmentMessage(session);
    } else if (input === '3' || input === 'three' || input === 'cancel' || input === 'cancellation') {
      // User wants to cancel
      return this.getCancelAppointmentMessage(session);
    } else {
      // Invalid input
      return {
        success: true,
        message: `Sorry, I didn't catch that. Would you like to reschedule, continue with your current appointment, or cancel it?`,
        options: ['Reschedule', 'Continue', 'Cancel'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.EXISTING_APPOINTMENT_CHECK
      };
    }
  }

  /**
   * Handle reschedule options
   */
  async handleRescheduleOptions(session, userInput) {
    const input = userInput.toString().trim().toLowerCase();

    // Handle out_of_scope responses
    if (input === 'out_of_scope') {
      return {
        success: true,
        message: "I can help you reschedule. What time in the morning works best for you? For example, you can say seven am, eight am, or nine am.",
        options: ['7 AM', '8 AM', '9 AM'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.RESCHEDULE_TIME_SELECTION
      };
    }

    // Handle incomplete responses
    if (input === 'incomplete') {
      return {
        success: true,
        message: "I didn't catch the time. What time would you like to reschedule to? For example, seven am, eight am, or nine am.",
        options: ['7 AM', '8 AM', '9 AM'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.RESCHEDULE_TIME_SELECTION
      };
    }

    // Check if input is a time (like "9 am", "8:30", etc.)
    const timeMatch = input.match(/^(\d{1,2})(?::(\d{2}))?\s*(?:a\.?m\.?|p\.?m\.?)?$/i);
    const complexTimeMatch = input.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm|a\.m\.|p\.m\.)/i);
    
    if (timeMatch || complexTimeMatch || ['7 am', '8 am', '9 am', '7:00 am', '8:00 am', '9:00 am'].includes(input.toLowerCase())) {
      // User provided a time, delegate to time selection handler
      sessionManager.updateSession(session.sessionId, {
        currentStep: STEPS.RESCHEDULE_TIME_SELECTION
      });
      return await this.handleRescheduleTimeSelection(session, input);
    }

    // Otherwise, ask for time selection
    sessionManager.updateSession(session.sessionId, {
      currentStep: STEPS.RESCHEDULE_TIME_SELECTION
    });

    return {
      success: true,
      message: "What time would you like to reschedule your appointment to? You can say something like seven am, eight am, or nine am.",
      options: ['7 AM', '8 AM', '9 AM'],
      type: 'selection',
      channelType: session.channelType,
      currentStep: STEPS.RESCHEDULE_TIME_SELECTION
    };
  }

  /**
   * Handle reschedule time selection
   */
  async handleRescheduleTimeSelection(session, userInput) {
    console.log(`[DEBUG] handleRescheduleTimeSelection called with userInput: ${userInput}`);
    
    const input = userInput.toString().trim();

    // Handle out_of_scope responses
    if (input === 'out_of_scope') {
      return {
        success: true,
        message: "I can help you reschedule. What time in the morning works best for you? For example, you can say seven am, eight am, or nine am.",
        options: ['7 AM', '8 AM', '9 AM'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.RESCHEDULE_TIME_SELECTION
      };
    }

    // Handle incomplete responses
    if (input === 'incomplete') {
      return {
        success: true,
        message: "I didn't catch the time. What time would you like to reschedule to? For example, seven am, eight am, or nine am.",
        options: ['7 AM', '8 AM', '9 AM'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.RESCHEDULE_TIME_SELECTION
      };
    }

    // Handle invalid response from intent extractor
    if (input === 'invalid') {
      return {
        success: true,
        message: `That time isn't available for rescheduling. Please share a time between seven and nine in the morning - for example, seven am, eight am, or nine am.`,
        options: ['7 AM', '8 AM', '9 AM'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.RESCHEDULE_TIME_SELECTION
      };
    }

    // Use the same time parsing logic as regular booking
    const availableSlots = getAvailableSlots(TIME_SLOTS, session.existingAppointments[0].appointment_type);

    // First check if input is a specific time format
    const timeMatch = input.match(/^(\d{1,2})(?::(\d{2}))?\s*(?:a\.?m\.?|p\.?m\.?)?$/i);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      
      let period = 'AM';
      if (input.toLowerCase().includes('pm') || input.toLowerCase().includes('p.m.')) {
        period = 'PM';
      }
      
      if (hour >= 7 && hour <= 9 && !input.toLowerCase().includes('pm') && !input.toLowerCase().includes('p.m.')) {
        period = 'AM';
      }
      
      const extractedTime = `${hour}:${minute.toString().padStart(2, '0')} ${period}`;
      console.log(`[DEBUG] Extracted reschedule time: ${extractedTime}`);
      
      const matchingSlot = TIME_SLOTS.find(slot => slot === extractedTime);
      if (matchingSlot) {
        if (!checkSlotAvailability(matchingSlot, session.existingAppointments[0].appointment_type)) {
          return this.getUnavailableSlotMessage(session, matchingSlot);
        }
        
        // Update the appointment in database
        try {
          const existingAppointment = session.existingAppointments[0];
          await sqliteService.rescheduleAppointment(existingAppointment.id, matchingSlot);
          
          sessionManager.updateSession(session.sessionId, {
            currentStep: STEPS.COMPLETED
          });

          return this.getRescheduleConfirmationMessage(session, existingAppointment, matchingSlot);
        } catch (error) {
          console.error('[BookingFlow] Error rescheduling appointment:', error);
          return {
            success: false,
            message: 'Sorry, I encountered an error while rescheduling your appointment. Please try again.',
            error: 'Database error'
          };
        }
      } else {
        if (checkSlotAvailability(extractedTime, session.existingAppointments[0].appointment_type)) {
          try {
            const existingAppointment = session.existingAppointments[0];
            await sqliteService.rescheduleAppointment(existingAppointment.id, extractedTime);
            
            sessionManager.updateSession(session.sessionId, {
              currentStep: STEPS.COMPLETED
            });

            return this.getRescheduleConfirmationMessage(session, existingAppointment, extractedTime);
          } catch (error) {
            console.error('[BookingFlow] Error rescheduling appointment:', error);
            return {
              success: false,
              message: 'Sorry, I encountered an error while rescheduling your appointment. Please try again.',
              error: 'Database error'
            };
          }
        } else {
          return {
            success: true,
            message: `I'm sorry, but "${extractedTime}" is not available. Please choose a time between 7:00 AM and 9:00 AM.`,
            options: ['7 AM', '8 AM', '9 AM'],
            type: 'selection',
            channelType: session.channelType,
            currentStep: STEPS.RESCHEDULE_TIME_SELECTION
          };
        }
      }
    }

    // Handle slot number selection
    const parsedInput = parseInt(input);
    
    if (isNaN(parsedInput) || parsedInput < 1 || parsedInput > 3) {
      return {
        success: true,
        message: `I didn't quite catch that. Please tell me a morning time that works for you - seven am, eight am, or nine am are available.`,
        options: ['7 AM', '8 AM', '9 AM'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.RESCHEDULE_TIME_SELECTION
      };
    }

    const selectedTime = TIME_SLOTS[parsedInput - 1];

    if (!checkSlotAvailability(selectedTime, session.existingAppointments[0].appointment_type)) {
      return this.getUnavailableSlotMessage(session, selectedTime);
    }

    // Update the appointment in database
    try {
      const existingAppointment = session.existingAppointments[0];
      await sqliteService.rescheduleAppointment(existingAppointment.id, selectedTime);
      
      sessionManager.updateSession(session.sessionId, {
        currentStep: STEPS.COMPLETED
      });

      return this.getRescheduleConfirmationMessage(session, existingAppointment, selectedTime);
    } catch (error) {
      console.error('[BookingFlow] Error rescheduling appointment:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error while rescheduling your appointment. Please try again.',
        error: 'Database error'
      };
    }
  }

  // ============ MESSAGE GENERATION METHODS ============

  /**
   * Entry message - Welcome and flow selection
   */
  getEntryMessage(session) {
    const channelType = session.channelType;
    const userName = session.userName || 'valued customer';

    let message = `Hi ${userName}, welcome to MedInsure. We need to schedule your mandatory medical check‑up. Would you like a doctor to visit your home, or would you prefer to go to a diagnostic center?`;

    const options = ['Home Visit', 'Diagnostic Center Visit'];

    return {
      success: true,
      message,
      options,
      type: 'selection',
      channelType,
      currentStep: STEPS.ENTRY
    };
  }

  /**
   * Home visit time selection
   */
  getHomeVisitTimeSelection(session) {
    const message = `Great — a home visit it is. What time in the morning works best for you? You can say something like seven am, eight am, or nine am.`;

    return {
      success: true,
      message,
      options: ['7 AM', '8 AM', '9 AM'],
      type: 'selection',
      channelType: session.channelType,
      currentStep: STEPS.TIME_SELECTION
    };
  }

  /**
   * Diagnostic center selection
   */
  getCenterSelection(session) {
    let message = `Here are a few nearby options: `;
    message += `${DIAGNOSTIC_CENTERS[0].name} (${DIAGNOSTIC_CENTERS[0].distance}), `;
    message += `${DIAGNOSTIC_CENTERS[1].name} (${DIAGNOSTIC_CENTERS[1].distance}), `;
    message += `and ${DIAGNOSTIC_CENTERS[2].name} (${DIAGNOSTIC_CENTERS[2].distance}). Which would you like to go with?`;

    const options = ['HealthCare', 'City Lab', 'MedPlus'];

    return {
      success: true,
      message,
      options,
      type: 'selection',
      channelType: session.channelType,
      currentStep: STEPS.CENTER_SELECTION
    };
  }

  /**
   * Distance confirmation for far centers
   */
  getDistanceConfirmation(session, center) {
    const message = `You’ve selected ${center.name}. It’s about ${center.distance} from you. Does that work, or would you prefer something closer? You can say yes or no.`;

    return {
      success: true,
      message,
      options: ['Yes', 'No'],
      type: 'selection',
      channelType: session.channelType,
      currentStep: STEPS.DISTANCE_CONFIRMATION
    };
  }

  /**
   * Diagnostic center time selection  
   */
  getDiagnosticCenterTimeSelection(session, center) {
    const centerName = center.name;
    const message = `Great — we’ll book it at ${centerName}. What time in the morning would you like? For example, seven am, eight am, or nine am.`;

    return {
      success: true,
      message, 
      options: ['7 AM', '8 AM', '9 AM'],
      type: 'selection',
      channelType: session.channelType,
      currentStep: STEPS.TIME_SELECTION
    };
  }

  /**
   * Unavailable slot message
   */
  getUnavailableSlotMessage(session, selectedTime) {
    console.log(`[DEBUG] getUnavailableSlotMessage called with selectedTime: ${selectedTime}`);
    const availableSlots = getAvailableSlots(TIME_SLOTS, session.selectedFlow);
    let message = `That time isn’t available right now.`;
    console.log(`[DEBUG] Generated message: ${message}`);

    if (session.selectedFlow === FLOW_TYPES.HOME) {
      message += ` For home visits, available times are `;
    } else {
      const center = getCenterById(session.selectedCenter);
      message += ` At ${center.name}, available times are `;
    }

    message += `${availableSlots.join(', ')}.`;

    message += ` Which of these works for you?`;

    const slotOptions = availableSlots.map(
      slot => `${TIME_SLOTS.indexOf(slot) + 1} - ${slot}`
    );

    return {
      success: true,
      message,
      options: slotOptions,
      type: 'selection',
      channelType: session.channelType,
      currentStep: STEPS.TIME_SELECTION
    };
  }

  /**
   * Time selection message (generic)
   */
  getTimeSelectionMessage(session) {
    if (session.selectedFlow === FLOW_TYPES.HOME) {
      return this.getHomeVisitTimeSelection(session);
    } else {
      const center = getCenterById(session.selectedCenter);
      return this.getDiagnosticCenterTimeSelection(session, center);
    }
  }

  /**
   * Invalid input retry message
   */
  getInvalidInputMessage(session) {
    const currentStep = session.currentStep;

    if (currentStep === STEPS.TIME_SELECTION) {
      return {
        success: true,
        message: `I didn’t catch that. Please share a morning time that suits you — for example, seven am, eight am, or nine am.`,
        options: ['7 AM', '8 AM', '9 AM'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.TIME_SELECTION
      };
    } else if (currentStep === STEPS.CENTER_SELECTION) {
      return this.getCenterSelection(session);
    } else if (currentStep === STEPS.DISTANCE_CONFIRMATION) {
      const center = getCenterById(session.selectedCenter);
      return this.getDistanceConfirmation(session, center);
    }

    return this.getEntryMessage(session);
  }

  /**
   * Confirmation message - Booking confirmed
   */
  async getConfirmationMessage(session) {
    let message = `Your medical appointment is all set.`;

    let centerName = null;
    let centerAddress = null;
    
    if (session.selectedFlow === FLOW_TYPES.HOME) {
      message += ` A medical professional will visit you at your home tomorrow at ${session.selectedTime}.`;
    } else {
      const center = getCenterById(session.selectedCenter);
      centerName = center.name;
      centerAddress = center.address;
      message += ` Your appointment is confirmed at ${center.name} tomorrow at ${session.selectedTime}.`;
    }

    message += `\n\nHere are some important instructions:\n`;
    message += `- Please come or be present for a fasting blood test if required.\n`;
    message += `- Keep your ID proof and insurance policy card ready.\n`;

    if (session.selectedFlow === FLOW_TYPES.HOME) {
      message += `- Our medical professional will call you 30 minutes before arrival.\n`;
    } else {
      message += `- Location: ${centerAddress}\n`;
      message += `- Please arrive 10 minutes early.\n`;
    }

    message += `\nThank you for choosing MedInsure. We're committed to your health!`;

    // Save appointment to database
    try {
      await sqliteService.saveAppointment({
        userId: session.userId,
        userName: session.userName,
        appointmentType: session.selectedFlow,
        centerId: session.selectedCenter || null,
        centerName: centerName,
        centerAddress: centerAddress,
        appointmentTime: session.selectedTime,
        sessionId: session.sessionId
      });
      console.log(`[BookingFlow] Appointment saved to database for user ${session.userId}`);
    } catch (error) {
      console.error('[BookingFlow] Error saving appointment to database:', error);
    }

    sessionManager.updateSession(session.sessionId, {
      currentStep: STEPS.COMPLETED
    });

    // Save the transcript to a file
    this.saveTranscript(session);

    return {
      success: true,
      message,
      options: [],
      type: 'confirmation',
      channelType: session.channelType,
      currentStep: STEPS.CONFIRMATION,
      bookingDetails: {
        flow: session.selectedFlow,
        center: session.selectedFlow === FLOW_TYPES.CENTER ? session.selectedCenter : null,
        time: session.selectedTime,
        user: session.userName
      }
    };
  }

  /**
   * Save conversation transcript to a file
   */
  saveTranscript(session) {
    try {
      const transcriptsDir = path.join(__dirname, '..', 'transcripts');
      if (!fs.existsSync(transcriptsDir)) {
        fs.mkdirSync(transcriptsDir, { recursive: true });
      }

      const filename = `transcript_${session.userId}_${session.sessionId}_${Date.now()}.json`;
      const filePath = path.join(transcriptsDir, filename);

      const transcriptData = {
        sessionId: session.sessionId,
        userId: session.userId,
        userName: session.userName,
        channelType: session.channelType,
        completedAt: new Date().toISOString(),
        bookingDetails: {
          flow: session.selectedFlow,
          center: session.selectedCenter,
          time: session.selectedTime
        },
        transcript: session.transcript
      };

      fs.writeFileSync(filePath, JSON.stringify(transcriptData, null, 2));
      console.log(`[Transcript] Saved to ${filePath}`);
    } catch (error) {
      console.error('[Transcript Error] Failed to save transcript:', error.message);
    }
  }

  /**
   * Get existing appointment message
   */
  getExistingAppointmentMessage(session) {
    const appointment = session.existingAppointments[0];
    const userName = session.userName || 'valued customer';
    
    let message = `Hi ${userName}, I found your existing appointment: `;
    
    if (appointment.appointment_type === 'home') {
      message += `Home visit scheduled for tomorrow at ${appointment.appointment_time}.`;
    } else {
      message += `Appointment at ${appointment.center_name} tomorrow at ${appointment.appointment_time}.`;
    }
    
    message += `\n\nWhat would you like to do?`;

    return {
      success: true,
      message,
      options: ['Reschedule', 'Continue', 'Cancel'],
      type: 'selection',
      channelType: session.channelType,
      currentStep: STEPS.EXISTING_APPOINTMENT_CHECK
    };
  }

  /**
   * Get reschedule options message
   */
  getRescheduleOptionsMessage(session) {
    const appointment = session.existingAppointments[0];
    
    let message = `I can help you reschedule your appointment.`;
    
    if (appointment.appointment_type === 'home') {
      message += ` Your current home visit is scheduled for tomorrow at ${appointment.appointment_time}.`;
    } else {
      message += ` Your current appointment at ${appointment.center_name} is scheduled for tomorrow at ${appointment.appointment_time}.`;
    }
    
    message += `\n\nWhat time would you like to reschedule to?`;

    return {
      success: true,
      message,
      options: ['7 AM', '8 AM', '9 AM'],
      type: 'selection',
      channelType: session.channelType,
      currentStep: STEPS.RESCHEDULE_TIME_SELECTION
    };
  }

  /**
   * Get continue existing appointment message
   */
  async getContinueExistingAppointmentMessage(session) {
    const appointment = session.existingAppointments[0];
    const userName = session.userName || 'valued customer';
    
    let message = `Great! Your appointment is confirmed as scheduled.`;
    
    if (appointment.appointment_type === 'home') {
      message += ` A medical professional will visit you at your home tomorrow at ${appointment.appointment_time}.`;
    } else {
      message += ` Your appointment at ${appointment.center_name} is confirmed for tomorrow at ${appointment.appointment_time}.`;
    }

    message += `\n\nHere are some important instructions:\n`;
    message += `- Please come or be present for a fasting blood test if required.\n`;
    message += `- Keep your ID proof and insurance policy card ready.\n`;

    if (appointment.appointment_type === 'home') {
      message += `- Our medical professional will call you 30 minutes before arrival.\n`;
    } else {
      message += `- Location: ${appointment.center_address}\n`;
      message += `- Please arrive 10 minutes early.\n`;
    }

    message += `\nThank you for choosing MedInsure. We're committed to your health!`;

    sessionManager.updateSession(session.sessionId, {
      currentStep: STEPS.COMPLETED
    });

    return {
      success: true,
      message,
      options: [],
      type: 'confirmation',
      channelType: session.channelType,
      currentStep: STEPS.CONFIRMATION
    };
  }

  /**
   * Get cancel appointment message
   */
  async getCancelAppointmentMessage(session) {
    const appointment = session.existingAppointments[0];
    const userName = session.userName || 'valued customer';
    
    try {
      await sqliteService.updateAppointmentStatus(appointment.id, 'cancelled');
      
      const message = `Your appointment has been cancelled successfully. If you need to reschedule in the future, please call us again. Thank you for using MedInsure.`;

      sessionManager.updateSession(session.sessionId, {
        currentStep: STEPS.COMPLETED
      });

      return {
        success: true,
        message,
        options: [],
        type: 'confirmation',
        channelType: session.channelType,
        currentStep: STEPS.CONFIRMATION
      };
    } catch (error) {
      console.error('[BookingFlow] Error cancelling appointment:', error);
      return {
        success: false,
        message: 'Sorry, I encountered an error while cancelling your appointment. Please try again.',
        error: 'Database error'
      };
    }
  }

  /**
   * Get reschedule confirmation message
   */
  getRescheduleConfirmationMessage(session, oldAppointment, newTime) {
    const userName = session.userName || 'valued customer';
    
    let message = `Your appointment has been rescheduled successfully!`;
    
    if (oldAppointment.appointment_type === 'home') {
      message += ` Your home visit is now scheduled for tomorrow at ${newTime} (previously ${oldAppointment.appointment_time}).`;
    } else {
      message += ` Your appointment at ${oldAppointment.center_name} is now scheduled for tomorrow at ${newTime} (previously ${oldAppointment.appointment_time}).`;
    }

    message += `\n\nHere are some important instructions:\n`;
    message += `- Please come or be present for a fasting blood test if required.\n`;
    message += `- Keep your ID proof and insurance policy card ready.\n`;

    if (oldAppointment.appointment_type === 'home') {
      message += `- Our medical professional will call you 30 minutes before arrival.\n`;
    } else {
      message += `- Location: ${oldAppointment.center_address}\n`;
      message += `- Please arrive 10 minutes early.\n`;
    }

    message += `\nThank you for choosing MedInsure. We're committed to your health!`;

    return {
      success: true,
      message,
      options: [],
      type: 'confirmation',
      channelType: session.channelType,
      currentStep: STEPS.CONFIRMATION
    };
  }

  /**
   * Get session details
   */
  getSessionDetails(sessionId) {
    return sessionManager.getSession(sessionId);
  }
}

export default new BookingFlowController();
