#!/bin/bash
# ACE-Step Music — stop only the processes started by ./start.sh.
#
# Reads the PID files written by start.sh (.run/*.pid) and terminates exactly
# those processes. It NEVER kills by port and NEVER touches Docker or any other
# service — safe even when Open WebUI / SearXNG run on port 3000.
set -euo pipefail

cd "$(dirname "$0")"
REPO_ROOT="$(pwd)"
RUN_DIR="$REPO_ROOT/.run"

echo "Stopping ACE-Step Music services..."

stopped=0
for name in api backend frontend; do
  pid_file="$RUN_DIR/$name.pid"
  if [ ! -f "$pid_file" ]; then
    echo "  $name: no pid file (not running via start.sh)"
    continue
  fi
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    # Terminate the process and any children it spawned (e.g. npm -> node, uv -> python).
    kill "$pid" 2>/dev/null || true
    sleep 1
    # If it is still alive, escalate to SIGKILL.
    if kill -0 "$pid" 2>/dev/null; then
      # Kill the process group if it has one, otherwise the single PID.
      kill -- "-$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
    fi
    echo "  stopped $name (pid $pid)"
    stopped=1
  else
    echo "  $name: pid $pid not running (already stopped)"
  fi
  rm -f "$pid_file"
done

# The npm/uv wrappers may leave grandchildren (node, python) running under the
# same process group. Best-effort cleanup: only kill processes whose command
# line matches OUR service scripts (never by port, never blanket).
for pat in \
  "acestep-api" \
  "$REPO_ROOT/webui/server" \
  "$REPO_ROOT/webui/node_modules/vite"; do
  pids="$(pgrep -f "$pat" 2>/dev/null || true)"
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done
done

if [ "$stopped" -eq 0 ]; then
  echo "  Nothing to stop."
fi

echo "Done. Docker and other services are untouched."
exit 0