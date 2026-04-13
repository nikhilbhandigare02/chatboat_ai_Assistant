# 🚀 MedInsure AI - Quick Reference Card

## ⚡ Quick Start (3 Steps)

```bash
# 1. Install
npm install && cd server && npm install && cd ..

# 2. Configure
cp .env.example .env
cp server/.env.example server/.env
# Add your GROQ_API_KEY to both files

# 3. Run
./start.sh  # or start.bat on Windows
```

## 📁 Project Structure (Simplified)

```
MedInsurance_2/
├── src/
│   ├── components/   # 9 React components
│   ├── services/     # Groq integration
│   ├── hooks/        # useSpeech hook
│   └── data/         # 6 JSON files
├── server/
│   ├── routes/       # 3 API routes
│   └── services/     # Voice AI service
└── docs/             # 6 documentation files
```

## 🎯 Core Features

| Feature | Location | Description |
|---------|----------|-------------|
| **Chat Mode** | `ModeToggle` | Text conversation |
| **Voice Mode** | `VoiceInput` | Speech input/output |
| **Call Mode** | `CallMode` | Phone integration |
| **AI Functions** | `groqService.js` | 8 operations |
| **Mock Data** | `src/data/` | 6 JSON files |

## 🔧 Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/App.jsx` | Main app logic | ~150 |
| `src/services/groqService.js` | AI service | ~300 |
| `src/hooks/useSpeech.js` | Voice hook | ~150 |
| `server/index.js` | Backend server | ~80 |
| `server/services/groqCallService.js` | Voice AI | ~200 |

## 🎨 Component API

### PatientSelector
```jsx
<PatientSelector
  selectedPatient={patient}
  onPatientChange={(p) => setPatient(p)}
/>
```

### ChatInput
```jsx
<ChatInput
  onSendMessage={(msg) => handle(msg)}
  disabled={!patient}
/>
```

### VoiceInput
```jsx
<VoiceInput
  onTranscriptComplete={(text) => handle(text)}
  onSpeakResponse={(speakFn) => setSpeaker(speakFn)}
  disabled={!patient}
/>
```

## 🤖 AI Functions Reference

| Function | Parameters | Returns |
|----------|-----------|---------|
| `get_appointment_slots` | `{date?, specialty?}` | Available slots |
| `book_appointment` | `{slotId, reason}` | Booking confirmation |
| `cancel_appointment` | `{bookingId}` | Cancellation status |
| `get_claim_status` | `{claimId?}` | Claim details |
| `get_claim_history` | `{}` | Past claims |
| `get_payments` | `{}` | Payment records |
| `get_invoice` | `{paymentId}` | Invoice data |
| `search_faqs` | `{query}` | Relevant FAQs |

## 📡 API Endpoints

```
GET  /health                  - Server health check
GET  /call/number             - Get Twilio number
POST /call/initiate           - Start outbound call
GET  /call/status/:callSid    - Get call status
POST /voice                   - Twilio incoming call
POST /voice/gather            - Process speech input
```

## 🔐 Environment Variables

### Frontend (.env)
```env
VITE_GROQ_API_KEY=gsk_...
VITE_BACKEND_URL=http://localhost:3001
```

### Backend (server/.env)
```env
GROQ_API_KEY=gsk_...
PORT=3001

# Optional for Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
SERVER_URL=http://localhost:3001
```

## 🎨 Tailwind Classes (Common)

```css
/* Layout */
.flex .flex-col .grid .grid-cols-2

/* Spacing */
.p-4 .px-6 .py-3 .space-x-4 .gap-6

/* Colors */
.bg-blue-600 .text-white .border-gray-200

/* Interactive */
.hover:bg-blue-700 .disabled:opacity-50
```

## 🧪 Test Commands

```bash
# Test chat
Type: "I want to book an appointment"

# Test voice
Say: "Show me my claim status"

# Test functions
Type: "Book appointment with Dr. Sharma for checkup"

# Test quick actions
Click: "Book Appointment" button
```

