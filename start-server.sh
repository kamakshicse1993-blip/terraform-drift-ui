#!/usr/bin/env bash
# Start the Terraform Drift UI backend (Node.js required)
set -e
PORT=${1:-8080}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
LOG="$SCRIPT_DIR/server.log"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "Error: backend/ directory not found at $BACKEND_DIR" >&2
  exit 1
fi

cd "$BACKEND_DIR"

if [ ! -d node_modules ]; then
  echo "Error: node_modules not found. Run 'cd backend && npm install' first." >&2
  exit 1
fi

echo "Starting server on port $PORT (logs: $LOG)"
BACKEND_PORT=$PORT nohup node server.js > "$LOG" 2>&1 &
PID=$!
echo "Server started on port $PORT. PID: $PID"
echo $PID > "$SCRIPT_DIR/server.pid"

URL="http://localhost:$PORT"
echo "Open: $URL"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" &>/dev/null || true
elif command -v open >/dev/null 2>&1; then
  open "$URL" &>/dev/null || true
fi
