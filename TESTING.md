# 🧪 MedInsure AI - Testing Guide

## Prerequisites Checklist

Before testing, ensure:
- [ ] Node.js installed
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Backend dependencies installed (`cd server && npm install`)
- [ ] `.env` configured with GROQ_API_KEY
- [ ] `server/.env` configured with GROQ_API_KEY
- [ ] Backend running on port 3001
- [ ] Frontend running on port 5173

## 🎯 Test Scenarios

### Scenario 1: Basic Chat Flow

**Steps:**
1. Open http://localhost:5173
2. Select "Rajesh Kumar - POL001 (Gold Plan)" from dropdown
3. Type: "Hello"
4. Expected: AI greets Rajesh Kumar

**Test Cases:**
```
Input: "What appointments are available?"
Expected: AI calls get_appointment_slots and lists doctors

Input: "Book an appointment with Dr. Sharma for health checkup"
Expected: AI books slot-1 and confirms booking

Input: "What is my claim status?"
Expected: AI shows claims for POL001 (approved and pending claims)

Input: "Show my payment history"
Expected: AI displays payment records with Gold Plan premium

Input: "What is covered under my insurance?"
Expected: AI searches FAQs and explains coverage
```

### Scenario 2: Voice Mode Testing

**Steps:**
1. Switch to "Voice" tab
2. Allow microphone permissions
3. Click microphone button
4. Speak clearly: "Show me available doctors"
5. Wait for AI response (should be spoken)

**Expected Behavior:**
- Microphone button turns red and shows "Listening..."
- Transcript appears below microphone
- AI processes and responds with voice
- Green "AI is speaking..." indicator appears

**Test Queries:**
- "Book appointment with cardiologist"
- "Check my claim history"
- "What are my premium payments"

### Scenario 3: Quick Actions

**Test Each Button:**

1. **Book Appointment**
   - Click button
   - Should trigger: "I want to book an appointment"
   - AI lists available slots

2. **Check Claims**
   - Click button
   - Should show current claims

3. **View Payments**
   - Click button
   - Should display payment history

4. **FAQs**
   - Click button
   - Should prompt for insurance questions

### Scenario 4: Multiple Patients

**Test Patient Switching:**

1. Select "Rajesh Kumar (POL001)"
   - Ask: "What's my claim status?"
   - Note: Should show CLM-2026-001 (approved) and CLM-2026-015 (pending)

2. Switch to "Priya Sharma (POL002)"
   - Ask: "What's my claim status?"
   - Note: Should show CLM-2026-008 (surgery claim - approved)

3. Switch to "Amit Patel (POL003)"
   - Ask: "What's my claim status?"
   - Note: Should show CLM-2026-012 (rejected - cosmetic)

Each patient has different data - verify AI responds accordingly.

### Scenario 5: Function Calling Verification

**Test Complex Queries:**

```
Query: "Show me cardiologist appointments on March 24"
Expected Function Calls:
  - get_appointment_slots({specialty: "Cardiologist", date: "2026-03-24"})
Expected Result: "Dr. Patel available at 2:00 PM"

Query: "Book the 2 PM slot for heart checkup"
Expected Function Calls:
  - book_appointment({slotId: "slot-2", reason: "heart checkup", ...})
Expected Result: Booking confirmation with details

Query: "How much is my monthly premium and when is next payment?"
Expected Function Calls:
  - get_payments({policyId: "POL001"})
Expected Result: "Your Gold Plan premium is ₹2,500 monthly. Next payment due April 1st."
```

### Scenario 6: Error Handling

**Test Edge Cases:**

1. **No Patient Selected**
   - Try to send message without selecting patient
   - Expected: Alert "Please select a patient first"

2. **Invalid Booking**
   - Try to book already booked slot
   - Expected: AI responds slot unavailable

3. **Empty Input**
   - Submit empty message
   - Expected: Nothing happens (disabled button)

4. **API Failure Simulation**
   - Stop backend server
   - Send message
   - Expected: Error message displayed

## 📞 Twilio Call Testing (If Configured)

### Test Incoming Call

