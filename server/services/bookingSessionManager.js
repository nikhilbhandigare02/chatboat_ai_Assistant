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
      lastActive: Date.now()
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
}

export default new BookingSessionManager();
