#!/bin/bash

echo "🔍 MedInsure AI - Setup Verification Script"
echo "============================================"
echo ""

# Check Node.js version
echo "1️⃣  Checking Node.js installation..."
if command -v node &> /dev/null
then
    NODE_VERSION=$(node -v)
    echo "   ✅ Node.js installed: $NODE_VERSION"
else
    echo "   ❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check npm
echo ""
echo "2️⃣  Checking npm installation..."
if command -v npm &> /dev/null
then
    NPM_VERSION=$(npm -v)
    echo "   ✅ npm installed: $NPM_VERSION"
else
    echo "   ❌ npm not found"
    exit 1
fi

# Check frontend dependencies
echo ""
echo "3️⃣  Checking frontend dependencies..."
if [ -d "node_modules" ]; then
    echo "   ✅ Frontend dependencies installed"
else
    echo "   ⚠️  Frontend dependencies not found"
    echo "   Run: npm install"
fi

# Check backend dependencies
echo ""
echo "4️⃣  Checking backend dependencies..."
if [ -d "server/node_modules" ]; then
    echo "   ✅ Backend dependencies installed"
else
    echo "   ⚠️  Backend dependencies not found"
    echo "   Run: cd server && npm install"
fi

# Check frontend .env
echo ""
echo "5️⃣  Checking frontend environment variables..."
if [ -f ".env" ]; then
    echo "   ✅ Frontend .env file exists"

    if grep -q "VITE_GROQ_API_KEY=gsk_" .env 2>/dev/null; then
        echo "   ✅ VITE_GROQ_API_KEY configured"
    else
        echo "   ⚠️  VITE_GROQ_API_KEY not configured properly"
        echo "   Format: VITE_GROQ_API_KEY=gsk_your_key_here"
    fi
else
    echo "   ❌ Frontend .env file not found"
    echo "   Copy .env.example to .env and configure"
fi

# Check backend .env
echo ""
echo "6️⃣  Checking backend environment variables..."
if [ -f "server/.env" ]; then
    echo "   ✅ Backend .env file exists"

    if grep -q "GROQ_API_KEY=gsk_" server/.env 2>/dev/null; then
        echo "   ✅ GROQ_API_KEY configured"
    else
        echo "   ⚠️  GROQ_API_KEY not configured properly"
    fi

    if grep -q "TWILIO_ACCOUNT_SID=" server/.env 2>/dev/null; then
        echo "   ℹ️  Twilio credentials found (optional)"
    else
        echo "   ℹ️  Twilio credentials not configured (optional for phone calls)"
    fi
else
    echo "   ❌ Backend .env file not found"
    echo "   Copy server/.env.example to server/.env and configure"
fi

# Check project structure
echo ""
echo "7️⃣  Verifying project structure..."
REQUIRED_DIRS=("src/components" "src/services" "src/hooks" "src/data" "server/routes" "server/services")
ALL_PRESENT=true

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "   ✅ $dir"
    else
        echo "   ❌ $dir missing"
        ALL_PRESENT=false
    fi
done

# Check key files
echo ""
echo "8️⃣  Checking key files..."
KEY_FILES=("src/App.jsx" "src/services/groqService.js" "server/index.js" "package.json")
for file in "${KEY_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file missing"
        ALL_PRESENT=false
    fi
done

# Final summary
echo ""
echo "============================================"
echo "📊 Verification Summary"
echo "============================================"

if [ "$ALL_PRESENT" = true ]; then
    echo "✅ All structural checks passed!"
else
    echo "⚠️  Some files/directories are missing"
fi

echo ""
echo "📝 Next Steps:"
echo "   1. Ensure .env files are configured"
echo "   2. Run: npm install (if not done)"
echo "   3. Run: cd server && npm install (if not done)"
echo "   4. Start backend: cd server && npm start"
echo "   5. Start frontend: npm run dev"
echo ""
echo "📚 For detailed setup: see SETUP.md"
echo ""
