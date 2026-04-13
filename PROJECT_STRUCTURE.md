# 📁 MedInsure AI - Complete Project Structure

```
MedInsurance_2/
│
├── 📄 README.md                    # Main documentation
├── 📄 SETUP.md                     # Setup instructions
├── 📄 package.json                 # Frontend dependencies
├── 📄 vite.config.js               # Vite configuration
├── 📄 tailwind.config.js           # Tailwind CSS config
├── 📄 postcss.config.cjs           # PostCSS config
├── 📄 .eslintrc.json               # ESLint configuration
├── 📄 .gitignore                   # Git ignore rules
├── 📄 .env.example                 # Frontend env template
├── 📄 index.html                   # HTML entry point
│
├── 📂 public/                      # Static assets
│
├── 📂 src/                         # Frontend source
│   ├── 📄 main.jsx                # React entry point
│   ├── 📄 App.jsx                 # Main application component
│   ├── 📄 App.css                 # Global styles
│   │
│   ├── 📂 components/             # React components
│   │   ├── PatientSelector.jsx   # Patient dropdown selector
│   │   ├── ModeToggle.jsx        # Chat/Voice/Call mode switcher
│   │   ├── QuickActions.jsx      # Quick action buttons
│   │   ├── ChatWindow.jsx        # Message display area
│   │   ├── ChatInput.jsx         # Text input for chat
│   │   ├── VoiceInput.jsx        # Voice recording controls
│   │   ├── MessageBubble.jsx     # Individual message component
│   │   ├── TypingIndicator.jsx   # Loading animation
│   │   └── CallMode.jsx          # Phone call interface
│   │
│   ├── 📂 services/               # API services
│   │   └── groqService.js        # Groq API integration + functions
│   │
│   ├── 📂 hooks/                  # Custom React hooks
│   │   └── useSpeech.js          # Web Speech API hook
│   │
│   └── 📂 data/                   # Mock JSON data
│       ├── patients.json         # 5 mock patients
│       ├── appointment-slots.json # Doctor appointments
│       ├── claims-status.json    # Current claims
│       ├── claims-history.json   # Historical claims
│       ├── payments.json         # Payment records
│       └── faq-responses.json    # FAQ knowledge base
│
└── 📂 server/                     # Backend Node.js server
    ├── 📄 package.json           # Backend dependencies
    ├── 📄 index.js               # Express server entry
    ├── 📄 .env.example           # Backend env template
    │
    ├── 📂 routes/                # Express routes
    │   ├── voice.js             # Incoming call handler
    │   ├── gather.js            # Speech processing
    │   └── call.js              # Outbound call & status
    │
    └── 📂 services/              # Backend services
        └── groqCallService.js   # Groq for voice calls
```

## 📊 File Count Summary

- **React Components**: 9 files
- **Services**: 2 files (frontend + backend)
- **Hooks**: 1 file
- **Routes**: 3 files
- **Mock Data**: 6 JSON files
- **Config Files**: 8 files
- **Documentation**: 3 files

**Total**: ~32 production files

## 🔧 Key Files Explained

### Frontend Core

| File | Purpose |
|------|---------|
| `src/App.jsx` | Main app with state management, handles all modes |
| `src/main.jsx` | React DOM entry point |
| `src/services/groqService.js` | Groq API integration, function calling system |
| `src/hooks/useSpeech.js` | Web Speech API wrapper (recognition + synthesis) |

### Components Breakdown

| Component | Responsibility |
|-----------|---------------|
| `PatientSelector` | Dropdown to select active patient |
| `ModeToggle` | Switch between Chat/Voice/Call modes |
| `QuickActions` | Preset action buttons |
| `ChatWindow` | Displays message history |
| `ChatInput` | Text message input field |
| `VoiceInput` | Microphone controls + transcript |
| `MessageBubble` | Individual message UI |
| `TypingIndicator` | AI thinking animation |
| `CallMode` | Phone call interface |

### Backend Core

| File | Purpose |
|------|---------|
| `server/index.js` | Express server setup + middleware |
| `server/services/groqCallService.js` | Voice-optimized Groq integration |
| `server/routes/voice.js` | Twilio incoming call webhook |
| `server/routes/gather.js` | Process user speech input |
| `server/routes/call.js` | Outbound calls + status |

### Data Files

| File | Contents |
|------|----------|
| `patients.json` | 5 patient profiles with policies |
| `appointment-slots.json` | 6+ doctor slots |
| `claims-status.json` | Active claims per patient |
| `claims-history.json` | Historical claim records |
| `payments.json` | Premium & payment history |
| `faq-responses.json` | 10 insurance FAQs |

## 🎯 Function Calling System

### Available Functions (8 total)

1. **get_appointment_slots** - Find doctors
2. **book_appointment** - Reserve slot
3. **cancel_appointment** - Cancel booking
4. **get_claim_status** - Check claims
5. **get_claim_history** - View past claims
6. **get_payments** - Payment info
7. **get_invoice** - Generate invoice
8. **search_faqs** - Search FAQs

### Implementation Locations

- **Frontend**: `src/services/groqService.js` (lines 18-130)
- **Backend**: `server/services/groqCallService.js` (lines 31-90)

## 🌐 API Endpoints

### Backend Routes

- `GET /health` - Health check
- `POST /voice` - Twilio incoming call
- `POST /voice/gather` - Process speech
- `POST /call/initiate` - Start call
- `GET /call/status/:sid` - Call status
- `GET /call/number` - Get Twilio number

## 🎨 Styling System

- **Framework**: Tailwind CSS
- **Custom Animations**: fadeIn, soundWave, pulse
- **Color Theme**: Blue primary (#3b82f6)
- **Layout**: Flexbox + Grid
- **Responsive**: Mobile-first design

## 📦 Dependencies

### Frontend (package.json)

**Production:**
- react, react-dom (UI)
- groq-sdk (AI)

**Development:**
- vite (build tool)
- tailwindcss (styling)
- eslint (linting)

### Backend (server/package.json)

**Production:**
- express (server)
- cors (CORS handling)
- twilio (voice calls)
- groq-sdk (AI)
- dotenv (env vars)

## 🔐 Environment Variables

### Frontend (.env)
```
VITE_GROQ_API_KEY     # Required
VITE_BACKEND_URL      # Required
```

### Backend (server/.env)
```
GROQ_API_KEY          # Required
PORT                  # Optional (default: 3001)
TWILIO_ACCOUNT_SID    # Optional (for calls)
TWILIO_AUTH_TOKEN     # Optional (for calls)
TWILIO_PHONE_NUMBER   # Optional (for calls)
SERVER_URL            # Optional (for webhooks)
```

## 🚀 Build & Deploy

### Development
```bash
# Frontend
npm run dev

# Backend
cd server && npm start
```

### Production
```bash
# Frontend build
npm run build  # → dist/

# Backend
cd server && node index.js
```

## 📈 Feature Matrix

| Feature | Chat | Voice | Call |
|---------|------|-------|------|
| Text Input | ✅ | ❌ | ❌ |
| Voice Input | ❌ | ✅ | ✅ |
| Voice Output | ❌ | ✅ | ✅ |
| Quick Actions | ✅ | ✅ | ❌ |
| Patient Selection | ✅ | ✅ | ⚠️ |
| Function Calling | ✅ | ✅ | ✅ |
| Transcript | ❌ | ✅ | ✅ |

Legend: ✅ Full Support | ⚠️ Partial | ❌ Not Available

---

**Last Updated**: 2026-03-21
**Version**: 1.0.0
