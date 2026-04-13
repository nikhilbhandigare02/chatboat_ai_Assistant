# MedInsure AI - Health Insurance Assistant

A complete production-ready AI-powered health insurance assistant platform with chat, voice, and phone call capabilities.

## 🎯 Features

- **Chat Mode**: Text-based conversation with AI assistant
- **Voice Mode**: Speech-to-text and text-to-speech interaction using Web Speech API
- **Call Mode**: Phone call integration via Twilio
- **AI-Powered**: Uses Groq API (llama-3.1-8b-instant) with function calling
- **Insurance Operations**:
  - Book and manage appointments
  - Check claim status and history
  - View payment information
  - Generate invoices
  - Search FAQs

## 🛠 Tech Stack

### Frontend
- React 18 (Vite)
- Tailwind CSS
- Web Speech API
- Groq SDK

### Backend
- Node.js + Express
- Twilio (voice calls)
- Groq API

## 📁 Project Structure

```
MedInsurance_2/
├── src/
│   ├── components/          # React components
│   ├── services/            # Groq integration
│   ├── hooks/               # Custom React hooks
│   └── data/                # Mock JSON data
├── server/
│   ├── routes/              # Express routes
│   └── services/            # Backend services
├── package.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Groq API key ([Get it here](https://console.groq.com))
- Twilio account (optional, for phone calls)

### 1. Clone and Install

```bash
cd MedInsurance_2

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment Variables

**Frontend** - Create `.env` in root:
```env
VITE_GROQ_API_KEY=your_groq_api_key_here
VITE_BACKEND_URL=http://localhost:3001
```

**Backend** - Create `server/.env`:
```env
GROQ_API_KEY=your_groq_api_key_here
PORT=3001

# Optional: For Twilio phone calls
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
SERVER_URL=http://localhost:3001
```

### 3. Run the Application

**Terminal 1 - Backend:**
```bash
cd server
npm start
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The app will open at `http://localhost:5173`

## 📱 Usage Guide

### Chat Mode
1. Select a patient from the dropdown
2. Type your message in the chat input
3. AI responds with relevant information

### Voice Mode
1. Select a patient
2. Click the microphone button
3. Speak your query
4. AI responds with voice output

### Call Mode
1. Click "Call" tab
2. Either:
   - Call the displayed Twilio number from your phone
   - Click "Start Call" to receive a call (requires Twilio setup)

### Quick Actions
- **Book Appointment**: Find and book doctor appointments
- **Check Claims**: View claim status and history
- **View Payments**: See payment history and due amounts
- **FAQs**: Search insurance policy questions

## 🤖 AI Function Calling

The AI can execute these functions:

1. `get_appointment_slots` - Find available doctors
2. `book_appointment` - Book a specific slot
3. `cancel_appointment` - Cancel booking
4. `get_claim_status` - Check claim status
5. `get_claim_history` - View past claims
6. `get_payments` - View payment history
7. `get_invoice` - Generate invoice
8. `search_faqs` - Search knowledge base

## 📊 Mock Data

The application includes realistic mock data for:
- 5 patients with different insurance plans
- Appointment slots with 6 doctors
- Claims data (approved, pending, rejected)
- Payment history
- 10 FAQs

Data files are in `src/data/` directory.

## 🔧 Twilio Setup (Optional)

For phone call functionality:

1. Create a [Twilio account](https://www.twilio.com/try-twilio)
2. Get a phone number with voice capabilities
3. Configure webhook URL in Twilio console:
   - Voice webhook: `http://your-server-url/voice`
4. Add credentials to `server/.env`

**For local development**, use [ngrok](https://ngrok.com/):
```bash
ngrok http 3001
# Use the ngrok URL for Twilio webhook
```

## 🏗 Architecture

### Frontend Flow
```
User Input → React Component → Groq Service → AI Response → UI Update
                                      ↓
                              Function Calling
                                      ↓
                              Mock Data Files
```

### Backend Flow (Twilio)
```
Phone Call → Twilio → /voice → TwiML Response
                         ↓
                  User Speech → /voice/gather
                         ↓
                  Groq Service → AI Response
                         ↓
                  TwiML with Speech
```

## 🔐 Security Notes

- Never commit `.env` files
- API keys are in `.gitignore`
- Use environment variables for all secrets
- In production, implement proper authentication

## 📝 Development Scripts

### Frontend
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Backend
```bash
npm start        # Start server
npm run dev      # Start with auto-reload (if nodemon installed)
```

## 🐛 Troubleshooting

### Speech Recognition Not Working
- Use Chrome/Edge browser (best Web Speech API support)
- Allow microphone permissions
- Check HTTPS (required for Web Speech API in production)

### Backend Connection Failed
- Ensure backend is running on port 3001
- Check `VITE_BACKEND_URL` in `.env`
- Verify CORS is enabled

### Twilio Calls Not Working
- Verify Twilio credentials in `server/.env`
- Check webhook URL is publicly accessible (use ngrok)
- Ensure phone number has voice capabilities

## 🎨 Customization

### Adding New Functions
1. Add function definition in `src/services/groqService.js`
2. Implement handler function
3. Add to backend service if needed for calls

### Styling
- Modify `tailwind.config.js` for theme
- Update components in `src/components/`
- Edit `src/App.css` for custom animations

## 📚 API Reference

### Backend Endpoints

- `GET /health` - Health check
- `POST /voice` - Twilio voice webhook
- `POST /voice/gather` - Process speech input
- `POST /call/initiate` - Start outbound call
- `GET /call/status/:callSid` - Get call status
- `GET /call/number` - Get Twilio number

## 🤝 Contributing

This is a demo project. For production use:
- Implement proper user authentication
- Use real database instead of JSON files
- Add error tracking (Sentry, etc.)
- Implement rate limiting
- Add comprehensive testing

## 📄 License

MIT License - feel free to use for learning and development.

## 🙏 Credits

- **Groq** - Fast AI inference
- **Twilio** - Voice communication
- **React** - UI framework
- **Tailwind CSS** - Styling

---

**Need Help?** Check the console for detailed logs and error messages.

**Enjoy building with MedInsure AI!** 🚀
