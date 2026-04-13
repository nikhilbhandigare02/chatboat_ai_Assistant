# Appointment Booking System - Implementation Guide

## 📋 Overview

A complete appointment booking system for medical check-ups with support for:
- **Home Visit Flow** - Medical professional visits patient's home
- **Diagnostic Center Visit Flow** - Patient visits one of 3 diagnostic centers
- **Multi-channel Support** - Chat UI, Voice calls, and Twilio integration

## 🏗️ Architecture

### Backend Components

#### 1. **Session Manager** (`server/services/bookingSessionManager.js`)
- In-memory session store for user conversations
- Tracks session state across multiple steps
- Auto-cleanup of old sessions (>1 hour)

**Key Methods:**
- `createSession(userId, channelType)` - Start new session
- `getSession(sessionId)` - Retrieve session data
- `updateSession(sessionId, updates)` - Update session state
- `deleteSession(sessionId)` - End session

#### 2. **Flow Controller** (`server/services/bookingFlowController.js`)
- State machine for appointment booking workflow
- Handles user input and generates next steps
- Manages both home visit and diagnostic center flows

**Key Methods:**
- `startSession(userId, channelType)` - Initialize booking
- `handleUserInput(sessionId, userInput)` - Process user selections
- `getConfirmationMessage(session)` - Generate booking confirmation

**Flow States:**
```
ENTRY → FLOW_SELECTION → {
  HOME_VISIT: TIME_SELECTION → CONFIRMATION
  DIAGNOSTIC_CENTER: {
    CENTER_SELECTION → [DISTANCE_CONFIRMATION?] → TIME_SELECTION → CONFIRMATION
  }
}
```

#### 3. **Mock Data Layer** (`server/services/bookingMockData.js`)
- 5 Demo Users (Amit, Neha, Rahul, Sneha, Vikram)
- 3 Diagnostic Centers
- Time slots (7:00 AM, 8:00 AM, 9:00 AM)
- Availability checker (7:00 AM unavailable, others available)

#### 4. **API Routes** (`server/routes/booking.js`)

**POST /api/booking/start**
```json
Request:
{
  "userId": 1,
  "channelType": "chat" // or "voice" or "call"
}

Response:
{
  "success": true,
  "sessionId": "session_1_1234567890",
  "userId": 1,
  "userName": "Amit",
  "message": "Welcome message...",
  "options": ["1 - Home Visit", "2 - Diagnostic Center Visit"],
  "type": "selection",
  "currentStep": "entry"
}
```

**POST /api/booking/respond**
```json
Request:
{
  "sessionId": "session_1_1234567890",
  "userInput": "1"
}

Response:
{
  "success": true,
  "message": "Next step message...",
  "options": ["1 - 7:00 AM", "2 - 8:00 AM", "3 - 9:00 AM"],
  "type": "selection",
  "currentStep": "time_selection"
}
```

**GET /api/booking/session/:sessionId**
- Retrieve current session details

### Frontend Components

#### **AppointmentBookingChat** (`src/components/AppointmentBookingChat.jsx`)
- React component for chat-based appointment booking
- Manages session lifecycle
- Displays messages and options as buttons
- Shows confirmation with action buttons

#### **AppointmentBookingVoice** (`src/components/AppointmentBookingVoice.jsx`)
- Voice mode booking with speech recognition
- Converts speech input to booking selections
- Uses Web Speech API (browser-based)
- Speaks bot responses aloud using Text-to-Speech
- Supports both voice input and button clicks

**Features:**
- 🎤 Click to listen for voice input
- 📱 Speech-to-text conversion (e.g., "one" → "1", "home visit" → "1")
- 🔊 Bot reads options and responses aloud
- 📲 Fallback button options for each step

#### **AppointmentBookingCall** (`src/components/AppointmentBookingCall.jsx`)
- Call mode booking for Twilio phone calls
- Simulates phone-based appointment booking
- DTMF input support (dial pad numbers 0-9)
- Call transcript display for monitoring
- Test mode for testing without Twilio setup

**Features:**
- ☎️ Initiate calls to patient phone numbers
- 📞 Call status monitoring (idle, ringing, active, completed)
- 📋 Full call transcript log
- 🧪 Test mode for simulation
- 🔢 DTMF (dial pad) input support

### Voice/Call Integration

#### **Voice Routes** (`server/routes/voice.js`)
- Handles Twilio incoming calls
- Provides greeting and directs to gather endpoint

#### **Gather Routes** (`server/routes/gather.js`)
- Processes speech input
- Uses booking flow controller for responses
- Manages voice session state via callSid mapping
- Handles confirmations with hangup

## 🚀 Usage

### **Mode 1: Chat (Button-Based)**
1. Select a patient from dropdown
2. Click **"📅 Appointment"** tab OR
3. In Chat mode, click **"📅 Book Appointment"** quick action button
4. Click button options to navigate through booking
5. Confirm appointment

**Perfect for:**
- Desktop/web users who prefer clicking
- Accessibility (no voice capability needed)
- Clear visual feedback of all options