**Steps:**
1. Configure Twilio webhook to `your-ngrok-url/voice`
2. Call your Twilio number
3. Expected flow:
   - AI: "Welcome to MedInsure AI..."
   - You: "Check my claim status"
   - AI: Responds with claim information
   - AI: "Is there anything else?"
   - You: "No, that's all"
   - AI: "Thank you for calling..."

**Test Queries Over Call:**
- "What doctors are available?"
- "Book appointment with Dr. Kumar"
- "What is my premium amount?"
- "Explain my insurance coverage"

### Test Call Mode UI

1. Click "Call" tab
2. Verify Twilio number displays
3. Click "Start Call" button
4. Expected:
   - Status changes to "Calling..."
   - Then "Connected"
   - Duration timer starts
   - Transcript appears

## 🎤 Voice Recognition Testing

**Clarity Test:**
Speak these phrases clearly:

1. "I want to book an appointment"
2. "Show me my claim status"
3. "What is my policy coverage?"
4. "Check payment history"

**Accent Test (en-IN):**
- Number pronunciation: "fifteen thousand rupees"
- Date format: "March twenty fourth"
- Indian terms: "lakh", "crore" (if applicable)

## ✅ Acceptance Criteria

### Chat Mode
- [ ] Patient selection works
- [ ] Messages appear in real-time
- [ ] AI responds within 2-3 seconds
- [ ] Function calling executes correctly
- [ ] Typing indicator shows during processing
- [ ] Quick actions trigger correct queries
- [ ] Scroll auto-updates with new messages

### Voice Mode
- [ ] Microphone button toggles recording
- [ ] Transcript displays in real-time
- [ ] Speech recognition accuracy >80%
- [ ] AI voice response plays automatically
- [ ] Can interrupt AI speech
- [ ] Visual indicators for listening/speaking states

### Call Mode
- [ ] Twilio number displays correctly
- [ ] Call status updates work
- [ ] Duration timer counts up
- [ ] Transcript logs conversation
- [ ] Can end call anytime

### Backend
- [ ] Server starts without errors
- [ ] Health endpoint returns OK
- [ ] Twilio webhooks respond with TwiML
- [ ] Groq API integration works
- [ ] Function execution is correct
- [ ] CORS allows frontend requests

### Data Integrity
- [ ] All JSON files load correctly
- [ ] Patient data matches across files
- [ ] Appointment booking updates slots
- [ ] Claims data is consistent
- [ ] Payment history is accurate

## 🐛 Known Issues & Limitations

### Browser Compatibility
- **Best**: Chrome, Edge (full Web Speech API support)
- **Limited**: Firefox (basic support)
- **Poor**: Safari (limited speech synthesis)

### Speech Recognition
- Requires quiet environment
- May have difficulty with heavy accents
- Internet connection needed

### Mock Data
- Data resets on server restart
- No persistence (use DB for production)
- Limited to 5 patients

## 📊 Performance Benchmarks

**Expected Response Times:**
- Chat message: 1-3 seconds
- Voice processing: 2-4 seconds
- Function execution: <500ms
- Twilio call setup: 2-5 seconds

## 🔧 Debug Mode

To enable detailed logging:

**Frontend:**
```javascript
// Open browser console (F12)
// All logs visible in Console tab
```

**Backend:**
```bash
# Server logs automatically print to terminal
# Each request shows: timestamp, method, path
# Function calls are logged with results
```

## 📈 Test Results Template

```
Date: ___________
Tester: ___________

✅ Chat Mode Working
✅ Voice Mode Working
⚠️ Call Mode (Twilio not configured)
✅ All Functions Working
✅ Quick Actions Working
✅ Patient Selection Working
✅ UI Responsive

Issues Found:
- None / [List any issues]

Notes:
- [Additional observations]
```

## 🎓 Learning Exercises

After basic testing works, try:

1. **Add New Patient**: Edit `src/data/patients.json`
2. **Add New Doctor**: Edit `src/data/appointment-slots.json`
3. **Create Custom FAQ**: Edit `src/data/faq-responses.json`
4. **Modify AI Personality**: Edit system prompt in `groqService.js`
5. **Change Theme**: Modify `tailwind.config.js` colors

---

**Happy Testing! 🚀**

For issues, check:
1. Browser console (F12)
2. Backend terminal logs
3. Network tab for API calls
4. SETUP.md for troubleshooting
