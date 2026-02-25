#!/bin/bash
cd /proj/xcohdstaff8/kak/terraform-drift-ui
if [ -f server.pid ]; then
    kill $(cat server.pid) 2>/dev/null
    rm server.pid
    echo "Server stopped"
else
    echo "No server.pid file found. Trying to find and kill the process..."
    pkill -f "python3 -m http.server 8080"
    echo "Done"
fi
