# MedInsure AI - Setup & Run Guide

## 📋 Complete Setup Instructions

### Step 1: Install Dependencies

#### Frontend Dependencies
```bash
npm install
```

This will install:
- react, react-dom
- groq-sdk
- vite, tailwindcss
- Development tools

#### Backend Dependencies
```bash
cd server
npm install
cd ..
```

This will install:
- express, cors, dotenv
- twilio
- groq-sdk

### Step 2: Configure API Keys

#### Get Groq API Key
1. Visit https://console.groq.com
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key

#### Setup Frontend Environment
Create `.env` file in root directory:
```env
VITE_GROQ_API_KEY=gsk_your_actual_groq_api_key_here
VITE_BACKEND_URL=http://localhost:3001
```

#### Setup Backend Environment
Create `server/.env` file:
```env
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
PORT=3001
SERVER_URL=http://localhost:3001

# Optional: Only needed for phone call features
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890
```

### Step 3: Run the Application

#### Option A: Run Both Servers Manually

**Terminal 1 - Backend:**
```bash
cd server
node index.js
```
Expected output: `🚀 MedInsure AI Backend running on port 3001`

**Terminal 2 - Frontend:**
```bash
npm run dev
```
Expected output: Opens browser at `http://localhost:5173`

#### Option B: Run with Concurrent Commands (if installed)
```bash
# Install concurrently globally
npm install -g concurrently

# From root directory
npx concurrently "cd server && npm start" "npm run dev"
```

### Step 4: Verify Everything Works

1. **Check Backend**: Visit http://localhost:3001/health
   - Should return: `{"status": "ok", ...}`

2. **Check Frontend**: Visit http://localhost:5173
   - Should display MedInsure AI interface

3. **Test Chat Mode**:
   - Select a patient from dropdown
   - Type: "I want to book an appointment"
   - AI should respond with available slots

4. **Test Voice Mode**:
   - Switch to Voice tab
   - Click microphone button
   - Allow microphone permissions
   - Speak: "Show me my claim status"
   - AI should respond with voice

## 🎤 Twilio Setup (Optional - For Phone Calls)

### Get Twilio Credentials

1. **Create Account**: https://www.twilio.com/try-twilio
2. **Get Phone Number**: Buy a phone number with voice capabilities
3. **Get Credentials**:
   - Account SID (Dashboard)
   - Auth Token (Dashboard)
   - Phone Number

### Configure Twilio Webhooks

#### For Local Development (Recommended):

1. **Install ngrok**:
```bash
npm install -g ngrok
```

2. **Start ngrok tunnel**:
```bash
ngrok http 3001
```

3. **Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`)

4. **Configure in Twilio Console**:
   - Go to Phone Numbers → Active Numbers
   - Click your number
   - Under "Voice Configuration":
     - A CALL COMES IN: Webhook
     - URL: `https://abc123.ngrok.io/voice`
     - HTTP: POST

5. **Update server/.env**:
```env
SERVER_URL=https://abc123.ngrok.io
```

#### For Production:
- Deploy backend to a hosting service
- Use the production URL for webhooks

### Test Phone Calls

1. Call your Twilio number from your phone
2. AI should greet you and ask how to help
3. Speak your query (e.g., "Check my claim status")
4. AI responds with relevant information

## 🧪 Testing Features

### Test Chat Functionality
```
User: "I want to book an appointment"
Expected: AI lists available slots

User: "Book the first one for checkup"
Expected: AI books appointment and confirms

User: "What is my claim status?"
Expected: AI shows claim information

User: "Show my payment history"
Expected: AI displays recent payments
```

### Test Voice Mode
- Say: "Show me appointment slots for March 24"
- Say: "What is covered under my insurance?"
- Say: "I need to check my premium payment"

### Test Quick Actions
Click each quick action button:
- Book Appointment → Triggers appointment query
- Check Claims → Shows claim status
- View Payments → Displays payment info
- FAQs → Prompts for questions

## 🎨 Customization

### Change Theme Colors
Edit `tailwind.config.js`:
```js
theme: {
  extend: {
    colors: {
      primary: { ... } // Modify color palette
    }
  }
}
```

### Add New Mock Patients
Edit `src/data/patients.json`:
```json
{
  "id": "P006",
  "name": "New Patient",
  "policyId": "POL006",
  "plan": "Premium Plan"
}
```

### Add New FAQs
Edit `src/data/faq-responses.json`

### Modify AI Behavior
Edit system prompts in:
- `src/services/groqService.js` (frontend chat)
- `server/services/groqCallService.js` (voice calls)

## 🚨 Common Issues & Solutions

### Issue: "Speech recognition not supported"
**Solution**: Use Chrome or Edge browser. Safari has limited support.

### Issue: Backend connection failed
**Solution**:
- Verify backend is running: `curl http://localhost:3001/health`
- Check `.env` has correct `VITE_BACKEND_URL`
- Disable firewall/antivirus if blocking

### Issue: Groq API errors
**Solution**:
- Verify API key is correct
- Check you have API credits
- Monitor rate limits

### Issue: Voice not speaking
**Solution**:
- Check browser volume
- Verify speaker is not muted
- Try refreshing the page

### Issue: Twilio webhooks not working
**Solution**:
- Verify ngrok is running
- Check webhook URL in Twilio console
- Ensure `SERVER_URL` in `.env` matches ngrok URL
- Check server logs for errors

## 📦 Production Deployment

### Frontend (Vercel/Netlify)
```bash
npm run build
# Deploy the 'dist' folder
```

Environment variables needed:
- `VITE_GROQ_API_KEY`
- `VITE_BACKEND_URL` (production backend URL)

### Backend (Railway/Render/Heroku)
```bash
cd server
```

Environment variables needed:
- `GROQ_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SERVER_URL` (production backend URL)
- `PORT` (usually auto-set by platform)

Update Twilio webhook to production URL.

## 📞 Support

For issues with:
- **Groq API**: https://console.groq.com/docs
- **Twilio**: https://www.twilio.com/docs
- **Web Speech API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API

## 🎓 Learning Resources

- [Groq Documentation](https://console.groq.com/docs)
- [Twilio Voice](https://www.twilio.com/docs/voice)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [React Hooks](https://react.dev/reference/react)

---

**Built with ❤️ for healthcare innovation**
