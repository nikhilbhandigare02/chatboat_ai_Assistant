/**
 * Dynamic NLP Intent Extractor
 * Uses semantic understanding instead of hardcoded patterns
 */

import Groq from 'groq-sdk';

let groq = null;

/**
 * Get or create Groq client (lazy initialization)
 */
function getGroqClient() {
  if (!groq) {
    if (!process.env.GROQ_API_KEY) {
      console.warn('⚠️ GROQ_API_KEY not found. Intent extraction will use fallback mode.');
      return null;
    }
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return groq;
}

/**
 * Basic pattern matching fallback for when GROQ API is not available
 */
function fallbackPatternMatching(userInput, currentStep) {
  const input = userInput.toString().toLowerCase().trim();

  switch (currentStep) {
    case 'voice_confirmation':
      if (input.match(/yes|yeah|yep|sure|ok|हां|होय|जी|सही|correct/i)) return 'yes';
      if (input.match(/no|nope|cancel|नहीं|नाही|गलत|wrong/i)) return 'no';
      return 'incomplete';

    case 'existing_appointment_check':
      // Reschedule patterns
      if (input.includes('reschedule') || input.includes('change') || input.includes('modify') || 
          input.includes('different time') || input.includes('new time') || input.includes('adjust') ||
          input.includes('move') || input.includes('reschedule appointment')) {
        return 'reschedule';
      }
      
      // Continue patterns
      if (input.includes('continue') || input.includes('keep') || input.includes('stay') ||
          input.includes('as is') || input.includes('no change') || input.includes('fine') ||
          input.includes('continue with appointment') || input.includes('keep my appointment')) {
        return 'continue';
      }
      
      // Cancel patterns
      if (input.includes('cancel') || input.includes('remove') || input.includes('delete') ||
          input.includes('call off') || input.includes('no longer need') || input.includes('cancel appointment')) {
        return 'cancel';
      }
      
      // Out of scope patterns
      if (input.includes('list') || input.includes('government') || input.includes('weather') ||
          input.includes('insurance') || input.includes('how are you') || input.includes('thank you') ||
          input.includes('goodbye') || input.includes('help me with something else')) {
        return 'out_of_scope';
      }
      
      // Incomplete patterns
      if (input.includes('i would like to') || input.includes('i want') || input.includes('can you') ||
          input.includes('i would') || input.includes('i need') || input.includes('i\'d like') ||
          input.includes('looking for')) {
        return 'incomplete';
      }
      
      return 'out_of_scope';
      
    case 'entry':
    case 'flow_selection':
      // Home visit patterns
      if (input.includes('home') || input.includes('1') || input.includes('one')) {
        return '1';
      }
      
      // Diagnostic center patterns
      if (input.includes('center') || input.includes('diagnostic') || input.includes('2') || input.includes('two')) {
        return '2';
      }
      
      return 'out_of_scope';
      
    case 'time_selection':
      // Time patterns - extract hours and minutes
      const timeMatch = input.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?)/i);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1]);
        const minute = timeMatch[2] || '00';
        const period = timeMatch[3].replace(/\./g, '').toUpperCase();
        
        // Only accept times between 7-9 AM
        if (hour >= 7 && hour <= 9 && period.includes('A')) {
          return `${hour}:${minute} AM`;
        }
        return 'invalid';
      }
      
      // Simple number patterns
      if (input.includes('7') || input.includes('one')) return '7:00 AM';
      if (input.includes('8') || input.includes('two')) return '8:00 AM';
      if (input.includes('9') || input.includes('three')) return '9:00 AM';
      
      return 'invalid';
      
    case 'distance_confirmation':
      // Yes patterns
      if (input.includes('yes') || input.includes('accept') || input.includes('okay') ||
          input.includes('fine') || input.includes('good') || input.includes('sure') ||
          input.includes('continue') || input.includes('alright')) {
        return 'yes';
      }
      
      // No patterns
      if (input.includes('no') || input.includes('reject') || input.includes('change') ||
          input.includes('different') || input.includes('too far')) {
        return 'no';
      }
      
      return 'incomplete';
      
    default:
      return input;
  }
}

/**
 * Dynamic intent extraction using semantic understanding
 * @param {string} userInput - The user's speech/text input
 * @param {string} currentStep - The current booking step
 * @param {object} context - Additional context like available options
 * @returns {Promise<string>} - The extracted intent/option
 */