---

### **Mode 2: Voice (Speech-Based)**
1. Select a patient from dropdown
2. Click **"🎤 Voice"** tab
3. Near the bottom, click **"🎤 Speak or Select Option"** button
4. **Speak your choice:**
   - "one" or "1" for first option
   - "two" or "2" for second option
   - "three" or "3" for third option
   - "home visit" → automatically converts to "1"
   - "diagnostic center" → automatically converts to "2"
5. Bot reads responses aloud
6. Confirm appointment

**Perfect for:**
- Hands-free operation
- Accessibility (voice-based interaction)
- Natural speech input
- Automated responses

---

### **Mode 3: Call (Phone-Based Via Twilio)**
1. Select a patient from dropdown
2. Click **"📞 Call"** tab
3. Enter patient phone number
4. Click **"📞 Initiate Call"** (requires Twilio configured) OR
5. Click **"🧪 Test Mode"** to simulate
6. During call, press number keys (1, 2, 3) on dial pad
7. Bot provides voice prompts for each step
8. Confirm appointment via DTMF

**Perfect for:**
- Real phone calls via Twilio
- Automated voice system
- DTMF (dial pad) navigation
- Call transcripts/logging

### Voice/Call Mode
1. Incoming call to Twilio number
2. Bot greets caller with policy welcome
3. Caller speaks options (1 for Home, 2 for Center)
4. Flow proceeds with voice prompts
5. Confirmation plays and call ends

## 📝 Demo Users

```javascript
[
  { id: 1, name: "Amit" },
  { id: 2, name: "Neha" },
  { id: 3, name: "Rahul" },
  { id: 4, name: "Sneha" },
  { id: 5, name: "Vikram" }
]
```

## 🏥 Diagnostic Centers

```javascript
[
  {
    id: 1,
    name: "HealthCare Diagnostic Center",
    address: "123 Medical Plaza, Downtown",
    distance: "5 km",
    isFar: true // Triggers distance confirmation
  },
  {
    id: 2,
    name: "City Lab Diagnostics",
    address: "456 Health Street, Midtown",
    distance: "2 km",
    isFar: false
  },
  {
    id: 3,
    name: "MedPlus Lab",
    address: "789 Wellness Avenue, Uptown",
    distance: "1.5 km",
    isFar: false
  }
]
```

## 🧪 Testing

### Manual Testing with curl

**Start booking session:**
```bash
curl -X POST http://localhost:3003/api/booking/start \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "channelType": "chat"}'
```

**Submit user input:**
```bash
curl -X POST http://localhost:3003/api/booking/respond \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "session_1_1234567890", "userInput": "1"}'
```

### Running Test Script
```bash
node server/test_booking_api.js
```

## 📊 Flow Examples

### Home Visit Flow
```
User selects: 1 (Home Visit)
  ↓
Bot asks: Select time (7:00 AM, 8:00 AM, 9:00 AM)
User selects: 1 (7:00 AM)
  ↓
Bot responds: NOT AVAILABLE, showing available slots
User selects: 2 (8:00 AM)
  ↓
Bot confirms: Home visit tomorrow at 8:00 AM
```

### Diagnostic Center Flow
```
User selects: 2 (Diagnostic Center)
  ↓
Bot shows: 3 centers
User selects: 1 (HealthCare - 5km away)
  ↓
Bot asks: Distance warning confirmation
User selects: Yes (1)
  ↓
Bot asks: Select time
User selects: 3 (9:00 AM)
  ↓
Bot confirms: Appointment at HealthCare center tomorrow at 9:00 AM
```

## 🔧 Key Features

✅ **State Machine** - Strict flow control prevents invalid transitions
✅ **Session Management** - Each user has isolated conversation state
✅ **Multi-channel** - Chat, Voice, and Call support with unified logic
✅ **Mock Data** - No external APIs needed for demo
✅ **Availability Logic** - 7:00 AM unavailable, others available
✅ **Distance Warnings** - For far diagnostic centers
✅ **Error Handling** - Graceful handling of invalid inputs
✅ **Confirmation** - Clear booking summary with details

## 📦 Files Added/Modified

### New Files
- `server/services/bookingSessionManager.js`
- `server/services/bookingFlowController.js`
- `server/services/bookingMockData.js`
- `server/routes/booking.js`
- `src/components/AppointmentBookingChat.jsx`
- `server/test_booking_api.js`

### Modified Files
- `server/index.js` - Added booking router
- `server/routes/voice.js` - Updated for booking flow
- `server/routes/gather.js` - Updated for booking flow
- `src/App.jsx` - Added appointment booking mode
- `src/components/ModeToggle.jsx` - Added appointment mode button

## 🎯 Next Steps

1. Test the chat flow by selecting "Appointment" mode
2. Test voice flow by calling Twilio number
3. Verify confirmation messages show correct details
4. Customize time slots or diagnostic centers in `bookingMockData.js`
5. Add database persistence if needed (replace in-memory sessions)
