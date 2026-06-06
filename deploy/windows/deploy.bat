@echo off
REM ============================================================================
REM  GulfZone HR - Windows deploy / update script
REM ============================================================================
REM  Run this from the project root (the folder containing package.json), e.g.:
REM     cd C:\apps\GulfZoneHR
REM     deploy\windows\deploy.bat
REM
REM  What it does:
REM    1. Installs exact dependencies (npm ci)
REM    2. Builds the production bundle (npm run build)
REM    3. (Re)starts the app under PM2
REM
REM  Pre-requisites (one-time, see WINDOWS_DEPLOYMENT guide):
REM    - Node.js LTS installed
REM    - .env.local present at project root with Supabase keys
REM    - pm2 installed globally (npm install -g pm2 pm2-windows-startup)
REM ============================================================================

setlocal
echo.
echo ===== GulfZone HR deployment =====
echo.

REM --- sanity checks -------------------------------------------------------
if not exist package.json (
  echo [ERROR] package.json not found. Run this from the project root.
  exit /b 1
)
if not exist .env.local (
  echo [ERROR] .env.local not found. Create it with your Supabase keys first.
  exit /b 1
)

REM --- 1. dependencies ----------------------------------------------------
echo [1/3] Installing dependencies (npm ci)...
call npm ci
if errorlevel 1 (
  echo [ERROR] npm ci failed.
  exit /b 1
)

REM --- 2. build -----------------------------------------------------------
echo.
echo [2/3] Building production bundle (npm run build)...
call npm run build
if errorlevel 1 (
  echo [ERROR] build failed.
  exit /b 1
)

REM --- 3. start / restart under PM2 --------------------------------------
echo.
echo [3/3] (Re)starting app under PM2...
call pm2 describe gulfzone-hr >nul 2>&1
if errorlevel 1 (
  echo    First run - starting fresh...
  call pm2 start deploy\windows\ecosystem.config.js
) else (
  echo    Existing process found - restarting...
  call pm2 restart gulfzone-hr
)
call pm2 save

echo.
echo ===== Done. App is running on http://localhost:3000/HRportal =====
echo  Check status : pm2 status
echo  View logs    : pm2 logs gulfzone-hr
echo.
endlocal
