#!/bin/bash

# Test booking flow directly
BASE_URL="http://localhost:3003"

echo "=== Testing Appointment Booking Flow ==="
echo ""

# Step 1: Start booking session
echo "1. Starting booking session for user 1..."
START_RESPONSE=$(curl -s -X POST "$BASE_URL/api/booking/start" \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "channelType": "call"}')

echo "Response:"
echo "$START_RESPONSE" | jq '.'
echo ""

# Extract sessionId
SESSION_ID=$(echo "$START_RESPONSE" | jq -r '.sessionId')
CURRENT_STEP=$(echo "$START_RESPONSE" | jq -r '.currentStep')

echo "SessionId: $SESSION_ID"
echo "CurrentStep: $CURRENT_STEP"
echo ""

# Step 2: Send first input (select home visit = "1")
echo "2. Sending input '1' (Home Visit)..."
RESPONSE_1=$(curl -s -X POST "$BASE_URL/api/booking/respond" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"userInput\": \"1\"}")

echo "Response:"
echo "$RESPONSE_1" | jq '.'
echo ""

CURRENT_STEP=$(echo "$RESPONSE_1" | jq -r '.currentStep')
echo "New CurrentStep: $CURRENT_STEP"
echo ""

# Step 3: Send second input (select time = "2" for 8:00 AM)
echo "3. Sending input '2' (8:00 AM time slot)..."
RESPONSE_2=$(curl -s -X POST "$BASE_URL/api/booking/respond" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"userInput\": \"2\"}")

echo "Response:"
echo "$RESPONSE_2" | jq '.'
echo ""

CURRENT_STEP=$(echo "$RESPONSE_2" | jq -r '.currentStep')
echo "Final CurrentStep: $CURRENT_STEP"