export async function extractIntent(userInput, currentStep, context = {}) {
  const groqClient = getGroqClient();

  // If no Groq client, use basic pattern matching fallback
  if (!groqClient) {
    console.log(`[Dynamic Intent Extraction] FALLBACK MODE: Step: ${currentStep}, Input: "${userInput}"`);
    return fallbackPatternMatching(userInput, currentStep);
  }

  try {
    const systemPrompt = createDynamicSystemPrompt(currentStep, context);
    const userPrompt = createUserPrompt(userInput, currentStep, context);

    const response = await groqClient.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.1, // Lower temperature for more consistent results
      max_tokens: 100
    });

    const extractedIntent = response.choices[0].message.content.trim().toLowerCase();
    console.log(`[Dynamic Intent Extraction] Step: ${currentStep}, Input: "${userInput}", Extracted: "${extractedIntent}"`);

    return extractedIntent;
  } catch (error) {
    console.error('[Dynamic Intent Extraction Error]:', error.message);
    console.log(`[Dynamic Intent Extraction] FALLBACK: Returning original input: "${userInput}"`);
    // Fall back to original input if Groq fails
    return userInput;
  }
}

/**
 * Creates dynamic system prompts based on context
 */
function createDynamicSystemPrompt(currentStep, context) {
const langInstruction = context.language && context.language !== 'en' 
    ? `\nThe user is speaking in ${context.language === 'hi' ? 'Hindi' : 'Marathi'}. Translate and understand their intent in English. ` 
    : '';

  const basePrompt = `You are an intelligent assistant that extracts user intent from natural language.${langInstruction}
Analyze the user's input semantically - understand the meaning and intent, not just keywords.
Be flexible and handle various ways users might express the same intent.
Respond with ONLY the specified output format - no extra text or explanations.`;

  switch (currentStep) {
    case 'entry':
    case 'flow_selection':
      return `${basePrompt}

CONTEXT: User is choosing between appointment types:
1. Home Visit - Doctor comes to patient's home
2. Diagnostic Center Visit - Patient goes to medical facility

Your task: Understand if the user wants a home visit or center visit.

ANALYSIS APPROACH:
- Consider the core intent: Does the user want someone to come TO them, or do they want to GO somewhere?
- Look for semantic indicators of location preference
- Handle questions, statements, indirect requests, and direct commands
- Consider synonyms, related concepts, and contextual meaning

OUTPUT FORMAT: Respond with ONLY:
- "1" for home visit intent
- "2" for diagnostic center intent  
- "incomplete" for incomplete or unclear input that doesn't express a clear preference
- "out_of_scope" for unrelated questions

Examples of semantic understanding:
- "I want to select home visit" → "1" (direct request)
- "Can you select home visit" → "1" (question format)
- "I have to select home visit" → "1" (statement of necessity)
- "Could you book appointment for home visit" → "1" (polite request)
- "Doctor should come to my house" → "1" (semantic intent)
- "I prefer someone comes to me" → "1" (indirect preference)
- "Medical visit at home please" → "1" (contextual request)
- "I want to go to a center" → "2" (going out intent)
- "Can I visit the diagnostic facility?" → "2" (question about visiting)
- "Need to go somewhere medical" → "2" (semantic intent)
- "Prefer to visit a clinic" → "2" (preference for going out)

INCOMPLETE INPUT EXAMPLES (respond "incomplete"):
- "I would like to" → "incomplete" (incomplete phrase)
- "I want" → "incomplete" (incomplete phrase)
- "Can you" → "incomplete" (incomplete phrase)
- "I would" → "incomplete" (incomplete phrase)
- "I need" → "incomplete" (incomplete phrase)`;

    case 'center_selection':
      return `${basePrompt}

CONTEXT: User is choosing between diagnostic centers:
${context.centers ? context.centers.map((center, i) => `${i + 1}. ${center.name} - ${center.distance || 'distance info'}`).join('\n') : '1. HealthCare Diagnostic Center - 5 km away\n2. City Lab Diagnostics - 2 km away\n3. MedPlus Lab - 1.5 km away'}

Your task: Understand which center the user prefers using complete semantic flexibility.

ANALYSIS APPROACH:
- Recognize ANY way user might express center preference
- Handle questions, statements, commands, indirect requests
- Understand semantic meaning of location, distance, position, names
- Process conversational language, slang, abbreviations, partial names
- Consider context and previous conversation
- Be extremely flexible in interpretation

DYNAMIC RECOGNITION EXAMPLES:
- "i want to select healthcare" → "1" (direct statement)
- "can you choose healthcare" → "1" (question format)
- "i have to pick healthcare" → "1" (necessity statement)
- "could you book healthcare" → "1" (polite request)
- "healthcare sounds good" → "1" (preference expression)
- "let's go with healthcare" → "1" (decision statement)
- "what about healthcare?" → "1" (inquiry)
- "healthcare please" → "1" (simple request)
- "the first one" → "1" (position reference)
- "option 1" → "1" (number reference)
- "the healthcare center" → "1" (full name)
- "just healthcare" → "1" (shortened name)

- "i want to select city lab" → "2" (direct statement)
- "can you choose city lab" → "2" (question format)
- "i have to pick city lab" → "2" (necessity statement)
- "could you book city lab" → "2" (polite request)
- "city lab seems good" → "2" (preference expression)
- "let's choose city lab" → "2" (decision statement)
- "what about city lab?" → "2" (inquiry)
- "city lab please" → "2" (simple request)
- "the second one" → "2" (position reference)
- "option 2" → "2" (number reference)
- "the middle option" → "2" (position reference)
- "city lab diagnostics" → "2" (full name)
- "just city lab" → "2" (shortened name)

- "i want to select medplus" → "3" (direct statement)
- "can you choose medplus" → "3" (question format)
- "i have to pick medplus" → "3" (necessity statement)
- "could you book medplus" → "3" (polite request)
- "medplus looks good" → "3" (preference expression)
- "let's go with medplus" → "3" (decision statement)
- "what about medplus?" → "3" (inquiry)
- "medplus please" → "3" (simple request)
- "the third one" → "3" (position reference)
- "option 3" → "3" (number reference)
- "the closest one" → "3" (distance preference)
- "the nearest" → "3" (distance preference)
- "which is closest?" → "3" (distance question)
- "medplus lab" → "3" (full name)
- "just medplus" → "3" (shortened name)
- "the last one" → "3" (position reference)

EXTREME FLEXIBILITY:
- Handle typos: "helthcare", "city lab", "medpls"
- Handle abbreviations: "HC", "CL", "MP"
- Handle conversational: "that healthcare place", "the city lab place", "medplus sounds fine"
- Handle questions: "should I choose healthcare?", "is city lab good?", "what about medplus?"
- Handle comparisons: "healthcare vs city lab", "between city lab and medplus", "healthcare or medplus?"
- Handle uncertainty: "maybe healthcare", "thinking city lab", "probably medplus"
- Handle preferences: "I'd prefer healthcare", "leaning towards city lab", "medplus would be better"

OUTPUT FORMAT: Respond with ONLY:
- "1", "2", or "3" for the respective center
- "incomplete" for incomplete or unclear input that doesn't express a clear center preference
- "out_of_scope" for completely unrelated questions

INCOMPLETE INPUT EXAMPLES (respond "incomplete"):
- "I would like to" → "incomplete" (incomplete phrase)
- "I want" → "incomplete" (incomplete phrase)
- "Can you" → "incomplete" (incomplete phrase)
- "I would" → "incomplete" (incomplete phrase)
- "I need" → "incomplete" (incomplete phrase)
- "I'd like" → "incomplete" (incomplete phrase)
- "Looking for" → "incomplete" (incomplete phrase)`;

    case 'time_selection':
      return `${basePrompt}

CONTEXT: User is choosing appointment time. Available times are between 7:00 AM and 9:00 AM.
The system can book ANY time in this range, not just the main options shown to users.

Your task: Extract the EXACT time the user mentions from their natural language input.

CRITICAL EXTRACTION RULES:
1. Look for ANY time expression in the user's input (like "9:00 a.m.", "8:30 AM", "7:15")
2. Extract ONLY the time that is explicitly mentioned - do not infer or guess
3. Ignore conversational filler words ("preferred", "will be", "I'll", etc.)
4. Return the EXACT time in standard "H:MM AM" format
5. If no time is mentioned, return "invalid"
6. Only accept times between 7:00 AM and 9:00 AM

ANALYSIS APPROACH:
- Scan the entire input for time patterns
- Extract the first valid time found
- Convert any time format to standard "H:MM AM" format
- Ignore all other conversational content

TIME PATTERN EXAMPLES:
- "9:00 a.m. Will be I'll preferred." → "9:00 AM"
- "8:30 am is good for me" → "8:30 AM"
- "I would like 7:15 AM" → "7:15 AM"
- "Can we do 8:00 am?" → "8:00 AM"
- "9:00 a.m. works" → "9:00 AM"
- "7:45 in the morning please" → "7:45 AM"

CONVERSATIONAL EXAMPLES:
- "9:00 a.m. Will be I'll preferred." → "9:00 AM"
- "I think 8:30 am would be better" → "8:30 AM"
- "Maybe 7:15 AM could work" → "7:15 AM"
- "How about 8:00 am?" → "8:00 AM"
- "9:00 a.m. sounds perfect" → "9:00 AM"

GENERAL TIME EXAMPLES (return exact time format):
- "i want to select 7 am" → "7:00 AM"
- "can you choose 8 am" → "8:00 AM"
- "i have to pick 9 am" → "9:00 AM"
- "7 am sounds good" → "7:00 AM"
- "8 am please" → "8:00 AM"
- "7" → "7:00 AM"
- "8" → "8:00 AM"
- "9" → "9:00 AM"
- "7 o'clock" → "7:00 AM"
- "8 o'clock" → "8:00 AM"
- "9 o'clock" → "9:00 AM"

SLOT NUMBER EXAMPLES (return slot number - only when user explicitly refers to position):
- "the first one" → "1"
- "the second one" → "2"
- "the third one" → "3"

RELATIVE REFERENCES (return slot number):
- "the earliest" → "1"
- "the latest" → "3"
- "first slot" → "1"
- "middle slot" → "2"
- "last slot" → "3"

INVALID TIME HANDLING:
- Times outside 7-9 AM range: "6 pm", "10 am", "5 pm", "noon", "midnight", "2 pm"
- No time mentioned: "I prefer morning", "that sounds good", "okay"
- Respond with "invalid" for any time not available or no time found

OUTPUT FORMAT: Respond with ONLY:
- Exact time in "H:MM AM" format for specific times (e.g., "8:30 AM")
- "1", "2", or "3" for position-based slot references
- "incomplete" for incomplete or unclear input that doesn't express a clear time preference
- "invalid" for times not available or no time found
- "out_of_scope" for completely unrelated questions

INCOMPLETE INPUT EXAMPLES (respond "incomplete"):
- "I would like to" → "incomplete" (incomplete phrase)
- "I want" → "incomplete" (incomplete phrase)
- "Can you" → "incomplete" (incomplete phrase)
- "I would" → "incomplete" (incomplete phrase)
- "I need" → "incomplete" (incomplete phrase)
- "I'd like" → "incomplete" (incomplete phrase)
- "Looking for" → "incomplete" (incomplete phrase)`;

    case 'existing_appointment_check':
      return `${basePrompt}
      
CONTEXT: User has an existing appointment and is choosing what to do with it.
Available options are:
1. Reschedule - Change the appointment time
2. Continue - Keep the appointment as scheduled  
3. Cancel - Cancel the appointment

Your task: Understand if the user wants to reschedule, continue, or cancel their existing appointment.

ANALYSIS APPROACH:
- Recognize ANY way user might express these three choices
- Handle questions, statements, commands, indirect requests
- Understand semantic meaning of modification, confirmation, or cancellation
- Process conversational language, expressions, emotional responses
- Consider context and user preference
- Be extremely flexible in interpretation

DYNAMIC RECOGNITION EXAMPLES:
RESCHEDULE (respond "reschedule"):
- "i want to reschedule" → "reschedule" (direct request)
- "can you reschedule" → "reschedule" (question format)
- "i have to reschedule" → "reschedule" (necessity statement)
- "could you reschedule" → "reschedule" (polite request)
- "need to change time" → "reschedule" (semantic intent)
- "want different time" → "reschedule" (indirect request)
- "change appointment" → "reschedule" (modification request)
- "modify time" → "reschedule" (specific change)
- "new time needed" → "reschedule" (requirement statement)
- "different time please" → "reschedule" (polite request)
- "reschedule appointment" → "reschedule" (full phrase)
- "change my appointment" → "reschedule" (personal modification)
- "move appointment" → "reschedule" (relocation intent)
- "adjust time" → "reschedule" (adjustment request)

CONTINUE (respond "continue"):
- "i want to continue" → "continue" (direct request)
- "can you continue" → "continue" (question format)
- "i have to continue" → "continue" (necessity statement)
- "could you continue" → "continue" (polite request)
- "keep appointment" → "continue" (retention intent)
- "keep as is" → "continue" (status preservation)
- "no changes needed" → "continue" (satisfaction statement)
- "appointment is fine" → "continue" (acceptance)
- "keep the time" → "continue" (time preservation)
- "don't change anything" → "continue" (maintenance request)
- "stay as scheduled" → "continue" (confirmation)
- "continue with appointment" → "continue" (full phrase)
- "keep my appointment" → "continue" (personal continuation)

CANCEL (respond "cancel"):
- "i want to cancel" → "cancel" (direct request)
- "can you cancel" → "cancel" (question format)
- "i have to cancel" → "cancel" (necessity statement)
- "could you cancel" → "cancel" (polite request)
- "need to cancel" → "cancel" (requirement statement)
- "cancel appointment" → "cancel" (full phrase)
- "remove appointment" → "cancel" (removal intent)
- "delete appointment" → "cancel" (deletion request)
- "call off appointment" → "cancel" (informal cancellation)
- "no longer need" → "cancel" (obsolescence statement)
- "cancel my appointment" → "cancel" (personal cancellation)
- "appointment cancelled" → "cancel" (statement of fact)

OUT_OF_SCOPE EXAMPLES (respond "out_of_scope"):
- "list Kerala government" → "out_of_scope" (completely unrelated)
- "what is the weather" → "out_of_scope" (unrelated topic)
- "tell me about insurance" → "out_of_scope" (different service)
- "how are you" → "out_of_scope" (general conversation)
- "thank you" → "out_of_scope" (polite but not a choice)
- "goodbye" → "out_of_scope" (conversation ending)
- "help me with something else" → "out_of_scope" (different request)
- "i have a question" → "out_of_scope" (vague inquiry)

OUTPUT FORMAT: Respond with ONLY:
- "reschedule" for reschedule intent
- "continue" for continue intent
- "cancel" for cancel intent
- "incomplete" for incomplete or unclear input that doesn't express a clear choice
- "out_of_scope" for completely unrelated questions

INCOMPLETE INPUT EXAMPLES (respond "incomplete"):
- "I would like to" → "incomplete" (incomplete phrase)
- "I want" → "incomplete" (incomplete phrase)
- "Can you" → "incomplete" (incomplete phrase)
- "I would" → "incomplete" (incomplete phrase)
- "I need" → "incomplete" (incomplete phrase)
- "I'd like" → "incomplete" (incomplete phrase)`;
    case 'voice_confirmation':
      return `${basePrompt}

  CONTEXT: User is confirming or rejecting an action they just chose.
  Are they confirming (YES) or rejecting (NO)?
  Words like "हां", "हाँ सही है", "yes", "correct", "हो", "होय", "ok" mean YES.
  Words like "नहीं", "नाही", "गलत", "wrong", "no", "cancel" mean NO.

  OUTPUT FORMAT: Respond with ONLY:
  - "yes" for positive confirmation
  - "no" for negative confirmation
  - "incomplete" for unclear or incomplete input`;
    case 'distance_confirmation':
      return `${basePrompt}
      
CONTEXT: User is confirming if they accept the distance to a chosen center.

Your task: Understand if the user accepts or rejects the proposed distance using complete semantic flexibility.

ANALYSIS APPROACH:
- Recognize ANY way user might express acceptance or rejection
- Handle questions, statements, commands, indirect requests
- Understand semantic meaning of agreement, disagreement, continuation
- Process conversational language, expressions, emotional responses
- Consider context and user satisfaction
- Be extremely flexible in confirmation interpretation

DYNAMIC RECOGNITION EXAMPLES:
ACCEPTANCE (respond "yes"):
- "i want to accept" → "yes" (direct statement)
- "can you proceed" → "yes" (continuation request)
- "i have to accept" → "yes" (necessity statement)
- "could you continue" → "yes" (polite request)
- "that distance works" → "yes" (satisfaction expression)
- "sounds good" → "yes" (informal approval)
- "let's continue" → "yes" (decision statement)
- "that's fine" → "yes" (acceptance)
- "no problem" → "yes" (satisfaction)
- "it's okay" → "yes" (acceptance)
- "alright" → "yes" (agreement)
- "sure" → "yes" (confirmation)
- "good" → "yes" (approval)
- "perfect" → "yes" (strong approval)
- "excellent" → "yes" (enthusiastic approval)
- "that'll work" → "yes" (practical acceptance)
- "I'm fine with that" → "yes" (personal acceptance)
- "that's acceptable" → "yes" (formal acceptance)
- "let's do it" → "yes" (action-oriented)
- "go ahead" → "yes" (permission)
- "proceed" → "yes" (formal continuation)
- "continue" → "yes" (simple continuation)

REJECTION (respond "no"):
- "i want to reject" → "no" (direct statement)
- "can you choose another" → "no" (change request)
- "i have to change" → "no" (necessity statement)
- "could you pick different" → "no" (polite request)
- "that's too far" → "no" (dissatisfaction expression)
- "too far for me" → "no" (personal dissatisfaction)
- "not acceptable" → "no" (formal rejection)
- "I don't like this" → "no" (preference rejection)
- "that won't work" → "no" (practical rejection)
- "find something else" → "no" (alternative request)
- "change this" → "no" (direct change request)
- "different one" → "no" (alternative preference)
- "not good" → "no" (disapproval)
- "bad" → "no" (strong disapproval)
- "terrible" → "no" (strong rejection)
- "unacceptable" → "no" (formal rejection)
- "I can't do this" → "no" (inability)
- "this is inconvenient" → "no" (practical issue)
- "prefer something closer" → "no" (preference for alternative)
- "need a better option" → "no" (improvement request)
- "let's find another" → "no" (collaborative rejection)
- "can we try again?" → "no" (retry request)

EXTREME FLEXIBILITY:
- Handle conversational: "yeah that's fine", "nope too far", "mhm works for me", "nah find another"
- Handle questions: "is this okay?", "can we proceed?", "should I accept this?", "is there a better option?"
- Handle uncertainty: "I guess so", "maybe not", "probably fine", "thinking no", "considering yes"
- Handle comparisons: "this vs that", "better option?", "closer alternative?"
- Handle emotions: "happy with this", "frustrated by distance", "satisfied", "disappointed"
- Handle politeness: "if you don't mind", "would you mind finding another?", "please continue"
- Handle urgency: "let's hurry", "need to decide", "what's the fastest option?"
- Handle context: "for my schedule this works", "with my mobility this is hard", "given my situation..."

OUTPUT FORMAT: Respond with ONLY:
- "yes" for acceptance
- "no" for rejection
- "incomplete" for incomplete or unclear input that doesn't express a clear acceptance or rejection
- "out_of_scope" for completely unrelated questions

INCOMPLETE INPUT EXAMPLES (respond "incomplete"):
- "I would like to" → "incomplete" (incomplete phrase)
- "I want" → "incomplete" (incomplete phrase)
- "Can you" → "incomplete" (incomplete phrase)
- "I would" → "incomplete" (incomplete phrase)
- "I need" → "incomplete" (incomplete phrase)
- "I'd like" → "incomplete" (incomplete phrase)
- "Looking for" → "incomplete" (incomplete phrase)`;

  default:
    return `${basePrompt}

CONTEXT: Unknown step - analyze input and extract the most likely intent.

OUTPUT FORMAT: Respond with the user's input as-is for fallback processing.`;
  }
}

/**
 * Creates user prompts dynamically
 */
function createUserPrompt(userInput, currentStep, context) {
  return `User input: "${userInput}"

Current step: ${currentStep}
Context: ${JSON.stringify(context, null, 2)}

Analyze the semantic meaning of the user's input and extract their intent based on the context.
Consider all possible ways they might express their intent - be flexible and understanding.
Respond according to the specified output format only.`;
}

export default { extractIntent };
