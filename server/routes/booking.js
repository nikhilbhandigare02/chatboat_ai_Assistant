/**
 * Appointment Booking Routes
 * Handles chat, voice, and call channel interactions
 */

import express from 'express';
import bookingFlowController from '../services/bookingFlowController.js';

const router = express.Router();

/**
 * POST /api/booking/start
 * Start a new booking session
 * Body: { userId, channelType: 'chat' | 'voice' | 'call' }
 */
router.post('/start', async (req, res) => {
  try {
    const { userId, channelType = 'chat' } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const result = await bookingFlowController.startSession(userId, channelType);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in /api/booking/start:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/booking/respond
 * Handle user input during booking session
 * Body: { sessionId, userInput }
 */
router.post('/respond', async (req, res) => {
  try {
    const { sessionId, userInput } = req.body;

    if (!sessionId || userInput === undefined) {
      return res.status(400).json({
        success: false,
        error: 'sessionId and userInput are required'
      });
    }

    const result = await bookingFlowController.handleUserInput(sessionId, userInput);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error in /api/booking/respond:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/booking/session/:sessionId
 * Get current session details
 */
router.get('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = bookingFlowController.getSessionDetails(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error in /api/booking/session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
