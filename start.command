#!/bin/bash
# MoneyClaw — Double-click this file to launch
# (macOS will open Terminal automatically)

cd "$(dirname "$0")"
echo ""
echo "  🦀 MoneyClaw — Starting up..."
echo "  ─────────────────────────────"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "  ❌ Node.js not found. Install it from https://nodejs.org"
  echo "  Press any key to exit..."
  read -n 1
  exit 1
fi

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "  📦 Installing MoneyClaw dependencies..."
  npm install --silent
fi
if [ ! -d "plaid-server/node_modules" ]; then
  echo "  📦 Installing Plaid server dependencies..."
  cd plaid-server && npm install --silent && cd ..
fi

# Start Plaid server in background
echo "  🔌 Starting Plaid server (port 8484)..."
cd plaid-server
node server.js &
PLAID_PID=$!
cd ..

# Start Vite dev server
echo "  🚀 Starting MoneyClaw (port 5173)..."
echo ""
echo "  ────────────────────────────────────────"
echo "  ✅ Open in your browser:"
echo ""
echo "     http://localhost:5173"
echo ""
echo "  ────────────────────────────────────────"
echo "  Press Ctrl+C to stop both servers"
echo ""

# Open browser automatically
sleep 2
open http://localhost:5173 2>/dev/null || xdg-open http://localhost:5173 2>/dev/null

# Run Vite in foreground (keeps terminal open)
npx vite --host

# Cleanup when Vite exits
kill $PLAID_PID 2>/dev/null
echo "  Servers stopped. You can close this window."
