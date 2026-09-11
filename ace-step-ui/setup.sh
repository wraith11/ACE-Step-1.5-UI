#!/bin/bash
# ACE-Step UI setup script (macOS / Linux)
# Installs Node dependencies for the React frontend + Express backend.
set -e

echo "=================================="
echo "  ACE-Step UI - Setup"
echo "=================================="

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required. Please install Node 18+ (https://nodejs.org)."
  exit 1
fi

echo "[1/2] Installing frontend dependencies..."
npm install

echo "[2/2] Installing backend dependencies..."
cd server
npm install
cd ..

echo ""
echo "Setup complete! Now run: ./start-all-macos.sh"
echo ""