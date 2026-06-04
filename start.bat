@echo off
REM GulfZone HR - Application Starter
REM This script starts the development server

echo.
echo ============================================
echo   GulfZone HR Management System
echo ============================================
echo.

REM Check if node is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Download and install Node.js from:
    echo https://nodejs.org (LTS version)
    echo.
    pause
    exit /b 1
)

REM Check if .env.local exists
if not exist ".env.local" (
    echo ERROR: .env.local file not found!
    echo.
    echo Please create .env.local file in this folder.
    echo See SETUP_GUIDE.md for instructions.
    echo.
    pause
    exit /b 1
)

REM Check if package.json exists
if not exist "package.json" (
    echo ERROR: This does not appear to be the GulfZone HR project folder!
    echo.
    echo Please run this script from the project root folder.
    echo.
    pause
    exit /b 1
)

echo Starting GulfZone HR...
echo.
echo Server will be available at: http://localhost:3000/HRportal
echo.
echo Press Ctrl+C to stop the server.
echo.

REM Check if node_modules exists, if not run npm install
if not exist "node_modules" (
    echo Installing dependencies (first time only)...
    call npm install
    echo.
)

REM Start the development server
call npm run dev

REM If dev server exits, ask user if they want to continue
echo.
echo.
echo Server has stopped.
pause
