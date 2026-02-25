#!/bin/bash
cd /proj/xcohdstaff8/kak/terraform-drift-ui
nohup python3 -m http.server 8080 > server.log 2>&1 &
echo "Server started on port 8080. PID: $!"
echo $! > server.pid
