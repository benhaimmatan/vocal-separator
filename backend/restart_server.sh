#!/bin/bash

# Backend Server Restart Protocol Script
# Implements the procedure documented in CURSOR_RULES.md

echo "🔄 Starting Backend Server Restart Protocol..."

echo "📋 STEP 1: Process Termination"
pkill -f "python.*main.py"
pkill -f uvicorn
pkill -9 -f "python3.*main.py"
sleep 3

echo "📋 STEP 2: Port Verification"
PROCESSES=$(lsof -i :8000)
if [ ! -z "$PROCESSES" ]; then
    echo "⚠️  Port 8000 still occupied:"
    echo "$PROCESSES"
    echo "💀 Force killing remaining processes..."
    lsof -ti :8000 | xargs kill -9 2>/dev/null
    sleep 3
fi

# Verify port is free
FINAL_CHECK=$(lsof -i :8000)
if [ ! -z "$FINAL_CHECK" ]; then
    echo "❌ FAILED: Port 8000 still occupied after force kill"
    echo "$FINAL_CHECK"
    exit 1
fi

echo "✅ Port 8000 is free"

echo "📋 STEP 3: Navigate to Backend Directory"
cd /Users/matanbenhaim/vocal-separator/backend

if [ ! -f "main.py" ]; then
    echo "❌ FAILED: main.py not found in current directory"
    pwd
    exit 1
fi

echo "✅ In correct directory: $(pwd)"

echo "📋 STEP 4: Starting Server"
nohup python3 main.py > server.log 2>&1 &
SERVER_PID=$!
echo "🚀 Server started with PID: $SERVER_PID"

echo "📋 STEP 5: Waiting for Initialization (20 seconds)..."
sleep 20

echo "📋 STEP 6: Verification"
if grep -q "Uvicorn running" server.log; then
    echo "✅ Server startup detected in logs"
else
    echo "⚠️  Server startup not detected, checking logs:"
    tail -10 server.log
fi

# Test API endpoint
PING_RESPONSE=$(curl -s http://localhost:8000/api/ping)
if [[ "$PING_RESPONSE" == *"status\":\"ok"* ]]; then
    echo "✅ API endpoint responding correctly"
    echo "🎉 Backend restart SUCCESSFUL!"
else
    echo "❌ API endpoint not responding:"
    echo "$PING_RESPONSE"
    echo "📋 Server logs:"
    tail -20 server.log
    exit 1
fi 