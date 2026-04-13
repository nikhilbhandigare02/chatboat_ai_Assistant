import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables FIRST
dotenv.config();

import voiceRouter from './routes/voice.js';
import gatherRouter from './routes/gather.js';
import callRouter, { initializeTwilio } from './routes/call.js';
import bookingRouter from './routes/booking.js';
import ttsRouter from './routes/tts.js';

console.log('✅ .env file loaded successfully');
console.log('🔐 Environment Check:');
console.log('   TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? 'SET ✅' : 'NOT SET ❌');
console.log('   TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? 'SET ✅' : 'NOT SET ❌');
console.log('   TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER ? 'SET ✅' : 'NOT SET ❌');
console.log('   AZURE_SPEECH_KEY:', process.env.AZURE_SPEECH_KEY ? 'SET ✅' : 'NOT SET ❌');
console.log('   AZURE_SPEECH_REGION:', process.env.AZURE_SPEECH_REGION ? 'SET ✅' : 'NOT SET ❌');
console.log('   AZURE_SPEECH_VOICE:', process.env.AZURE_SPEECH_VOICE || 'DEFAULT (Neerja)');

// Initialize Twilio AFTER env vars are loaded
const twilioReady = initializeTwilio();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MedInsure AI Backend',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/voice', voiceRouter);
app.use('/voice/gather', gatherRouter);
app.use('/call', callRouter);
app.use('/api/booking', bookingRouter);
app.use('/api/tts', ttsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MedInsure AI Backend running on port ${PORT}`);
  console.log(`📞 Twilio webhook endpoint: http://localhost:${PORT}/voice`);
  console.log(`🔧 Health check: http://localhost:${PORT}/health`);

  // Check for required environment variables
  const requiredEnvVars = ['GROQ_API_KEY'];
  const optionalEnvVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];

  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`⚠️  Warning: Missing required environment variables: ${missing.join(', ')}`);
  }

  const missingOptional = optionalEnvVars.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(`ℹ️  Info: Twilio features disabled. Missing: ${missingOptional.join(', ')}`);
  }
});

export default app;
