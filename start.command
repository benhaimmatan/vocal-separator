#!/bin/bash

# Move to the project directory
cd "$(dirname "$0")"

echo "Starting AudioAlchemy Application..."
echo "-------------------------------------"

# Kill any existing uvicorn processes
echo "Checking for existing backend processes..."
pkill -f uvicorn
sleep 1  # Wait for processes to be killed

# Start backend in a new Terminal window
echo "Starting Backend Server..."
osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"'/backend && python3 -m uvicorn main:app --reload --host 0.0.0.0"'

# Wait a moment for backend to start
sleep 2

# Start frontend in a new Terminal window
echo "Starting Frontend Server..."
osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"'/frontend && npm run dev"'

# Wait a moment for frontend to start
sleep 3

# Open the app in browser
echo "Opening application in browser..."
open http://localhost:5173

echo "Services started successfully!"
echo ""
echo "To stop the application, close the terminal windows."
echo "You can access the application at: http://localhost:5173"
echo ""
echo "Press Enter to exit this window..."
read 