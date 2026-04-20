import azureTTS from './azureTTS.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIO_DIR = path.join(__dirname, '..', 'public', 'audio');

// Ensure audio directory exists
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

class TwilioTTSHelper {
  async generateAudioURL(text, lang = 'en') {
    try {
      // Generate audio using Azure TTS
      const audioBuffer = await azureTTS.synthesizeSpeech(text, lang);

      // Create a unique filename
      const filename = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
      const filepath = path.join(AUDIO_DIR, filename);

      // Save audio to file
      fs.writeFileSync(filepath, audioBuffer);

      // Return URL for Twilio (assuming backend is at localhost:3001)
      const baseUrl = process.env.SERVER_URL || 'http://localhost:3001';
      return `${baseUrl}/audio/${filename}`;
    } catch (error) {
      console.error('Error generating audio URL:', error);
      throw error;
    }
  }

  // Cleanup old audio files (older than 1 hour)
  cleanupOldAudio() {
    try {
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;

      fs.readdirSync(AUDIO_DIR).forEach(file => {
        const filepath = path.join(AUDIO_DIR, file);
        const stats = fs.statSync(filepath);
        const age = now - stats.mtime.getTime();

        if (age > ONE_HOUR) {
          fs.unlinkSync(filepath);
          console.log(`Cleaned up old audio file: ${file}`);
        }
      });
    } catch (error) {
      console.error('Error cleaning up audio files:', error);
    }
  }
}

// Cleanup old audio files every thirty minutes
setInterval(() => {
  new TwilioTTSHelper().cleanupOldAudio();
}, 30 * 60 * 1000);

export default new TwilioTTSHelper();
