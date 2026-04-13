# 📊 MedInsure AI - Architecture Overview

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │   Chat   │  │  Voice   │  │   Call   │                 │
│  │   Mode   │  │   Mode   │  │   Mode   │                 │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
└───────┼─────────────┼─────────────┼───────────────────────┘
        │             │             │
        │             │             │ Twilio Call
        │             │             │
┌───────▼─────────────▼─────────────▼───────────────────────┐
│              REACT FRONTEND (Vite)                         │
│  ┌─────────────────────────────────────────────────┐     │
│  │  State Management (useState)                    │     │
│  │  - Selected Patient                             │     │
│  │  - Current Mode                                 │     │
│  │  - Message History                              │     │
│  │  - Voice State                                  │     │
│  └─────────────────────────────────────────────────┘     │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Components  │  │   Services   │  │    Hooks     │   │
│  │  - 9 files   │  │  - Groq API  │  │  - useSpeech │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└────────────────────────┬───────────────────────────────────┘
                         │
                         │ HTTP/REST
                         │
┌────────────────────────▼───────────────────────────────────┐
│              NODE.JS BACKEND (Express)                     │
│  ┌─────────────────────────────────────────────────┐     │
│  │  Routes:                                        │     │
│  │  - /voice          (Twilio webhook)            │     │
│  │  - /voice/gather   (Speech processing)         │     │
│  │  - /call/initiate  (Outbound calls)           │     │
│  │  - /call/status    (Call tracking)            │     │
│  │  - /call/number    (Get phone number)         │     │
│  └─────────────────────────────────────────────────┘     │
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Services:                                       │    │
│  │  - groqCallService (Voice-optimized AI)        │    │
│  │  - Session Management                           │    │
│  └──────────────────────────────────────────────────┘    │
└───────┬────────────────────────────────┬──────────────────┘
        │                                │
        │ Groq API                       │ Twilio SDK
        │                                │
┌───────▼──────────┐            ┌────────▼──────────┐
│   GROQ CLOUD     │            │  TWILIO CLOUD     │
│  llama-3.1-8b    │            │  Voice Service    │
│  Function Calls  │            │  Phone Numbers    │
└──────────────────┘            └───────────────────┘
        │
        │ Function Execution
        │
┌───────▼──────────────────────────────────────────┐
│           MOCK DATA LAYER (JSON)                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │Appointments│  │   Claims   │  │  Payments  │ │
│  └────────────┘  └────────────┘  └────────────┘ │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │  Patients  │  │    FAQs    │  │ Claim Hist │ │
│  └────────────┘  └────────────┘  └────────────┘ │
└──────────────────────────────────────────────────┘
```

## 🔄 Data Flow Diagrams

### Chat Mode Flow

```
User Types Message
        ↓
    ChatInput.jsx
        ↓
    App.jsx (handleSendMessage)
        ↓
    groqService.js
        ↓
    Groq API (with conversation history)
        ↓
  Function Calls? ─→ YES ─→ Execute Functions ─→ Re-query Groq
        │                        ↓
        NO                  Append results
        ↓                        ↓
    AI Response ←───────────────┘
        ↓
    ChatWindow.jsx
        ↓
    MessageBubble.jsx
```

### Voice Mode Flow

```
User Clicks Mic
        ↓
    VoiceInput.jsx
        ↓
    useSpeech.js (startListening)
        ↓
    Web Speech API (recognition)
        ↓
    Live Transcript Display
        ↓
    User Stops Speaking
        ↓
    Auto-send after 1s pause
        ↓
    [Same as Chat Mode]
        ↓
    AI Response Text
        ↓
    useSpeech.js (speak)
        ↓
    Web Speech API (synthesis)
        ↓
    Audio Output 🔊
```

### Call Mode Flow (Twilio)

```
User Calls Twilio Number
        ↓
    Twilio Cloud
        ↓
    POST /voice (webhook)
        ↓
    voice.js
        ↓
    Return TwiML (greeting + gather)
        ↓
    User Speaks
        ↓
    POST /voice/gather
        ↓
    gather.js
        ↓
    groqCallService.js
        ↓
    Groq API (voice-optimized)
        ↓
    Function Calls (if needed)
        ↓
    AI Response (short & clear)
        ↓
    Return TwiML (say + gather)
        ↓
    Twilio speaks response
        ↓
    Loop continues...
```

## 🧩 Component Relationships

```
App.jsx (Root State)
  │
  ├─→ PatientSelector
  │     └─→ Manages: selectedPatient
  │
  ├─→ ModeToggle
  │     └─→ Manages: mode (chat/voice/call)
  │
  ├─→ QuickActions
  │     └─→ Triggers: pre-defined queries
  │
  ├─→ [Mode === 'chat' || 'voice']
  │   │
  │   ├─→ ChatWindow
  │   │     ├─→ MessageBubble (for each message)
  │   │     └─→ TypingIndicator (when AI thinking)
  │   │
  │   └─→ [Mode === 'chat' ? ChatInput : VoiceInput]
  │         ├─→ ChatInput: Text input + send
  │         └─→ VoiceInput: Mic controls + transcript
  │               └─→ useSpeech (hook)
  │
  └─→ [Mode === 'call']
      │
      └─→ CallMode
            ├─→ Display: Twilio number
            ├─→ Control: Call button
            ├─→ Status: Duration timer
            └─→ Transcript: Call log
