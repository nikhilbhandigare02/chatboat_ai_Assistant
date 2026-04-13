import express from 'express';
import azureTTS from '../services/azureTTS.js';

const router = express.Router();

// Text-to-Speech endpoint
router.post('/synthesize', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const audioBuffer = await azureTTS.synthesizeSpeech(text);

    // Set appropriate headers for audio response
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'no-cache'
    });

    res.send(audioBuffer);

  } catch (error) {
    console.error('TTS synthesis error:', error);
    res.status(500).json({
      error: 'Failed to synthesize speech',
      details: error.message
    });
  }
});

export default router;
