@echo off
:: MoneyClaw — Double-click this file to launch (Windows)

cd /d "%~dp0"
echo.
echo   MoneyClaw — Starting up...
echo   ─────────────────────────────
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo   Node.js not found. Install it from https://nodejs.org
  pause
  exit /b 1
)

:: Install deps if needed
if not exist "node_modules" (
  echo   Installing MoneyClaw dependencies...
  npm install --silent
)
if not exist "plaid-server\node_modules" (
  echo   Installing Plaid server dependencies...
  cd plaid-server && npm install --silent && cd ..
)

:: Start Plaid server in background
echo   Starting Plaid server (port 8484)...
start /b node plaid-server\server.js

:: Start Vite
echo   Starting MoneyClaw (port 5173)...
echo.
echo   ────────────────────────────────────────
echo   Open in your browser:
echo.
echo      http://localhost:5173
echo.
echo   ────────────────────────────────────────
echo   Close this window to stop the servers
echo.

:: Open browser
timeout /t 2 /nobreak >nul
start http://localhost:5173

:: Run Vite in foreground
npx vite --host
pause
