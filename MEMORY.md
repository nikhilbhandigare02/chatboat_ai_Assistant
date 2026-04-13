# MediNew Appointment Booking System - Project Memory

## Project Overview
We've successfully replaced the full-stack insurance application with a focused **Dual-Flow Medical Check-up Appointment Booking System** supporting 5 demo users.

## Key Implementation Details

### Architecture
- **Backend**: Express.js with state machine flow controller
- **Frontend**: React with mode-based UI (switched to "appointment" mode by default)
- **Sessions**: In-memory session manager with auto-cleanup
- **Channels**: Chat, Voice (Twilio), and Call support

### Core Modules
1. **bookingSessionManager.js** - In-memory session store, tracks state per user
2. **bookingFlowController.js** - State machine with 7 steps (entry→confirmation)
3. **bookingMockData.js** - 5 users, 3 diagnostic centers, 3 time slots
4. **bookingRoutes.js** - 3 API endpoints (start, respond, session details)

### Demo Data
- Users: Amit(1), Neha(2), Rahul(3), Sneha(4), Vikram(5)
- Centers: HealthCare (far, 5km), City Lab (2km), MedPlus (1.5km)
- Times: 7:00 AM (unavailable), 8:00 AM, 9:00 AM

### Two Main Flows
1. **Home Visit**: Selection → Time → Availability Check → Confirmation
2. **Diagnostic Center**: Selection → Center → Distance Confirmation → Time → Availability Check → Confirmation

## Files Created
- server/services/bookingSessionManager.js
- server/services/bookingFlowController.js
- server/services/bookingMockData.js
- server/routes/booking.js
- server/test_booking_api.js
- src/components/AppointmentBookingChat.jsx
- APPOINTMENT_BOOKING_GUIDE.md

## Files Modified
- server/index.js (added booking router)
- server/routes/voice.js (integrated booking flow)
- server/routes/gather.js (integrated booking flow)
- src/App.jsx (added appointment mode, set as default)
- src/components/ModeToggle.jsx (added appointment button)

## API Endpoints
- POST /api/booking/start - Initialize session
- POST /api/booking/respond - Handle user input
- GET /api/booking/session/:sessionId - Get session details

## Voice Integration
- Incoming call greeting → booking flow → confirmation → hangup
- Session mapped via Twilio callSid

## Testing
- All syntax checks passed
- Test script: server/test_booking_api.js (tests all flows)
- Manual curl examples in guide

## Production-Ready Features
✅ Input validation ✅ Error handling ✅ State machine enforcement
✅ Auto-cleanup (old sessions) ✅ Modular & extensible
