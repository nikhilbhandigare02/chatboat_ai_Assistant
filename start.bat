@echo off
echo ========================================
echo  MedInsure AI - Quick Start
echo ========================================
echo.

REM Check if dependencies are installed
if not exist "node_modules" (
    echo [1/4] Installing frontend dependencies...
    call npm install
) else (
    echo [1/4] Frontend dependencies OK
)

if not exist "server\node_modules" (
    echo [2/4] Installing backend dependencies...
    cd server
    call npm install
    cd ..
) else (
    echo [2/4] Backend dependencies OK
)

REM Check for .env files
if not exist ".env" (
    echo [3/4] WARNING: .env file not found!
    echo Please copy .env.example to .env and configure GROQ_API_KEY
    echo.
) else (
    echo [3/4] Frontend .env configured
)

if not exist "server\.env" (
    echo [4/4] WARNING: server\.env file not found!
    echo Please copy server\.env.example to server\.env and configure GROQ_API_KEY
    echo.
) else (
    echo [4/4] Backend .env configured
)

echo.
echo ========================================
echo Starting MedInsure AI...
echo ========================================
echo.
echo Backend will start on: http://localhost:3001
echo Frontend will start on: http://localhost:5173
echo.
echo Press Ctrl+C to stop both servers
echo.

REM Start both servers
start /B cmd /c "cd server && node index.js"
timeout /t 2 /nobreak >nul
npm run dev
