import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Load data files
const loadJSON = (filename) => {
  const filepath = path.join(__dirname, '../data', filename);
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
};

const appointmentSlots = loadJSON('appointment-slots.json');
const claimsStatus = loadJSON('claims-status.json');
const claimsHistory = loadJSON('claims-history.json');
const payments = loadJSON('payments.json');
const faqData = loadJSON('faq-responses.json');

// Session storage for call context
const callSessions = new Map();

// Function definitions
const functions = [
  {
    name: 'get_appointment_slots',
    description: 'Get available appointment slots with doctors',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Filter by date (YYYY-MM-DD)' },
        specialty: { type: 'string', description: 'Filter by specialty' }
      }
    }
  },
  {
    name: 'book_appointment',
    description: 'Book an appointment slot',
    parameters: {
      type: 'object',
      properties: {
        slotId: { type: 'string', description: 'Slot ID to book' },
        reason: { type: 'string', description: 'Reason for appointment' }
      },
      required: ['slotId', 'reason']
    }
  },
  {
    name: 'get_claim_status',
    description: 'Get claim status for patient',
    parameters: {
      type: 'object',
      properties: {
        claimId: { type: 'string', description: 'Specific claim ID (optional)' }
      }
    }
  },
  {
    name: 'get_payments',
    description: 'Get payment history',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'search_faqs',
    description: 'Search FAQs',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' }
      },
      required: ['query']
    }
  }
];

// Function handlers
const functionHandlers = {
  get_appointment_slots: ({ date, specialty }, context) => {
    let slots = appointmentSlots.slots.filter(slot => slot.available);
    if (date) slots = slots.filter(slot => slot.date === date);
    if (specialty) slots = slots.filter(slot => slot.specialty.toLowerCase().includes(specialty.toLowerCase()));
    return { success: true, slots, count: slots.length };
  },

  book_appointment: ({ slotId, reason }, context) => {
    const slotIndex = appointmentSlots.slots.findIndex(s => s.id === slotId);
    if (slotIndex === -1) return { success: false, error: 'Slot not found' };

    const slot = appointmentSlots.slots[slotIndex];
    if (!slot.available) return { success: false, error: 'Slot no longer available' };

    const booking = {
      bookingId: `BOOK-${Date.now()}`,
      slotId,
      patientName: context.patientName || 'Patient',
      policyId: context.policyId || 'N/A',
      reason,
      date: slot.date,
      time: slot.time,
      doctor: slot.doctor,
      specialty: slot.specialty,
      status: 'confirmed'
    };

    appointmentSlots.slots[slotIndex].available = false;
    appointmentSlots.bookings.push(booking);

    return {
      success: true,
      booking,
      message: `Appointment confirmed with ${slot.doctor} on ${slot.date} at ${slot.time}`
    };
  },

  get_claim_status: ({ claimId }, context) => {
    const policyId = context.policyId || 'POL001';
    const claims = claimsStatus.claims[policyId] || [];

    if (claimId) {
      const claim = claims.find(c => c.claimId === claimId);
      return claim ? { success: true, claim } : { success: false, error: 'Claim not found' };
    }

    return { success: true, claims, count: claims.length };
  },

  get_payments: (args, context) => {
    const policyId = context.policyId || 'POL001';
    const paymentData = payments.payments[policyId];

    if (!paymentData) return { success: false, error: 'No payment data' };

    return {
      success: true,
      premium: paymentData.premium,
      paymentHistory: paymentData.paymentHistory.slice(0, 3)
    };
  },

  search_faqs: ({ query }, context) => {
    const queryLower = query.toLowerCase();
    const results = faqData.faqs.filter(faq =>
      faq.question.toLowerCase().includes(queryLower) ||
      faq.keywords.some(kw => kw.toLowerCase().includes(queryLower))
    );

    return { success: true, results: results.slice(0, 2), count: results.length };
  }
};

// Execute function
const executeFunction = (functionName, args, context) => {
  if (functionHandlers[functionName]) {
    try {
      return functionHandlers[functionName](args, context);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Function not found' };
};

// Helper function to save call transcript
const saveCallTranscript = (callSid, session) => {
  try {
    const transcriptsDir = path.join(__dirname, '..', 'transcripts');
    if (!fs.existsSync(transcriptsDir)) {
      fs.mkdirSync(transcriptsDir, { recursive: true });
    }

    const filename = `voice_chat_${callSid}.json`;
    const filePath = path.join(transcriptsDir, filename);

    const transcriptData = {
      callSid,
      patientContext: session.context,
      lastUpdated: new Date().toISOString(),
      messages: session.messages
    };

    fs.writeFileSync(filePath, JSON.stringify(transcriptData, null, 2));
    // console.log(`[Voice Chat Transcript] Saved to ${filePath}`);
  } catch (error) {
    console.error('[Voice Chat Transcript Error] Failed to save transcript:', error.message);
  }
};

// Main chat function for voice calls (optimized for speech)
export const handleVoiceChat = async (userInput, callSid, patientContext = {}) => {
  try {
    // Get or create session
    if (!callSessions.has(callSid)) {
      callSessions.set(callSid, {
        messages: [],
        context: patientContext
      });
    }

    const session = callSessions.get(callSid);

    const systemMessage = {
      role: 'system',
      content: `You are MedInsure AI, a voice assistant for health insurance. You're on a phone call.

IMPORTANT VOICE GUIDELINES:
- Keep responses SHORT (2-3 sentences max)
- Use NATURAL conversational language
- NO markdown, formatting, or special characters
- Pronounce numbers clearly: "rupees fifteen thousand" not "₹15000"
- Speak dates naturally: "March twenty fourth" not "2026-03-24"
- Be warm and professional

Patient context: ${patientContext.patientName || 'Unknown'}, Policy ${patientContext.policyId || 'N/A'}

Help with appointments, claims, payments, and questions.`
    };

    // Add user message
    session.messages.push({
      role: 'user',
      content: userInput
    });

    let conversationMessages = [systemMessage, ...session.messages];

    // Call Groq
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: conversationMessages,
      tools: functions.map(fn => ({ type: 'function', function: fn })),
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 150 // Shorter for voice
    });

    let assistantMessage = response.choices[0].message;

    // Handle function calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      conversationMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        const result = executeFunction(functionName, functionArgs, session.context);

        conversationMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      // Get final response
      const finalResponse = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: conversationMessages,
        temperature: 0.7,
        max_tokens: 150
      });

      assistantMessage = finalResponse.choices[0].message;
    }

    // Save assistant response
    session.messages.push({
      role: 'assistant',
      content: assistantMessage.content
    });

    // Save transcript after each turn
    saveCallTranscript(callSid, session);

    return {
      message: assistantMessage.content,
      callSid
    };

  } catch (error) {
    console.error('Groq API Error:', error);
    return {
      message: "I'm sorry, I can only help you with booking your medical appointment. I'm here to assist you with scheduling your mandatory medical check-up through MedInsure.",
      error: error.message
    };
  }
};

// Clear old sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sid, session] of callSessions.entries()) {
    if (!session.lastActivity || now - session.lastActivity > 3600000) {
      callSessions.delete(sid);
    }
  }
}, 300000);

export { callSessions };
