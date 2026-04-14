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

      case STEPS.VOICE_CONFIRMATION:
        response = await this.handleVoiceConfirmation(session, extractedInput);
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
        message: "I can help you schedule your mandatory medical check­up. Would you like a doctor to visit your home, or would you prefer to go to a diagnostic center?",
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
        message: "Sorry, I didn't understand. Can you repeat?. Could you tell me again - would you prefer a doctor to visit you at home, or would you rather go to a diagnostic center?",
        options: ['Home Visit', 'Diagnostic Center Visit'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.ENTRY
      };
    }

    if (input === '1' || input === 'one' || input === 'home' || input === 'home visit') {
      // Home Visit selected
      if (session.channelType === 'call') {
        // For voice calls, ask for confirmation first
        sessionManager.updateSession(session.sessionId, {
          pendingData: {
            step: STEPS.ENTRY,
            input: userInput,
            action: 'select_home'
          },
          previousStep: STEPS.ENTRY,
          currentStep: STEPS.VOICE_CONFIRMATION
        });

        return {
          success: true,
          message: "You chose home visit. Do you wish to confirm? Yes or No?",
          options: ['Yes', 'No'],
          type: 'selection',
          channelType: session.channelType,
          currentStep: STEPS.VOICE_CONFIRMATION
        };
      } else {
        // For chat, proceed directly
        sessionManager.updateSession(session.sessionId, {
          selectedFlow: FLOW_TYPES.HOME,
          currentStep: STEPS.TIME_SELECTION
        });

        return this.getHomeVisitTimeSelection(session);
      }
    } else if (input === '2' || input === 'two' || input === 'center' || input === 'diagnostic' || input === 'diagnostic center') {
      // Diagnostic Center selected
      if (session.channelType === 'call') {
        // For voice calls, ask for confirmation first
        sessionManager.updateSession(session.sessionId, {
          pendingData: {
            step: STEPS.ENTRY,
            input: userInput,
            action: 'select_center'
          },
          previousStep: STEPS.ENTRY,
          currentStep: STEPS.VOICE_CONFIRMATION
        });

        return {
          success: true,
          message: "You chose diagnostic center visit. Do you wish to confirm? Yes or No?",
          options: ['Yes', 'No'],
          type: 'selection',
          channelType: session.channelType,
          currentStep: STEPS.VOICE_CONFIRMATION
        };
      } else {
        // For chat, proceed directly
        sessionManager.updateSession(session.sessionId, {
          selectedFlow: FLOW_TYPES.CENTER,
          currentStep: STEPS.CENTER_SELECTION
        });

        return this.getCenterSelection(session);
      }
    } else {
      // Invalid input - ask again with acknowledgment
      return {
        success: true,
        message: `Sorry, I didn't understand. Can you repeat?. Are you thinking home visit or diagnostic center?`,
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
        message: "I can help you book your medical check‑up. There are some great nearby options - HealthCare is about 2 km away, City Lab is around 5 km, and MedPlus is about 8 km. Which one sounds good to you?",
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
        message: "Sorry, I didn't understand. Can you repeat?. We've got HealthCare, City Lab, or MedPlus available - which one works better for you?",
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
        message: `Sorry, I didn't understand. Can you repeat?. Which center sounds good - HealthCare, City Lab, or MedPlus?`,
        options: ['HealthCare', 'City Lab', 'MedPlus'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.CENTER_SELECTION
      };
    }

    const selectedCenter = DIAGNOSTIC_CENTERS[input - 1];

    if (session.channelType === 'call') {
      // For voice calls, ask for confirmation first
      sessionManager.updateSession(session.sessionId, {
        pendingData: {
          step: STEPS.CENTER_SELECTION,
          input: userInput,
          action: selectedCenter.isFar ? 'select_far_center' : 'select_near_center',
          centerId: selectedCenter.id
        },
        previousStep: STEPS.CENTER_SELECTION,
        currentStep: STEPS.VOICE_CONFIRMATION
      });

      return {
        success: true,
        message: `You chose ${selectedCenter.name}. Do you wish to confirm? Yes or No?`,
        options: ['Yes', 'No'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.VOICE_CONFIRMATION
      };
    } else {
      // For chat, proceed directly
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
        message: "Sorry, I didn't understand. Can you repeat?. " + center.name + " is about " + center.distance + " from you. Does that work for you? Just say yes or no.",
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
        message: `Sorry, I didn't understand. Can you repeat?. Are you good with ${center.name}, or would you rather look at a different center? Just let me know yes or no.`,
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
        message: "I can help you with your booking. What time in the morning works best for you? Seven am, eight am, or nine am are available.",
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
        
        // Time is available - for voice calls, ask for confirmation first
        if (session.channelType === 'call') {
          sessionManager.updateSession(session.sessionId, {
            pendingData: {
              step: STEPS.TIME_SELECTION,
              input: userInput,
              action: 'select_time',
              selectedTime: matchingSlot
            },
            previousStep: STEPS.TIME_SELECTION,
            currentStep: STEPS.VOICE_CONFIRMATION
          });

          return {
            success: true,
            message: `You chose ${matchingSlot}. Do you wish to confirm? Yes or No?`,
            options: ['Yes', 'No'],
            type: 'selection',
            channelType: session.channelType,
            currentStep: STEPS.VOICE_CONFIRMATION
          };
        } else {
          // For chat, proceed directly to confirmation
          sessionManager.updateSession(session.sessionId, {
            selectedTime: matchingSlot,
            currentStep: STEPS.CONFIRMATION
          });
          return this.getConfirmationMessage(session);
        }
      } else {
        // Time format is valid but not in our predefined slots
        if (checkSlotAvailability(extractedTime, session.selectedFlow)) {
          // Time is within valid range but not a predefined slot
          if (session.channelType === 'call') {
            sessionManager.updateSession(session.sessionId, {
              pendingData: {
                step: STEPS.TIME_SELECTION,
                input: userInput,
                action: 'select_time',
                selectedTime: extractedTime
              },
              previousStep: STEPS.TIME_SELECTION,
              currentStep: STEPS.VOICE_CONFIRMATION
            });

            return {
              success: true,
              message: `You chose ${extractedTime}. Do you wish to confirm? Yes or No?`,
              options: ['Yes', 'No'],
              type: 'selection',
              channelType: session.channelType,
              currentStep: STEPS.VOICE_CONFIRMATION
            };
          } else {
            // For chat, proceed directly to confirmation
            sessionManager.updateSession(session.sessionId, {
              selectedTime: extractedTime,
              currentStep: STEPS.CONFIRMATION
            });
            return this.getConfirmationMessage(session);
          }
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
        // Time is valid - for voice calls, ask for confirmation first
        if (session.channelType === 'call') {
          sessionManager.updateSession(session.sessionId, {
            pendingData: {
              step: STEPS.TIME_SELECTION,
              input: userInput,
              action: 'select_time',
              selectedTime: extractedTime
            },
            previousStep: STEPS.TIME_SELECTION,
            currentStep: STEPS.VOICE_CONFIRMATION
          });

          return {
            success: true,
            message: `You chose ${extractedTime}. Do you wish to confirm? Yes or No?`,
            options: ['Yes', 'No'],
            type: 'selection',
            channelType: session.channelType,
            currentStep: STEPS.VOICE_CONFIRMATION
          };
        } else {
          // For chat, proceed directly to confirmation
          sessionManager.updateSession(session.sessionId, {
            selectedTime: extractedTime,
            currentStep: STEPS.CONFIRMATION
          });
          return this.getConfirmationMessage(session);
        }
      } else {
        // Time is outside valid range
        return {
          success: true,
          message: `I'm sorry, "${extractedTime}" won't work for us. How about sometime between 7:00 AM and 9:00 AM?`,
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

    // Time is available - for voice calls, ask for confirmation first
    if (session.channelType === 'call') {
      sessionManager.updateSession(session.sessionId, {
        pendingData: {
          step: STEPS.TIME_SELECTION,
          input: userInput,
          action: 'select_time',
          selectedTime: selectedTime
        },
        previousStep: STEPS.TIME_SELECTION,
        currentStep: STEPS.VOICE_CONFIRMATION
      });

      return {
        success: true,
        message: `You chose ${selectedTime}. Do you wish to confirm? Yes or No?`,
        options: ['Yes', 'No'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.VOICE_CONFIRMATION
      };
    } else {
      // For chat, proceed directly to confirmation
      sessionManager.updateSession(session.sessionId, {
        selectedTime: selectedTime,
        currentStep: STEPS.CONFIRMATION
      });

      return await this.getConfirmationMessage(session);
    }
  }

  /**
   * NLP-based positive confirmation detection
   */
  detectPositiveConfirmation(input) {
    // Exact matches
    const exactMatches = ['yes', 'yeah', 'yep', 'yup', 'sure', 'okay', 'ok', 'alright', 'definitely', 'absolutely', 'certainly', 'of course', 'please do', 'go ahead', 'confirm', 'confirmed'];
    
    // Typos and variations
    const typoMatches = ['yesh', 'yesa', 'yess', 'yesss', 'yea', 'yas', 'yeshh', 'yessh', 'suree', 'suree', 'okk', 'okka', 'okey'];
    
    // Repetitive patterns (like "yes yes", "sure sure")
    const repetitivePatterns = /^(yes|yeah|sure|ok|yep|yup)(\s+(yes|yeah|sure|ok|yep|yup))+$/;
    
    // Mixed confirmation patterns (like "yes confirm", "confirm yes", "sure yes")
    const mixedPatterns = /^(yes|yeah|sure|ok|okay|yep|yup|alright|definitely|absolutely|certainly|confirm|confirmed|go|proceed|continue|accept|approve)\s+(yes|yeah|sure|ok|okay|yep|yup|alright|definitely|absolutely|certainly|confirm|confirmed|go|proceed|continue|accept|approve)$/;
    
    // Partial matches within longer phrases
    const partialMatches = [
      'yes please', 'yes that works', 'yes that sounds good', 'yes i agree', 
      'yes that\'s fine', 'yes that\'s correct', 'yes let\'s do it', 'yes confirm',
      'yes confirmed', 'yes definitely', 'yes absolutely', 'yes of course',
      'yes go ahead', 'yes proceed', 'yes continue', 'yes accept', 'yes approve',
      'sounds good', 'that works', 'that\'s fine', 'that\'s correct', 'perfect',
      'sounds great', 'sounds perfect', 'i agree', 'i confirm', 'let\'s do it',
      'go for it', 'do it', 'proceed', 'continue', 'accept', 'approved',
      'confirm yes', 'confirmed yes', 'definitely yes', 'absolutely yes',
      'sure yes', 'okay yes', 'alright yes', 'certainly yes'
    ];
    
    // Check exact matches
    if (exactMatches.includes(input)) return true;
    
    // Check typo matches
    if (typoMatches.includes(input)) return true;
    
    // Check repetitive patterns
    if (repetitivePatterns.test(input)) return true;
    
    // Check mixed confirmation patterns
    if (mixedPatterns.test(input)) return true;
    
    // Check partial matches
    for (const phrase of partialMatches) {
      if (input.includes(phrase)) return true;
    }
    
    // Check for positive words in the input
    const positiveWords = ['yes', 'yeah', 'sure', 'ok', 'okay', 'yep', 'yup', 'definitely', 'absolutely', 'confirm', 'agree', 'accept', 'approve'];
    const words = input.split(/\s+/);
    const hasPositiveWord = words.some(word => positiveWords.some(posWord => word.includes(posWord) || posWord.includes(word)));
    
    return hasPositiveWord && !this.detectNegativeConfirmation(input);
  }

  /**
   * NLP-based negative confirmation detection
   */
  detectNegativeConfirmation(input) {
    // Exact matches
    const exactMatches = ['no', 'nah', 'nope', 'not', 'never', 'cancel', 'stop', 'don\'t', 'do not', 'negative', 'reject', 'decline', 'disagree'];
    
    // Typos and variations
    const typoMatches = ['noo', 'nooo', 'nopp', 'nopp', 'naah', 'naa', 'nott', 'cancell', 'stopp'];
    
    // Repetitive patterns (like "no no", "nope nope")
    const repetitivePatterns = /^(no|nah|nope|not|cancel)(\s+(no|nah|nope|not|cancel))+$/;
    
    // Partial matches within longer phrases
    const partialMatches = [
      'no thank you', 'no thanks', 'not really', 'not interested', 'don\'t want',
      'don\'t like', 'don\'t agree', 'don\'t confirm', 'not okay', 'not fine',
      'that\'s not good', 'that\'s not right', 'that\'s wrong', 'i disagree',
      'i refuse', 'i decline', 'i reject', 'cancel it', 'stop it', 'never mind'
    ];
    
    // Check exact matches
    if (exactMatches.includes(input)) return true;
    
    // Check typo matches
    if (typoMatches.includes(input)) return true;
    
    // Check repetitive patterns
    if (repetitivePatterns.test(input)) return true;
    
    // Check partial matches
    for (const phrase of partialMatches) {
      if (input.includes(phrase)) return true;
    }
    
    // Check for negative words in the input
    const negativeWords = ['no', 'nah', 'nope', 'not', 'never', 'cancel', 'stop', 'don\'t', 'negative', 'reject', 'decline', 'disagree'];
    const words = input.split(/\s+/);
    const hasNegativeWord = words.some(word => negativeWords.some(negWord => word.includes(negWord) || negWord.includes(word)));
    
    return hasNegativeWord;
  }

  /**
   * Handle voice confirmation (Yes/No responses)
   */
  async handleVoiceConfirmation(session, userInput) {
    const input = userInput.toString().trim().toLowerCase().replace(/[.,!?;:]+$/, '');
    const previousStep = session.previousStep;
    const pendingData = session.pendingData;

    console.log(`[DEBUG] Voice confirmation - Input: "${input}", PreviousStep: "${previousStep}", PendingData:`, pendingData);
    console.log(`[DEBUG] Session data:`, {
      sessionId: session.sessionId,
      currentStep: session.currentStep,
      previousStep: session.previousStep,
      pendingData: session.pendingData
    });

    // Enhanced NLP-based confirmation detection
    const isPositiveResponse = this.detectPositiveConfirmation(input);
    const isNegativeResponse = this.detectNegativeConfirmation(input);

    console.log(`[DEBUG] NLP Detection - Positive: ${isPositiveResponse}, Negative: ${isNegativeResponse}`);

    if (isPositiveResponse) {
      console.log(`[DEBUG] User said YES - proceeding with pending action`);
      
      // Check if pendingData exists
      if (!pendingData) {
        console.log(`[DEBUG] ERROR: pendingData is null or undefined!`);
        return {
          success: true,
          message: "I'm sorry, I lost track of what we were confirming. Let me ask again.",
          options: ['Home Visit', 'Diagnostic Center Visit'],
          type: 'selection',
          channelType: session.channelType,
          currentStep: STEPS.ENTRY
        };
      }
      
      // User confirmed - proceed with the pending action
      sessionManager.updateSession(session.sessionId, {
        currentStep: previousStep,
        pendingData: null,
        previousStep: null
      });
      return await this.processPendingAction(session, pendingData);
    } else if (isNegativeResponse) {
      console.log(`[DEBUG] User said NO - retrying previous step`);
      // User rejected - ask the question again
      sessionManager.updateSession(session.sessionId, {
        currentStep: previousStep,
        pendingData: null,
        previousStep: null
      });
      return this.getRetryMessage(session, previousStep);
    } else {
      console.log(`[DEBUG] Invalid input - asking again`);
      // Invalid input - ask again
      return {
        success: true,
        message: "I didn't catch that. Please say yes or no.",
        options: ['Yes', 'No'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.VOICE_CONFIRMATION
      };
    }
  }

  /**
   * Process pending action after confirmation
   */
  async processPendingAction(session, pendingData) {
    console.log(`[DEBUG] Processing pending action:`, pendingData);
    
    if (!pendingData) {
      console.log(`[DEBUG] ERROR: pendingData is null in processPendingAction!`);
      return {
        success: false,
        message: 'Error: No pending action to process',
        error: 'Missing pending data'
      };
    }
    
    // Handle specific actions first
    if (pendingData.action === 'select_home') {
      sessionManager.updateSession(session.sessionId, {
        selectedFlow: FLOW_TYPES.HOME,
        currentStep: STEPS.TIME_SELECTION
      });
      return this.getHomeVisitTimeSelection(session);
    } else if (pendingData.action === 'select_center') {
      sessionManager.updateSession(session.sessionId, {
        selectedFlow: FLOW_TYPES.CENTER,
        currentStep: STEPS.CENTER_SELECTION
      });
      return this.getCenterSelection(session);
    } else if (pendingData.action === 'select_near_center') {
      const center = getCenterById(pendingData.centerId);
      sessionManager.updateSession(session.sessionId, {
        selectedCenter: pendingData.centerId,
        currentStep: STEPS.TIME_SELECTION
      });
      return this.getDiagnosticCenterTimeSelection(session, center);
    } else if (pendingData.action === 'select_far_center') {
      const center = getCenterById(pendingData.centerId);
      sessionManager.updateSession(session.sessionId, {
        selectedCenter: pendingData.centerId,
        currentStep: STEPS.DISTANCE_CONFIRMATION
      });
      return this.getDistanceConfirmation(session, center);
    } else if (pendingData.action === 'select_time') {
      sessionManager.updateSession(session.sessionId, {
        selectedTime: pendingData.selectedTime,
        currentStep: STEPS.CONFIRMATION
      });
      return this.getConfirmationMessage(session);
    } else if (pendingData.action === 'reschedule_time') {
      try {
        const existingAppointment = session.existingAppointments[0];
        await sqliteService.rescheduleAppointment(existingAppointment.id, pendingData.selectedTime);
        
        sessionManager.updateSession(session.sessionId, {
          currentStep: STEPS.COMPLETED
        });

        return this.getRescheduleConfirmationMessage(session, existingAppointment, pendingData.selectedTime);
      } catch (error) {
        console.error('[BookingFlow] Error rescheduling appointment:', error);
        return {
          success: false,
          message: 'Sorry, I encountered an error while rescheduling your appointment. Please try again.',
          error: 'Database error'
        };
      }
    } else if (pendingData.action === 'cancel_appointment') {
      return this.getCancelAppointmentMessage(session);
    }

    // Handle regular step processing
    switch (pendingData.step) {
      case STEPS.ENTRY:
        return this.handleFlowSelection(session, pendingData.input);
      case STEPS.CENTER_SELECTION:
        return this.handleCenterSelection(session, pendingData.input);
      case STEPS.DISTANCE_CONFIRMATION:
        return this.handleDistanceConfirmation(session, pendingData.input);
      case STEPS.TIME_SELECTION:
        return this.handleTimeSelection(session, pendingData.input);
      case STEPS.EXISTING_APPOINTMENT_CHECK:
        return this.handleExistingAppointmentResponse(session, pendingData.input);
      case STEPS.RESCHEDULE_OPTIONS:
        return this.handleRescheduleOptions(session, pendingData.input);
      case STEPS.RESCHEDULE_TIME_SELECTION:
        return this.handleRescheduleTimeSelection(session, pendingData.input);
      default:
        return {
          success: false,
          message: 'Invalid pending step',
          error: 'Unknown pending step'
        };
    }
  }

  /**
   * Get retry message for voice confirmation
   */
  getRetryMessage(session, step) {
    switch (step) {
      case STEPS.ENTRY:
        return this.getEntryMessage(session);
      case STEPS.CENTER_SELECTION:
        return this.getCenterSelection(session);
      case STEPS.DISTANCE_CONFIRMATION:
        const center = getCenterById(session.selectedCenter);
        return this.getDistanceConfirmation(session, center);
      case STEPS.TIME_SELECTION:
        return this.getTimeSelectionMessage(session);
      case STEPS.EXISTING_APPOINTMENT_CHECK:
        return this.getExistingAppointmentMessage(session);
      case STEPS.RESCHEDULE_OPTIONS:
        return this.getRescheduleOptionsMessage(session);
      default:
        return this.getEntryMessage(session);
    }
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
        message: "I can help you with your existing appointment. You can reschedule it, keep it as is, or cancel it. What sounds best to you?",
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
        message: "Sorry, I didn't understand. Can you repeat?. Did you want to reschedule, keep your appointment as is, or cancel it?",
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
      if (session.channelType === 'call') {
        // For voice calls, ask for confirmation first
        sessionManager.updateSession(session.sessionId, {
          pendingData: {
            step: STEPS.EXISTING_APPOINTMENT_CHECK,
            input: userInput,
            action: 'cancel_appointment'
          },
          previousStep: STEPS.EXISTING_APPOINTMENT_CHECK,
          currentStep: STEPS.VOICE_CONFIRMATION
        });

        return {
          success: true,
          message: "You chose to cancel your appointment. Do you wish to confirm? Yes or No?",
          options: ['Yes', 'No'],
          type: 'selection',
          channelType: session.channelType,
          currentStep: STEPS.VOICE_CONFIRMATION
        };
      } else {
        // For chat, proceed directly
        return this.getCancelAppointmentMessage(session);
      }
    } else {
      // Invalid input
      return {
        success: true,
        message: `Sorry, I didn't understand. Can you repeat?. Were you thinking reschedule, keep it as is, or cancel?`,
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
        message: "I can help you reschedule. What time in the morning works better for you? Seven am, eight am, or nine am are available.",
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
        message: "Sorry, I didn't understand. Can you repeat?. What time works better for you to reschedule? Seven am, eight am, or nine am are available.",
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
      message: "What time would work better to reschedule your appointment to? Seven am, eight am, or nine am are available.",
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
        message: "I can help you reschedule. What time in the morning works better for you? Seven am, eight am, or nine am are available.",
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
        message: "Sorry, I didn't understand. Can you repeat?. What time works better for you to reschedule? Seven am, eight am, or nine am are available.",
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
        
        // For voice calls, ask for confirmation first
        if (session.channelType === 'call') {
          sessionManager.updateSession(session.sessionId, {
            pendingData: {
              step: STEPS.RESCHEDULE_TIME_SELECTION,
              input: userInput,
              action: 'reschedule_time',
              selectedTime: matchingSlot
            },
            previousStep: STEPS.RESCHEDULE_TIME_SELECTION,
            currentStep: STEPS.VOICE_CONFIRMATION
          });

          return {
            success: true,
            message: `You chose ${matchingSlot} for reschedule. Do you wish to confirm? Yes or No?`,
            options: ['Yes', 'No'],
            type: 'selection',
            channelType: session.channelType,
            currentStep: STEPS.VOICE_CONFIRMATION
          };
        } else {
          // For chat, proceed directly
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
        }
      } else {
        if (checkSlotAvailability(extractedTime, session.existingAppointments[0].appointment_type)) {
          // For voice calls, ask for confirmation first
          if (session.channelType === 'call') {
            sessionManager.updateSession(session.sessionId, {
              pendingData: {
                step: STEPS.RESCHEDULE_TIME_SELECTION,
                input: userInput,
                action: 'reschedule_time',
                selectedTime: extractedTime
              },
              previousStep: STEPS.RESCHEDULE_TIME_SELECTION,
              currentStep: STEPS.VOICE_CONFIRMATION
            });

            return {
              success: true,
              message: `You chose ${extractedTime} for reschedule. Do you wish to confirm? Yes or No?`,
              options: ['Yes', 'No'],
              type: 'selection',
              channelType: session.channelType,
              currentStep: STEPS.VOICE_CONFIRMATION
            };
          } else {
            // For chat, proceed directly
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
        message: `Sorry, I didn't understand. Can you repeat?. Please tell me a morning time that works for you - seven am, eight am, or nine am are available.`,
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

    // For voice calls, ask for confirmation first
    if (session.channelType === 'call') {
      sessionManager.updateSession(session.sessionId, {
        pendingData: {
          step: STEPS.RESCHEDULE_TIME_SELECTION,
          input: userInput,
          action: 'reschedule_time',
          selectedTime: selectedTime
        },
        previousStep: STEPS.RESCHEDULE_TIME_SELECTION,
        currentStep: STEPS.VOICE_CONFIRMATION
      });

      return {
        success: true,
        message: `You chose ${selectedTime} for reschedule. Do you wish to confirm? Yes or No?`,
        options: ['Yes', 'No'],
        type: 'selection',
        channelType: session.channelType,
        currentStep: STEPS.VOICE_CONFIRMATION
      };
    } else {
      // For chat, proceed directly
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
  }

  // ============ MESSAGE GENERATION METHODS ============

  /**
   * Entry message - Welcome and flow selection
   */
  getEntryMessage(session) {
    const channelType = session.channelType;
    const userName = session.userName || 'valued customer';

    const message = `Hi ${userName}, welcome to MedInsure! We need to get your mandatory medical check­up scheduled. Would you prefer having a doctor visit you at home, or would you rather go to a diagnostic center?`;

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
    const message = `Great - a home visit it is! What time in the morning works best for you? Seven am, eight am, or nine am are available.`;

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
    message += `and ${DIAGNOSTIC_CENTERS[2].name} (${DIAGNOSTIC_CENTERS[2].distance}). Which one feels right for you?`;

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
    const message = `You've picked ${center.name}. It's about ${center.distance} from you. Does that work for you, or would you rather find something closer? Just say yes or no.`;

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
    const message = `Perfect - we'll get you set up at ${centerName}. What time in the morning works best for you? Seven am, eight am, or nine am are available.`;

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
    
    message += `\n\nWhat would you prefer to do?`;

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