```

## 🎯 Function Calling System

```
User Query: "Book appointment with cardiologist"
        ↓
    Groq AI (intent detection)
        ↓
    Calls: get_appointment_slots({specialty: "Cardiologist"})
        ↓
    groqService.js → functionHandlers
        ↓
    Read: appointment-slots.json
        ↓
    Filter: specialty = "Cardiologist"
        ↓
    Return: { success: true, slots: [...] }
        ↓
    Groq AI (format response)
        ↓
    User sees: "Dr. Patel is available on March 24 at 2:00 PM..."
```

### Function Map

| Function | Reads From | Writes To | HTTP Method |
|----------|------------|-----------|-------------|
| get_appointment_slots | appointment-slots.json | - | GET |
| book_appointment | appointment-slots.json | appointment-slots.json | POST |
| cancel_appointment | appointment-slots.json | appointment-slots.json | POST |
| get_claim_status | claims-status.json | - | GET |
| get_claim_history | claims-history.json | - | GET |
| get_payments | payments.json | - | GET |
| get_invoice | payments.json | - | GET |
| search_faqs | faq-responses.json | - | GET |

## 🔐 Security Flow

```
User Input
    ↓
Validation (required fields)
    ↓
Environment Variables (API keys)
    ↓
CORS Check (origin validation)
    ↓
API Request (with auth headers)
    ↓
Error Handling (try-catch)
    ↓
Safe Response (sanitized data)
    ↓
User Output
```

## 📱 User Journey Map

### First-Time User

1. **Arrival** → Sees header + empty chat
2. **Select Patient** → Dropdown with 5 options
3. **Welcome Message** → AI greets by name
4. **Quick Action** → Clicks "Book Appointment"
5. **AI Response** → Lists available doctors
6. **Book Slot** → Types "Book with Dr. Sharma for checkup"
7. **Confirmation** → AI confirms booking details
8. **Try Voice** → Switches to Voice mode
9. **Speaks** → "What is my claim status?"
10. **Hears Response** → AI speaks claim information

### Power User

1. Uses Quick Actions for speed
2. Switches between Chat/Voice as needed
3. Books multiple appointments
4. Checks claims across different patients
5. Reviews payment history
6. Accesses FAQs for policy details

## 🌐 Network Communication

### Frontend → Backend

```
Frontend (localhost:5173)
    │
    │ HTTP POST
    │ Content-Type: application/json
    │ Body: { to: "+1234567890" }
    ↓
Backend (localhost:3001)
    │
    │ Response
    │ Content-Type: application/json
    │ Body: { success: true, callSid: "..." }
    ↓
Frontend updates UI
```

### Twilio → Backend

```
Twilio Cloud
    │
    │ HTTP POST (webhook)
    │ Content-Type: application/x-www-form-urlencoded
    │ Body: CallSid=xxx&From=+1234&SpeechResult=...
    ↓
Backend /voice or /voice/gather
    │
    │ Response
    │ Content-Type: text/xml
    │ Body: <?xml version="1.0"?><Response>...</Response>
    ↓
Twilio executes TwiML
```

## 🎨 Styling Architecture

### Tailwind Utility Classes

```css
/* Layout */
.flex, .flex-col, .flex-1
.grid, .grid-cols-2
.space-x-4, .space-y-4

/* Spacing */
.p-4, .px-6, .py-3
.m-4, .mb-8, .mt-2

/* Colors (Medical Theme) */
.bg-blue-600        - Primary actions
.bg-white           - Cards/surfaces
.bg-gray-50         - Background
.bg-green-500       - Success states
.bg-red-500         - Alerts/recording

