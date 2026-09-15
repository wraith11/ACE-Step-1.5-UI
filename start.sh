#!/bin/bash
# ACE-Step Music — start everything as tracked background processes.
#
# Starts three services, all bound to 0.0.0.0 for LAN access:
#   1. ACE-Step REST API server (port 8001, MLX backend on Apple Silicon)
#   2. UI backend               (port 3001)
#   3. Vite frontend            (port 3000, override with UI_PORT)
#
# Usage:
#   ./start.sh                       # default
#   UI_PORT=3005 ./start.sh          # different frontend port
#   ACESTEP_PATH=/path ./start.sh    # custom repo root
#
# Every launched process is recorded in .run/ (PID files). Use ./stop.sh to
# stop ONLY these processes — never touches Docker or other services.
set -euo pipefail

cd "$(dirname "$0")"
REPO_ROOT="$(pwd)"
WEBUI_DIR="$REPO_ROOT/webui"
ACESTEP_PATH="${ACESTEP_PATH:-$REPO_ROOT}"

UI_PORT="${UI_PORT:-3000}"
export UI_PORT

RUN_DIR="$REPO_ROOT/.run"
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$RUN_DIR" "$LOG_DIR"

# If already running, refuse to double-start.
if [ -f "$RUN_DIR/api.pid" ] && kill -0 "$(cat "$RUN_DIR/api.pid")" 2>/dev/null; then
  echo "ACE-Step Music is already running (API pid $(cat "$RUN_DIR/api.pid"))."
  echo "Use ./stop.sh first."
  exit 1
fi

echo "=================================="
echo "  ACE-Step Music — Startup"
echo "=================================="
echo "  Repo root:   $REPO_ROOT"
echo "  Web UI:      $WEBUI_DIR"
echo

# Clean stale PID files from a previous crashed session.
rm -f "$RUN_DIR"/*.pid

# --- Step 1: ACE-Step API server (MLX backend, lazy model load) ---
# ACESTEP_NO_INIT=true keeps startup light; models load on first request.
# CHECK_UPDATE=false skips the launcher's git fetch on every start.
echo "[1/3] Starting ACE-Step API server..."
if [ -f "$ACESTEP_PATH/start_api_server_macos.sh" ]; then
  (cd "$ACESTEP_PATH" && ACESTEP_NO_INIT=true CHECK_UPDATE=false ./start_api_server_macos.sh > "$LOG_DIR/api.log" 2>&1) &
  API_PID=$!
elif command -v uv >/dev/null 2>&1; then
  (cd "$ACESTEP_PATH" && ACESTEP_LM_BACKEND="mlx" ACESTEP_NO_INIT=true CHECK_UPDATE=false uv run acestep-api --no-init --port 8001 > "$LOG_DIR/api.log" 2>&1) &
  API_PID=$!
else
  echo "Warning: No launcher found and uv is not installed. Start the API manually on port 8001."
  API_PID=""
fi
echo "$API_PID" > "$RUN_DIR/api.pid"

# --- Step 2: UI backend ---
echo "[2/3] Starting UI backend..."
if [ ! -d "$WEBUI_DIR/server/node_modules" ]; then
  echo "  Installing backend dependencies..."
  (cd "$WEBUI_DIR/server" && npm install)
fi
(cd "$WEBUI_DIR/server" && npm run dev > "$LOG_DIR/backend.log" 2>&1) &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$RUN_DIR/backend.pid"

# --- Step 3: Frontend ---
echo "[3/3] Starting frontend..."
if [ ! -d "$WEBUI_DIR/node_modules" ]; then
  echo "  Installing frontend dependencies..."
  (cd "$WEBUI_DIR" && npm install)
fi
(cd "$WEBUI_DIR" && npm run dev > "$LOG_DIR/frontend.log" 2>&1) &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$RUN_DIR/frontend.pid"

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
echo "  Logs: $LOG_DIR/"
echo "  Stop: ./stop.sh   (stops only ACE-Step Music processes)"
echo
echo "Waiting for services to initialize (15s)..."
sleep 15

if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
  echo "Frontend is up at http://localhost:$UI_PORT"
else
  echo "Warning: Frontend may not have started. Check $LOG_DIR/frontend.log"
fi

echo ""
echo "All services are running in the background."
echo "To stop everything (only ACE-Step Music): ./stop.sh"
echo "PIDs are saved in .run/ for safe shutdown."
exit 0