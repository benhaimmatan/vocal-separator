# Cursor Rules for AudioAlchemy Project

## CRITICAL Backend Server Restart Protocol
### MANDATORY procedure for ALL server restarts to avoid "address already in use" errors:

**STEP 1: Complete Process Identification & Termination**
```bash
# Kill all possible Python/uvicorn processes
pkill -f "python.*main.py"
pkill -f uvicorn
pkill -9 -f "python3.*main.py"

# Find any remaining processes on port 8000
lsof -i :8000

# If processes found, kill by PID (replace XXXX with actual PID)
kill -9 XXXX

# Wait for processes to fully terminate
sleep 3
```

**STEP 2: Port Verification** 
```bash
# Verify port 8000 is completely free
lsof -i :8000

# Should return empty/no output
# If still occupied, repeat STEP 1 with specific PIDs
```

**STEP 3: Clean Server Startup**
```bash
# Navigate to backend directory (CRITICAL)
cd /Users/matanbenhaim/vocal-separator/backend

# Verify we're in correct location
pwd && ls -la main.py

# Start server with nohup for stability
nohup python3 main.py > server.log 2>&1 &

# Note the process ID that's returned: [1] XXXX
```

**STEP 4: Startup Verification**
```bash
# Wait for complete initialization (models take ~15-20 seconds)
sleep 20

# Check server log for success
tail -10 server.log | grep "Uvicorn running"

# Test API endpoint
curl -s http://localhost:8000/api/ping

# Should return: {"status":"ok","message":"Backend server is up and running"}
```

**STEP 5: Failure Recovery**
```bash
# If startup fails, check log for errors
cat server.log

# Common issues:
# - Still "address in use" → repeat STEP 1-2
# - File not found → verify pwd is /backend
# - Import errors → check Python environment
```

### When to Use This Protocol:
- ✅ After any backend code changes
- ✅ Before testing new features
- ✅ When "address already in use" error occurs
- ✅ When backend becomes unresponsive
- ✅ After system restarts/hibernation

### NEVER skip steps or assume previous kills worked! 

### Quick Restart Option:
```bash
# Use the automated script (implements full protocol)
cd /Users/matanbenhaim/vocal-separator/backend
./restart_server.sh
```

## Critical Development Server Management 