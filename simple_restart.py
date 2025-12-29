#!/usr/bin/env python3
"""
Simple backend restart - run this manually if needed
"""
import os
import sys
import subprocess
import time

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

def restart():
    print("🔄 Restarting backend server...")
    
    # Change to backend directory
    backend_dir = os.path.join(os.path.dirname(__file__), "backend")
    os.chdir(backend_dir)
    
    # Kill existing processes
    try:
        subprocess.run(["pkill", "-f", "python.*main.py"], check=False)
        print("🔪 Killed existing processes")
    except:
        print("⚠️ Could not kill processes")
    
    time.sleep(2)
    
    # Start server
    print("🚀 Starting server...")
    subprocess.Popen([sys.executable, "main.py"])
    
    print("✅ Server started")
    print("🔗 http://localhost:8000")

if __name__ == "__main__":
    restart()