#!/bin/bash

echo "🔄 Restarting Backend Server..."

# Kill any existing Python processes
echo "Killing existing Python processes..."
pkill -f "python.*main.py" || echo "No existing Python processes found"

# Wait a moment
sleep 2

# Navigate to backend directory
cd /Users/matanbenhaim/vocal-separator/backend

# Start the backend server
echo "Starting backend server..."
python main.py &

# Wait for server to start
sleep 3

# Check if it's running
if curl -s http://localhost:8000/api/ping > /dev/null; then
    echo "✅ Backend server is running!"
    echo "🔗 API available at: http://localhost:8000"
else
    echo "❌ Backend server failed to start"
    echo "Check the logs for errors"
fi

echo "Done!"