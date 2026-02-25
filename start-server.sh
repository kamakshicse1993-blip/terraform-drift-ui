#!/usr/bin/env bash
# Start a local static server (Node -> Python3 -> PowerShell serve.ps1)
set -e
PORT=${1:-8080}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
LOG=server.log

echo "Starting server on port $PORT (logs: $LOG)"
PID=""
if command -v node >/dev/null 2>&1; then
	nohup node server.js > "$LOG" 2>&1 &
	PID=$!
elif command -v python3 >/dev/null 2>&1; then
	nohup python3 -m http.server "$PORT" > "$LOG" 2>&1 &
	PID=$!
elif command -v pwsh >/dev/null 2>&1; then
	nohup pwsh -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT_DIR/serve.ps1" -Port "$PORT" > "$LOG" 2>&1 &
	PID=$!
elif command -v powershell >/dev/null 2>&1; then
	nohup powershell -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT_DIR/serve.ps1" -Port "$PORT" > "$LOG" 2>&1 &
	PID=$!
else
	echo "No supported runtime found (node, python3, pwsh, powershell)." >&2
	exit 1
fi

if [ -n "$PID" ]; then
	echo "Server started on port $PORT. PID: $PID"
	echo $PID > server.pid
fi

# Try to open the default browser (best-effort)
URL="http://localhost:$PORT"
if command -v xdg-open >/dev/null 2>&1; then
	xdg-open "$URL" &>/dev/null || true
elif command -v open >/dev/null 2>&1; then
	open "$URL" &>/dev/null || true
elif command -v cmd.exe >/dev/null 2>&1; then
	cmd.exe /c start "" "$URL" &>/dev/null || true
else
	# fallback to explorer (Windows WSL / Git Bash)
	explorer "$URL" &>/dev/null || true
fi
