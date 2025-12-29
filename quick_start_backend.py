#!/usr/bin/env python3
"""
Quick start backend server
"""
import os
import sys
import subprocess
import time
import requests
from pathlib import Path

def start_backend():
    """Start the backend server"""
    print("🚀 Starting backend server...")
    
    # Navigate to backend directory
    backend_dir = Path(__file__).parent / "backend"
    os.chdir(str(backend_dir))
    
    # Start the server
    try:
        proc = subprocess.Popen([sys.executable, "main.py"])
        print(f"✅ Backend started with PID: {proc.pid}")
        
        # Wait for it to start
        print("⏳ Waiting for server to be ready...")
        for i in range(10):
            try:
                response = requests.get("http://localhost:8000/api/ping", timeout=2)
                if response.status_code == 200:
                    print("✅ Backend server is ready!")
                    return True
            except:
                pass
            time.sleep(1)
        
        print("❌ Backend server did not start properly")
        return False
        
    except Exception as e:
        print(f"❌ Failed to start backend: {e}")
        return False

if __name__ == "__main__":
    if start_backend():
        print("\n🎯 Backend is running! Now try the live recording feature.")
        print("Open your browser console (F12) and watch for detailed logs.")
        print("Expected flow:")
        print("1. Click 'Start Listening' → Should show audio levels")
        print("2. Click 'Record Chords' → Should start recording")
        print("3. Click 'Stop & Analyze' → Should send to backend")
        print("4. Check console for detailed request/response logs")
        
        # Keep the script running
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n🛑 Stopped")
    else:
        print("❌ Failed to start backend server")