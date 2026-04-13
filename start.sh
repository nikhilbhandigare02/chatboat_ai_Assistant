#!/bin/bash

echo "========================================"
echo "  MedInsure AI - Quick Start"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[1/4] Installing frontend dependencies...${NC}"
    npm install
else
    echo -e "${GREEN}[1/4] Frontend dependencies OK${NC}"
fi

if [ ! -d "server/node_modules" ]; then
    echo -e "${YELLOW}[2/4] Installing backend dependencies...${NC}"
    cd server && npm install && cd ..
else
    echo -e "${GREEN}[2/4] Backend dependencies OK${NC}"
fi

# Check for .env files
if [ ! -f ".env" ]; then
    echo -e "${RED}[3/4] WARNING: .env file not found!${NC}"
    echo "Please copy .env.example to .env and configure GROQ_API_KEY"
    echo ""
else
    echo -e "${GREEN}[3/4] Frontend .env configured${NC}"
fi

if [ ! -f "server/.env" ]; then
    echo -e "${RED}[4/4] WARNING: server/.env file not found!${NC}"
    echo "Please copy server/.env.example to server/.env and configure GROQ_API_KEY"
    echo ""
else
    echo -e "${GREEN}[4/4] Backend .env configured${NC}"
fi

echo ""
echo "========================================"
echo "Starting MedInsure AI..."
echo "========================================"
echo ""
echo -e "${GREEN}Backend:${NC} http://localhost:3001"
echo -e "${GREEN}Frontend:${NC} http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Check if 'concurrently' is available
if command -v npx &> /dev/null && npm list -g concurrently &> /dev/null; then
    npx concurrently "cd server && node index.js" "npm run dev"
else
    echo "Starting backend in background..."
    cd server && node index.js &
    BACKEND_PID=$!
    cd ..

    echo "Starting frontend..."
    npm run dev

    # Cleanup
    kill $BACKEND_PID 2>/dev/null
fi
