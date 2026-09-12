#!/bin/bash
# ACE-Step Music — stop all running services.
# Kills the ACE-Step API, UI backend, and Vite frontend started by ./start.sh.
set -e

echo "Stopping ACE-Step Music services..."

# Kill by port (API 8001, backend 3001, frontend from UI_PORT or 3000)
for PORT in 8001 3001 "${UI_PORT:-3000}"; do
  PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    kill $PIDS 2>/dev/null && echo "  Stopped process(es) on port $PORT" || true
  else
    echo "  Nothing running on port $PORT"
  fi
done

echo "Done."