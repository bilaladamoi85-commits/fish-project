@echo off
REM Fish Audio Voice App Starter Script

cls
echo ============================================
echo    🎤 Fish Audio Voice Generator
echo ============================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Node.js is not installed or not in PATH
    echo Please download Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js found: 
node --version

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: npm is not installed or not in PATH
    echo.
    pause
    exit /b 1
)

echo ✅ npm found:
npm --version
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo 📦 Installing dependencies...
    echo This may take a minute on first run...
    echo.
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        echo.
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed successfully!
    echo.
) else (
    echo ✅ Dependencies already installed
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  Warning: .env file not found!
    echo Creating .env from .env.example...
    if exist ".env.example" (
        copy .env.example .env
        echo Please edit .env and add your Fish Audio API key
        echo.
    ) else (
        echo ❌ Error: .env.example not found
        pause
        exit /b 1
    )
)

REM Start the application
echo.
echo ============================================
echo    Starting Fish Audio Voice App...
echo ============================================
echo.
echo 🌐 Open your browser to: http://localhost:3000
echo.
echo 📝 Press Ctrl+C to stop the server
echo.

call npm start

pause
