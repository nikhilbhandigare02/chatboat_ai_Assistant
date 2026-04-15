/**
 * Session Manager for Appointment Booking
 * Maintains conversation state for each user session
 */

class BookingSessionManager {
  constructor() {
    this.sessions = new Map(); // sessionId => session object
  }

  createSession(userId, channelType = 'chat') {
    const sessionId = `session_${userId}_${Date.now()}`;

    const session = {
      sessionId,
      userId,
      channelType, // 'chat' | 'voice' | 'call'
      userName: null,
      currentStep: 'entry', // entry, flow_selection, time_selection, center_selection, confirmation
      selectedFlow: null, // 'home' | 'center'
      selectedCenter: null,
      selectedTime: null,
      transcript: [], // Store the conversation transcript
      createdAt: Date.now(),
      lastActive: Date.now(),
      timeoutCount: 0, // Track number of timeouts
      lastQuestion: null, // Store the last question asked
      timeoutStartTime: null // Track when timeout started
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActive = Date.now();
    }
    return session;
  }

  updateSession(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates, { lastActive: Date.now() });
      return session;
    }
    return null;
  }

  deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  // Cleanup old sessions (older than 1 hour)
  cleanupOldSessions() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [sessionId, session] of this.sessions) {
      if (session.lastActive < oneHourAgo) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // Handle timeout for a session
  handleTimeout(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.timeoutCount++;
    session.lastActive = Date.now();

    // If 3 timeouts, end the session
    if (session.timeoutCount >= 3) {
      this.sessions.delete(sessionId);
      return {
        shouldEndCall: true,
        message: "I notice you haven't responded. For your convenience, I'm ending this call. You can call back anytime to schedule your appointment. Thank you for contacting Health India!"
      };
    }

    return {
      shouldEndCall: false,
      timeoutCount: session.timeoutCount
    };
  }

  // Set last question for timeout handling
  setLastQuestion(sessionId, question) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastQuestion = question;
      session.timeoutStartTime = Date.now();
    }
  }

  // Reset timeout count when user responds
  resetTimeout(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.timeoutCount = 0;
      session.timeoutStartTime = null;
    }
  }
}

export default new BookingSessionManager();