## 🐛 Debugging

### Frontend
```javascript
// Open browser console (F12)
console.log(messages);  // Check message state
```

### Backend
```bash
# Terminal shows all requests
[timestamp] POST /voice/gather
```

### Common Issues
```
Issue: "Speech not supported"
Fix: Use Chrome/Edge browser

Issue: "Backend connection failed"
Fix: Check backend is running on 3001

Issue: "Groq API error"
Fix: Verify API key in .env
```

## 📊 Data Models (Quick)

```typescript
Patient = { id, name, policyId, plan }
Slot = { id, date, time, doctor, specialty, available }
Claim = { claimId, status, amount, reason }
Payment = { id, amount, status, dueDate }
```

## 🎯 User Flows

### Book Appointment
```
1. Select patient
2. Click "Book Appointment"
3. AI shows slots
4. Type: "Book with Dr. Sharma"
5. AI confirms booking
```

### Check Claim
```
1. Select patient
2. Ask: "What's my claim status?"
3. AI shows active claims
```

### Voice Query
```
1. Switch to Voice mode
2. Click microphone
3. Speak query
4. AI responds with voice
```

## 🔄 Git Commands

```bash
git init
git add .
git commit -m "Initial MedInsure AI build"

# For GitHub
git remote add origin <your-repo>
git push -u origin main
```

## 📦 Build Commands

```bash
# Development
npm run dev              # Frontend (port 5173)
cd server && npm start   # Backend (port 3001)

# Production
npm run build            # Creates dist/
npm run preview          # Preview build
```

## 🚀 Deployment Checklist

- [ ] Configure production .env files
- [ ] Update VITE_BACKEND_URL to production URL
- [ ] Build frontend: `npm run build`
- [ ] Deploy backend to Railway/Render
- [ ] Update Twilio webhook URL
- [ ] Test all modes
- [ ] Monitor logs

## 📚 Documentation Files

| File | What's Inside |
|------|---------------|
| `README.md` | Project overview |
| `SETUP.md` | Installation guide |
| `TESTING.md` | Test scenarios |
| `ARCHITECTURE.md` | System design |
| `BUILD_SUMMARY.md` | Complete build info |
| `PROJECT_STRUCTURE.md` | File organization |

## 🎓 Learning Path

1. **Day 1**: Setup + Run locally
2. **Day 2**: Test chat mode + functions
3. **Day 3**: Explore voice features
4. **Day 4**: Understand AI integration
5. **Day 5**: Modify mock data
6. **Day 6**: Customize UI/theme
7. **Day 7**: Deploy to production

## 🔗 Quick Links

- Groq Console: https://console.groq.com
- Twilio Docs: https://twilio.com/docs/voice
- React Docs: https://react.dev
- Tailwind Docs: https://tailwindcss.com

## 🆘 Getting Help

```bash
# Verify setup
./verify-setup.sh

# Check backend health
curl http://localhost:3001/health

# Check logs
# Frontend: Browser console (F12)
# Backend: Terminal output
```

## 💡 Pro Tips

1. **Use Quick Actions** for common queries
2. **Test voice in quiet environment** for best results
3. **Switch patients** to see different data
4. **Check terminal logs** for debugging
5. **Use ngrok** for local Twilio testing

## 🎯 Success Criteria

- [ ] Frontend loads at localhost:5173
- [ ] Backend responds at localhost:3001/health
- [ ] Can select patient and chat
- [ ] AI responds within 3 seconds
- [ ] Voice mode records and speaks
- [ ] Quick actions work
- [ ] Functions execute correctly

## 📞 Support

**Stuck?** Check these in order:
1. `SETUP.md` - Installation issues
2. `TESTING.md` - Testing problems
3. `ARCHITECTURE.md` - How it works
4. Browser console - Frontend errors
5. Terminal logs - Backend errors

---

**Keep this card handy while developing!** 📌

**Version**: 1.0.0 | **Last Updated**: March 21, 2026
