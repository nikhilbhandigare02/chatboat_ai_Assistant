import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AzureTTS {
  constructor() {
    // Don't set these in constructor - use getters instead
  }

  get apiKey() {
    return process.env.AZURE_SPEECH_KEY;
  }

  get region() {
    return process.env.AZURE_SPEECH_REGION;
  }

  get voice() {
    return process.env.AZURE_SPEECH_VOICE || 'en-IN-NeerjaNeural';
  }

  get apiUrl() {
    return `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  }

  async synthesizeSpeech(text, lang = 'en') {
    if (!this.apiKey || !this.region) {
      throw new Error('Azure Speech credentials not configured');
    }

    if (!text || text.trim() === '') {
      throw new Error('Text is required for synthesis');
    }
    
    let xmlLang = 'en-IN';
    let voiceToUse = this.voice;

    if (lang === 'hi') {
      xmlLang = 'hi-IN';
      voiceToUse = 'hi-IN-SwaraNeural';
    } else if (lang === 'mr') {
      xmlLang = 'mr-IN';
      voiceToUse = 'mr-IN-AarohiNeural';
    }

    try {
      const ssml = `<speak version='1.0' xml:lang='${xmlLang}'>
        <voice name='${voiceToUse}'>
          ${this.escapeXml(text.trim())}
        </voice>
      </speak>`;

      const response = await axios.post(this.apiUrl, ssml, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3'
        },
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Azure TTS synthesis error:', error.response?.data || error.message);
      throw new Error(`Failed to synthesize speech: ${error.message}`);
    }
  }

  escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case "'":
          return '&apos;';
        case '"':
          return '&quot;';
      }
    });
  }
}

export default new AzureTTS();
