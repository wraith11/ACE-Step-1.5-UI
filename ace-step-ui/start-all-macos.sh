#!/bin/bash
# ACE-Step UI complete startup for macOS (Apple Silicon / M3) + Linux
#
# Starts three services, all bound to 0.0.0.0 for LAN access:
#   1. ACE-Step REST API server  (port 8001, MLX backend on Apple Silicon)
#   2. UI Express backend        (port 3001)
#   3. Vite frontend             (port 3000)
#
# Usage:
#   ./start-all-macos.sh            # default: uses repo's own uv environment
#   ACESTEP_PATH=/path/to/repo ./start-all-macos.sh
set -e

cd "$(dirname "$0")"
UI_DIR="$(pwd)"
# The UI lives inside the ACE-Step repo, so the repo root is the parent.
REPO_ROOT="$(cd "$UI_DIR/.." && pwd)"
ACESTEP_PATH="${ACESTEP_PATH:-$REPO_ROOT}"

# Frontend port (override to avoid collisions, e.g. Open WebUI on 3000)
#   UI_PORT=3005 ./start-all-macos.sh
UI_PORT="${UI_PORT:-3000}"
export UI_PORT

mkdir -p "$UI_DIR/logs"

echo "=================================="
echo "  ACE-Step UI - Startup"
echo "=================================="
echo "  UI dir:      $UI_DIR"
echo "  ACE-Step:    $ACESTEP_PATH"
echo

# --- Step 1: ACE-Step API server (MLX backend for M-series) ---
echo "[1/3] Starting ACE-Step API server..."
if [ -f "$ACESTEP_PATH/start_api_server_macos.sh" ]; then
  # Preferred: official macOS launcher (auto-configures MLX backend)
  (cd "$ACESTEP_PATH" && ./start_api_server_macos.sh > "$UI_DIR/logs/api.log" 2>&1) &
  API_PID=$!
elif command -v uv >/dev/null 2>&1; then
  (cd "$ACESTEP_PATH" && ACESTEP_LM_BACKEND="mlx" uv run acestep-api --port 8001 > "$UI_DIR/logs/api.log" 2>&1) &
  API_PID=$!
else
  echo "Warning: No launcher found and uv is not installed. Start the API manually on port 8001."
  API_PID=""
fi

# --- Step 2: UI backend ---
echo "[2/3] Starting UI backend..."
if [ ! -d "$UI_DIR/server/node_modules" ]; then
  echo "  Installing backend dependencies..."
  (cd "$UI_DIR/server" && npm install)
fi
(cd "$UI_DIR/server" && npm run dev > "$UI_DIR/logs/backend.log" 2>&1) &
BACKEND_PID=$!

# --- Step 3: Frontend ---
echo "[3/3] Starting frontend..."
if [ ! -d "$UI_DIR/node_modules" ]; then
  echo "  Installing frontend dependencies..."
  (cd "$UI_DIR" && npm install)
fi
(cd "$UI_DIR" && npm run dev > "$UI_DIR/logs/frontend.log" 2>&1) &
FRONTEND_PID=$!

echo
echo "=================================="
echo "  All Services Starting!"
echo "=================================="
echo "  ACE-Step API: http://localhost:8001"
echo "  Backend:      http://localhost:3001"
echo "  Frontend:     http://localhost:$UI_PORT"
echo
if command -v ip >/dev/null 2>&1; then
  LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' || echo "")
  [ -n "$LOCAL_IP" ] && echo "  LAN Access:   http://$LOCAL_IP:$UI_PORT"
elif command -v ifconfig >/dev/null 2>&1; then
  LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n1)
  [ -n "$LOCAL_IP" ] && echo "  LAN Access:   http://$LOCAL_IP:$UI_PORT"
fi
echo
echo "  Logs: $UI_DIR/logs/"
echo "  Stop:  kill $API_PID $BACKEND_PID $FRONTEND_PID"
echo
echo "Waiting for services to initialize (15s)..."
sleep 15

if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
  echo "Frontend is up at http://localhost:$UI_PORT"
else
  echo "Warning: Frontend may not have started. Check $UI_DIR/logs/frontend.log"
fi

echo ""
echo "Services are running in the background. Press Ctrl+C to keep them running."
echo "To stop everything: kill $API_PID $BACKEND_PID $FRONTEND_PID"
wait