/* Interactive */
.hover:bg-blue-700
.focus:ring-2
.disabled:opacity-50
.transition-all
```

### Custom Animations

```css
fadeIn      - Message appearance (0.3s)
soundWave   - Voice visualization (0.6s)
pulse       - Attention (2s)
bounce      - Typing dots (1s)
```

## 🔄 State Management

### App-Level State (App.jsx)

```javascript
{
  selectedPatient: {
    id: "P001",
    name: "Rajesh Kumar",
    policyId: "POL001",
    plan: "Gold Plan"
  },
  mode: "chat" | "voice" | "call",
  messages: [
    { role: "user", content: "...", timestamp: "..." },
    { role: "assistant", content: "...", timestamp: "..." }
  ],
  isTyping: false
}
```

### Voice State (useSpeech hook)

```javascript
{
  isListening: false,
  isSpeaking: false,
  transcript: "",
  interimTranscript: "",
  error: null,
  fullTranscript: "combined"
}
```

### Call State (CallMode)

```javascript
{
  callStatus: "idle" | "calling" | "connected" | "ended",
  duration: 0,
  transcript: [
    { speaker: "user", text: "...", timestamp: "..." }
  ],
  twilioNumber: "+1-XXX-XXX-XXXX"
}
```

## 💾 Data Models

### Patient
```typescript
{
  id: string;
  name: string;
  policyId: string;
  plan: string;
  age: number;
  email: string;
  phone: string;
  coverageLimit: number;
  policyStartDate: string;
}
```

### Appointment Slot
```typescript
{
  id: string;
  date: string;
  time: string;
  doctor: string;
  specialty: string;
  available: boolean;
}
```

### Claim
```typescript
{
  claimId: string;
  policyId: string;
  patientName: string;
  status: "approved" | "pending" | "rejected" | "under_review";
  dateSubmitted: string;
  dateProcessed?: string;
  claimAmount: number;
  approvedAmount?: number;
  reason: string;
  hospitalName: string;
}
```

### Payment
```typescript
{
  id: string;
  date?: string;
  amount: number;
  status: "paid" | "due" | "overdue";
  method?: string;
  dueDate: string;
}
```

## 🔌 API Integration Points

### Groq API
```
Endpoint: https://api.groq.com/openai/v1/chat/completions
Model: llama-3.1-8b-instant
Features:
  - Chat completions
  - Function calling
  - Tool use
  - Streaming (not implemented)
```

### Twilio API
```
Endpoints:
  - Create Call: POST /Calls
  - Fetch Call: GET /Calls/{Sid}
  - Webhooks: POST /voice (from Twilio)

Features:
  - Voice calls
  - Speech recognition
  - TwiML responses
  - Call status
```

### Web Speech API
```
Interfaces:
  - SpeechRecognition (input)
  - SpeechSynthesis (output)
  - SpeechRecognitionEvent
  - SpeechSynthesisUtterance

Language: en-IN (Indian English)
```

## 📦 Deployment Architecture

### Development
```
┌─────────────┐        ┌─────────────┐
│   Vite Dev  │        │    Node     │
│ localhost:  │ ────→  │ localhost:  │
│    5173     │        │    3001     │
└─────────────┘        └─────────────┘
                              │
                              ↓
                       ┌─────────────┐
                       │   ngrok     │
                       │ Public URL  │
                       └──────┬──────┘
                              │
                              ↓
                       ┌─────────────┐
                       │   Twilio    │
                       │  Webhooks   │
                       └─────────────┘
```

### Production
```
┌──────────────┐       ┌──────────────┐
│   Vercel/    │       │  Railway/    │
│   Netlify    │ ───→  │   Render     │
│  (Frontend)  │       │  (Backend)   │
└──────────────┘       └──────┬───────┘
                              │
                              ↓
                       ┌─────────────┐
                       │   Twilio    │
                       │  Production │
                       └─────────────┘
```

## 🧪 Testing Architecture

### Unit Testing (Recommended)
- Components: Jest + React Testing Library
- Services: Jest
- Hooks: React Hooks Testing Library

### Integration Testing
- API routes: Supertest
- Function calls: Mock data validation
- Twilio webhooks: Twilio SDK test helpers

### E2E Testing
- Playwright or Cypress
- Full user journeys
- Voice simulation

## 🎯 Performance Optimization

### Implemented
✅ Lazy loading components (React.lazy possible)
✅ Debounced speech recognition
✅ Efficient re-renders (React.memo possible)
✅ Optimized bundle size (Vite tree-shaking)

### Future Optimizations
- Redis caching for API responses
- WebSocket for real-time updates
- Service Worker for offline support
- CDN for static assets

## 🔧 Scalability Considerations

### Current (MVP)
- JSON file storage
- In-memory sessions
- Single server instance
- Synchronous processing

### Production Scale
- PostgreSQL/MongoDB database
- Redis for sessions
- Load balancer + multiple instances
- Queue system (Bull/RabbitMQ)
- Caching layer
- CDN integration

## 📈 Feature Roadmap

### Phase 1 (Current - MVP) ✅
- Chat, voice, call modes
- 8 AI functions
- Mock data
- Basic UI

### Phase 2 (Next)
- User authentication
- Real database
- Payment gateway integration
- Email notifications
- Document upload

### Phase 3 (Advanced)
- Video consultation
- AI-powered claim processing
- Predictive analytics
- Multi-language support
- Mobile app (React Native)

---

**This architecture supports:**
- 🚀 Rapid development
- 🔧 Easy maintenance
- 📈 Future scalability
- 🧪 Testability
- 📚 Clear documentation

---

Built for healthcare innovation 🏥✨
