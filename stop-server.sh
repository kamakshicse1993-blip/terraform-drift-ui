#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f server.pid ]; then
    PID=$(cat server.pid)
    echo "Stopping PID $PID"
    kill "$PID" 2>/dev/null || true
    rm -f server.pid
    echo "Server stopped"
else
    echo "No server.pid file found. Attempting to find running server processes..."
    pkill -f "server.js" || true
    echo "Done"
fi
