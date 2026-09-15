#!/bin/bash
# ACE-Step Music — setup script.
# Installs UI + server dependencies. Run once after cloning.
set -e

cd "$(dirname "$0")"
REPO_ROOT="$(pwd)"
WEBUI_DIR="$REPO_ROOT/webui"

echo "=================================="
echo "  ACE-Step Music — Setup"
echo "=================================="

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required. Please install Node 18+ (https://nodejs.org)."
  exit 1
fi

echo "[1/2] Installing frontend dependencies..."
(cd "$WEBUI_DIR" && npm install)

echo "[2/2] Installing server dependencies..."
(cd "$WEBUI_DIR/server" && npm install)

echo ""
echo "Setup complete! Now run: ./start.sh"
echo ""