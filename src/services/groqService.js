import Groq from 'groq-sdk';
import claimsStatus from '../data/claims-status.json';
import claimsHistory from '../data/claims-history.json';
import payments from '../data/payments.json';
import faqData from '../data/faq-responses.json';

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true
});

// Function definitions for Groq - REMOVED APPOINTMENT FUNCTIONS
const functions = [
  {
    name: 'get_claim_status',
    description: 'Get the current status of insurance claims for a patient',
    parameters: {
      type: 'object',
      properties: {
        policyId: {
          type: 'string',
          description: 'Patient policy ID'
        },
        claimId: {
          type: 'string',
          description: 'Specific claim ID (optional)'
        }
      },
      required: ['policyId']
    }
  },
  {
    name: 'get_claim_history',
    description: 'Get historical claim records for a patient',
    parameters: {
      type: 'object',
      properties: {
        policyId: {
          type: 'string',
          description: 'Patient policy ID'
        }
      },
      required: ['policyId']
    }
  },
  {
    name: 'get_payments',
    description: 'Get payment history and premium information for a patient',
    parameters: {
      type: 'object',
      properties: {
        policyId: {
          type: 'string',
          description: 'Patient policy ID'
        }
      },
      required: ['policyId']
    }
  },
  {
    name: 'get_invoice',
    description: 'Generate and retrieve invoice for a specific payment',
    parameters: {
      type: 'object',
      properties: {
        paymentId: {
          type: 'string',
          description: 'Payment ID to generate invoice for'
        },
        policyId: {
          type: 'string',
          description: 'Patient policy ID'
        }
      },
      required: ['paymentId', 'policyId']
    }
  },
  {
    name: 'search_faqs',
    description: 'Search frequently asked questions about insurance policies and procedures',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query or keywords to find relevant FAQs'
        }
      },
      required: ['query']
    }
  }
];

// Function implementations - REMOVED APPOINTMENT FUNCTIONS
const functionHandlers = {
  get_claim_status: ({ policyId, claimId }) => {
    const claims = claimsStatus.claims[policyId] || [];

    if (claimId) {
      const claim = claims.find(c => c.claimId === claimId);
      return claim ? { success: true, claim } : { success: false, error: 'Claim not found' };
    }

    return {
      success: true,
      claims,
      count: claims.length
    };
  },

  get_claim_history: ({ policyId }) => {
    const history = claimsHistory.history[policyId] || [];

    return {
      success: true,
      history,
      count: history.length,
      totalApproved: history
        .filter(h => h.status === 'approved')
        .reduce((sum, h) => sum + h.amount, 0)
    };
  },

  get_payments: ({ policyId }) => {
    const paymentData = payments.payments[policyId];

    if (!paymentData) {
      return {
        success: false,
        error: 'No payment information found for this policy'
      };
    }

    const overdue = paymentData.paymentHistory.filter(p => p.status === 'overdue');
    const due = paymentData.paymentHistory.filter(p => p.status === 'due');

    return {
      success: true,
      premium: paymentData.premium,
      paymentHistory: paymentData.paymentHistory,
      overdueCount: overdue.length,
      dueCount: due.length
    };
  },

  get_invoice: ({ paymentId, policyId }) => {
    const paymentData = payments.payments[policyId];

    if (!paymentData) {
      return {
        success: false,
        error: 'Policy not found'
      };
    }

    const payment = paymentData.paymentHistory.find(p => p.id === paymentId);

    if (!payment) {
      return {
        success: false,
        error: 'Payment not found'
      };
    }

    return {
      success: true,
      invoice: {
        invoiceId: `INV-${paymentId}`,
        paymentId,
        policyId,
        date: payment.date || payment.dueDate,
        amount: payment.amount,
        planType: paymentData.premium.planType,
        status: payment.status,
        method: payment.method,
        gst: Math.round(payment.amount * 0.18),
        total: Math.round(payment.amount * 1.18)
      }
    };
  },

  search_faqs: ({ query }) => {
    const queryLower = query.toLowerCase();

    const results = faqData.faqs.filter(faq => {
      const matchQuestion = faq.question.toLowerCase().includes(queryLower);
      const matchKeywords = faq.keywords.some(kw =>
        kw.toLowerCase().includes(queryLower) || queryLower.includes(kw.toLowerCase())
      );
      const matchAnswer = faq.answer.toLowerCase().includes(queryLower);

      return matchQuestion || matchKeywords || matchAnswer;
    });

    return {
      success: true,
      results,
      count: results.length
    };
  }
};

// Execute function call
const executeFunction = (functionName, args) => {
  if (functionHandlers[functionName]) {
    try {
      return functionHandlers[functionName](args);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  return {
    success: false,
    error: 'Function not found'
  };
};

// Main chat function
export const sendMessage = async (messages, patientContext = null) => {
  try {
    const systemMessage = {
      role: 'system',
      content: `You are MedInsure AI, a helpful health insurance assistant for MedInsure India. You help patients with:
- Checking claim status and history
- Viewing payment information
- Generating invoices
- Answering insurance-related questions

For appointment booking, politely direct users to use the dedicated "Appointment Booking" feature by clicking the 📅 "Appointment" tab or "🎤 Voice Booking" tab at the top of the application.

Be professional, empathetic, and concise. Always use the available functions when users ask about claims, payments, or have questions.

${patientContext ? `Current patient context:
- Name: ${patientContext.name}
- Policy ID: ${patientContext.policyId}
- Plan: ${patientContext.plan}
- Coverage Limit: ₹${patientContext.coverageLimit.toLocaleString('en-IN')}` : 'No patient selected yet. Ask the user to select a patient first.'}

When providing dates, amounts, or specific information, ensure accuracy. Format currency in Indian Rupees (₹).`
    };

    let conversationMessages = [systemMessage, ...messages];
    let assistantMessage = null;
    let functionResults = [];

    // Initial AI response
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: conversationMessages,
      tools: functions.map(fn => ({
        type: 'function',
        function: fn
      })),
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1000
    });

    assistantMessage = response.choices[0].message;

    // Handle function calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      conversationMessages.push(assistantMessage);

      // Execute all function calls
      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        const result = executeFunction(functionName, functionArgs);
        functionResults.push({
          name: functionName,
          result
        });

        conversationMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      // Get final response after function execution
      const finalResponse = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: conversationMessages,
        temperature: 0.7,
        max_tokens: 1000
      });

      assistantMessage = finalResponse.choices[0].message;
    }

    return {
      message: assistantMessage.content,
      functionCalls: functionResults,
      fullMessage: assistantMessage
    };

  } catch (error) {
    console.error('Groq API Error:', error);
    throw new Error(`Failed to get AI response: ${error.message}`);
  }
};

// Export function definitions for use in other modules
export { functions, executeFunction };
