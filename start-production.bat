@echo off
REM GulfZone HR - Production Build Starter
REM This script builds and runs the optimized production version

echo.
echo ============================================
echo   GulfZone HR - Production Build
echo ============================================
echo.

REM Check if node is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)

if not exist ".env.local" (
    echo ERROR: .env.local file not found!
    pause
    exit /b 1
)

echo Building optimized application...
echo This may take a few minutes...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Build the application
call npm run build

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo Build completed successfully!
echo.
echo Starting production server...
echo Server will be available at: http://localhost:3000/HRportal
echo.
echo Press Ctrl+C to stop the server.
echo.

REM Start production server
call npm run start

echo.
echo Server has stopped.
pause
