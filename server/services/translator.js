import Groq from 'groq-sdk';

let groq = null;

function getGroqClient() {
  if (!groq) {
    if (!process.env.GROQ_API_KEY) {
      return null;
    }
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return groq;
}

export async function translateText(text, targetLanguage) {
  if (!text || targetLanguage === 'en') return text;
  
  const client = getGroqClient();
  if (!client) return text;
  
  const languageName = targetLanguage === 'hi' ? 'Hindi' : targetLanguage === 'mr' ? 'Marathi' : 'English';
  
  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are an expert translator. Translate the following English conversational text into natural, spoken ${languageName}. Return ONLY the translated text, with no explanations, markup, or original text. Ensure it sounds polite and is geared towards voice conversations. Translate dates and numbers into words where possible so TTS models pronounce them properly.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.1,
      max_tokens: 150
    });
    
    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error('Translation error:', err);
    return text; // fallback to English
  }
}
