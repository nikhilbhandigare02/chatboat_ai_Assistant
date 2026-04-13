/**
 * Legacy Intent Extractor - Kept for backward compatibility
 * @deprecated Use dynamicIntentExtractor.js instead
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
 * Extract user intent from natural language input using Groq
 * @param {string} userInput - The user's speech/text input
 * @param {string} currentStep - The current booking step
 * @param {object} context - Additional context like available options
 * @returns {Promise<string>} - The extracted intent/option
 */
export async function extractIntent(userInput, currentStep, context = {}) {
  const groqClient = getGroqClient();

  // If no Groq client, return input as-is for fallback processing
  if (!groqClient) {
    console.log(`[Intent Extraction] FALLBACK MODE: Step: ${currentStep}, Input: "${userInput}"`);
    return userInput;
  }

  try {
    let systemPrompt = '';
    let userPrompt = userInput;

    switch (currentStep) {
      case 'entry':
      case 'flow_selection':
        systemPrompt = `You are analyzing user intent for appointment booking choice.
The user must choose between exactly 2 options:
1. Home Visit - a doctor visits their home
2. Diagnostic Center Visit - they visit a medical center

Rules - MUST respond with ONLY one of these:
- "1" if user wants home visit
- "2" if user wants diagnostic center  
- "out_of_scope" if user asks completely unrelated questions

Be very flexible in recognizing home visit intent. Look for these patterns:
Home visit indicators (respond "1"):
- Direct requests: "i want to select home visit", "can you select home visit", "i have to select home visit", "could you book appointment for home visit"
- Keywords: home, house, visit me, come home, doctor visit, home checkup, at home, in home, home appointment, house call, doctor to home, medical home visit
- Questions: "can i get home visit?", "is home visit available?", "do you have home visit option?", "can doctor come to my home?"
- Indirect: "prefer home", "want someone to come", "doctor should visit", "medical visit at home"

Diagnostic center indicators (respond "2"):
- Direct requests: "i want to select diagnostic center", "can you book diagnostic center", "i need to visit center"
- Keywords: center, diagnostic, lab, clinic, go to, visit center, hospital, medical center, facility, go somewhere
- Questions: "can i visit center?", "is diagnostic center open?", "where can i go?"
- Indirect: "prefer going out", "want to visit", "go to medical place"

Examples:
- "I want to select home visit" → "1"
- "Can you select home visit" → "1" 
- "I have to select home visit" → "1"
- "Could you book appointment for home visit" → "1"
- "I prefer home" → "1"
- "Visit me at home" → "1"
- "Can doctor come to my house?" → "1"
- "I want to select diagnostic center" → "2"
- "Can you book diagnostic center" → "2"
- "I need to visit center" → "2"
- "I'll go to a center" → "2"
- "Lab visit" → "2"
- "What is the capital of France?" → "out_of_scope"
- "What time is it?" → "out_of_scope"`;

        userPrompt = `User said: "${userInput}". Analyze their intent carefully. Do they want option 1 (home visit), option 2 (diagnostic center), or is this out_of_scope? Consider all possible ways they might phrase this. Answer with ONLY "1", "2", or "out_of_scope".`;
        break;

      case 'center_selection':
        systemPrompt = `You are analyzing which diagnostic center the user prefers.

Available options:
1. HealthCare Diagnostic Center - 5 km away
2. City Lab Diagnostics - 2 km away  
3. MedPlus Lab - 1.5 km away

Be very flexible in recognizing user intent. Look for these patterns:

HealthCare indicators (respond "1"):
- Direct: "i want to select healthcare", "can you choose healthcare", "i have to pick healthcare", "could you book healthcare"
- Keywords: healthcare, first, option 1, health, care, medical center
- Questions: "can i select healthcare?", "is healthcare available?", "do you have healthcare option?"
- Indirect: "prefer healthcare", "want healthcare", "healthcare center"

City Lab indicators (respond "2"):
- Direct: "i want to select city lab", "can you choose city lab", "i have to pick city lab", "could you book city lab"
- Keywords: city lab, city, lab, second, option 2, middle
- Questions: "can i select city lab?", "is city lab available?", "do you have city lab option?"
- Indirect: "prefer city lab", "want city lab", "lab in city"

MedPlus indicators (respond "3"):
- Direct: "i want to select medplus", "can you choose medplus", "i have to pick medplus", "could you book medplus"
- Keywords: medplus, closest, near, close, third, last, nearest
- Questions: "can i select medplus?", "is medplus available?", "which is nearest?"
- Indirect: "prefer medplus", "want medplus", "closest center"

Map user intent to the correct number:
- "1" for HealthCare
- "2" for City Lab  
- "3" for MedPlus
- "out_of_scope" for unrelated questions

Examples:
- "I want to select healthcare" → "1"
- "Can you choose city lab" → "2"
- "I have to pick medplus" → "3"
- "Could you book the closest one" → "3"
- "The first one" → "1"
- "City lab" → "2"
- "The closest" → "3"
- "MedPlus" → "3"
- "Which is nearest? MedPlus" → "3"
- "What time is it?" → "out_of_scope"`;

        userPrompt = `User said: "${userInput}". Which center (1, 2, or 3) do they prefer, or is this out_of_scope? Consider all possible ways they might phrase their choice. Respond with ONLY the number or "out_of_scope".`;
        break;

      case 'time_selection':
        systemPrompt = `You are analyzing which time slot the user prefers.
Available times:
1. 7:00 AM
2. 8:00 AM
3. 9:00 AM

Be very flexible in recognizing time intent. Look for these patterns:

7:00 AM indicators (respond "1"):
- Direct: "i want to select 7 am", "can you choose 7 am", "i have to pick 7 am", "could you book 7 am"
- Keywords: 7, seven, 7am, 7 am, early, first, option 1, seven in morning
- Questions: "can i select 7 am?", "is 7 am available?", "do you have 7 am option?"
- Indirect: "prefer early", "want early morning", "first slot", "earliest time"

8:00 AM indicators (respond "2"):
- Direct: "i want to select 8 am", "can you choose 8 am", "i have to pick 8 am", "could you book 8 am"
- Keywords: 8, eight, 8am, 8 am, second, option 2, middle, eight in morning
- Questions: "can i select 8 am?", "is 8 am available?", "do you have 8 am option?"
- Indirect: "prefer 8", "want 8 o'clock", "middle slot", "8 in morning"

9:00 AM indicators (respond "3"):
- Direct: "i want to select 9 am", "can you choose 9 am", "i have to pick 9 am", "could you book 9 am"
- Keywords: 9, nine, 9am, 9 am, late, last, option 3, nine in morning
- Questions: "can i select 9 am?", "is 9 am available?", "do you have 9 am option?"
- Indirect: "prefer late", "want late morning", "last slot", "latest time"

Invalid times (respond "invalid"):
- Any time not in available slots: 6 PM, 10 AM, 5 PM, 11 AM, etc.
- "invalid" for unrecognized times

You must extract ONLY the slot number and respond with EXACTLY:
- "1" if they want 7 AM
- "2" if they want 8 AM
- "3" if they want 9 AM
- "invalid" if they mention any time not in the available slots
- "out_of_scope" for unrelated questions

Examples:
- "I want to select 7 am" → "1"
- "Can you choose 8 am" → "2"
- "I have to pick 9 am" → "3"
- "Could you book the last slot" → "3"
- "9 am" → "3"
- "I prefer 8" → "2"
- "Seven in the morning" → "1"
- "The last slot please" → "3"
- "Early morning" → "1"
- "8 o'clock" → "2"
- "6 pm" → "invalid"
- "10 am" → "invalid"
- "5 pm" → "invalid"
- "What time is it?" → "out_of_scope"`;

        userPrompt = `User said: "${userInput}". Which time slot (1, 2, or 3) do they prefer, is it invalid, or out_of_scope? Consider all possible ways they might phrase their time choice. Respond with ONLY the number, "invalid", or "out_of_scope".`;
        break;

      case 'distance_confirmation':
        systemPrompt = `You are analyzing whether the user accepts or rejects the center distance.

The user will say YES (accept the distance) or NO (reject and choose different center).

Be very flexible in recognizing acceptance/rejection intent. Look for these patterns:

YES indicators (accept distance - respond "yes"):
- Direct: "i want to accept", "can you proceed", "i have to accept", "could you continue"
- Keywords: ok, fine, sure, let's go, proceed, that's fine, alright, accept, continue, good, yes
- Questions: "can we proceed?", "is this okay?", "should we continue?"
- Indirect: "that works", "sounds good", "no problem", "let's do it", "go ahead"

NO indicators (reject distance - respond "no"):
- Direct: "i want to reject", "can you choose another", "i have to change", "could you pick different"
- Keywords: too far, pick another, try different, no thanks, change, reject, different, other, no
- Questions: "can i choose another?", "is there closer option?", "should we pick different?"
- Indirect: "that's too far", "want different center", "prefer closer", "don't like this distance"

You MUST respond with ONLY:
- "yes" if they accept the distance
- "no" if they want to choose a different center
- "out_of_scope" for unrelated questions

Examples:
- "I want to accept this distance" → "yes"
- "Can you proceed with this?" → "yes"
- "That's fine" → "yes"
- "Okay let's go" → "yes"
- "I want to choose another center" → "no"
- "Can you pick a different one?" → "no"
- "Too far" → "no"
- "Can I pick another?" → "no"
- "It's okay, proceed" → "yes"
- "What is the capital of France?" → "out_of_scope"`;

        userPrompt = `User said: "${userInput}". Do they accept this distance, want to choose a different center, or is this out_of_scope? Consider all possible ways they might express acceptance or rejection. Answer with ONLY "yes", "no", or "out_of_scope".`;
        break;

      default:
        return userInput; // Return as-is if unknown step
    }

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
      temperature: 0.3,
      max_tokens: 50
    });

    const extractedIntent = response.choices[0].message.content.trim().toLowerCase();
    console.log(`[Intent Extraction] Step: ${currentStep}, Input: "${userInput}", Extracted: "${extractedIntent}"`);

    return extractedIntent;
  } catch (error) {
    console.error('[Intent Extraction Error]:', error.message);
    console.log(`[Intent Extraction] FALLBACK: Returning original input: "${userInput}"`);
    // Fall back to original input if Groq fails
    return userInput;
  }
}

export default { extractIntent };
