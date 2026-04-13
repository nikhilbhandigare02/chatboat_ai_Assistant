=== Testing Appointment Booking Flow ===

1. Starting booking session for user 1...
Response: {
  "success": true,
  "sessionId": "session_1_1774365571970",
  "userId": 1,
  "userName": "Amit",
  "message": "Congratulations! 🎉 You have successfully purchased a policy from Tata AIA Life Insurance.\nA medical check-up is required. Please choose your preferred option:\n1. Home Visit\n2. Diagnostic Center Visit",
  "options": [
    "1 - Home Visit",
    "2 - Diagnostic Center Visit"
  ],
  "type": "selection",
  "channelType": "call",
  "currentStep": "entry"
}

SessionId: session_1_1774365571970
CurrentStep: entry

2. Sending input "1" (Home Visit)...
Response: {
  "success": true,
  "message": "Great! A medical professional will visit your home.\nPlease choose a preferred time:\n1. 7:00 AM\n2. 8:00 AM\n3. 9:00 AM",
  "options": [
    "1 - 7:00 AM",
    "2 - 8:00 AM",
    "3 - 9:00 AM"
  ],
  "type": "selection",
  "channelType": "call",
  "currentStep": "time_selection"
}
New CurrentStep: time_selection

3. Sending input "2" (8:00 AM)...
Response: {
  "success": true,
  "message": "✅ Your appointment is confirmed for home visit\n🕗 Time: Tomorrow at 8:00 AM\n📌 Instructions:\n• Do not eat or drink (fasting required)\n• Keep ID proof ready\n• Our medical professional will visit your address\n\nThank you! 🙏",
  "options": [],
  "type": "confirmation",
  "channelType": "call",
  "currentStep": "confirmation",
  "bookingDetails": {
    "flow": "home",
    "center": null,
    "time": "8:00 AM",
    "user": "Amit"
  }
}
Final CurrentStep: confirmation
