/**
 * Timeout Manager for handling user response timeouts
 * Manages timeout timers for different sessions
 */

class TimeoutManager {
  constructor() {
    this.timers = new Map(); // sessionId => timer object
    this.timeoutDuration = 30000; // 30 seconds timeout
    this.bookingFlowController = null;
  }

  /**
   * Initialize with booking flow controller
   */
  init(bookingFlowController) {
    this.bookingFlowController = bookingFlowController;
  }

  /**
   * Start a timeout timer for a session
   */
  startTimer(sessionId) {
    // Clear existing timer if any
    this.clearTimer(sessionId);

    // Set new timer
    const timer = setTimeout(async () => {
      console.log(`[TimeoutManager] Timeout triggered for session: ${sessionId}`);
      if (this.bookingFlowController) {
        const response = await this.bookingFlowController.handleTimeout(sessionId);
        
        // If the call should end, no need to restart timer
        if (response.shouldEndCall) {
          console.log(`[TimeoutManager] Ending call for session: ${sessionId}`);
          return;
        }
        
        // Restart timer for another timeout cycle
        this.startTimer(sessionId);
      }
    }, this.timeoutDuration);

    this.timers.set(sessionId, timer);
    console.log(`[TimeoutManager] Timer started for session: ${sessionId}`);
  }

  /**
   * Clear timeout timer for a session
   */
  clearTimer(sessionId) {
    const timer = this.timers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(sessionId);
      console.log(`[TimeoutManager] Timer cleared for session: ${sessionId}`);
    }
  }

  /**
   * Clear all timers
   */
  clearAllTimers() {
    for (const [sessionId, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    console.log(`[TimeoutManager] All timers cleared`);
  }

  /**
   * Set timeout duration
   */
  setTimeoutDuration(duration) {
    this.timeoutDuration = duration;
    console.log(`[TimeoutManager] Timeout duration set to: ${duration}ms`);
  }

  /**
   * Get active timer count
   */
  getActiveTimerCount() {
    return this.timers.size;
  }
}

export default new TimeoutManager();
