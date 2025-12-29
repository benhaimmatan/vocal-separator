#!/usr/bin/env python3
"""
Backend restart script - run this to restart the backend server
"""
import subprocess
import time
import os
import sys

def restart_backend():
    print("🔄 Restarting backend server...")
    
    # Kill existing processes
    try:
        subprocess.run(["pkill", "-f", "python.*main.py"], check=False)
        print("🔪 Killed existing backend processes")
        time.sleep(2)
    except Exception as e:
        print(f"⚠️ Could not kill processes: {e}")
    
    # Change to backend directory
    backend_dir = "/Users/matanbenhaim/vocal-separator/backend"
    os.chdir(backend_dir)
    
    # Start backend
    print("🚀 Starting backend with forced save enabled...")
    process = subprocess.Popen([sys.executable, "main.py"])
    
    print(f"✅ Backend started with PID: {process.pid}")
    print("🎤 FORCE SAVE ENABLED - All live recordings will be saved!")
    print("📁 Recordings will be saved to: ~/Downloads/Vocals/Live Captures/")
    
    return process.pid

if __name__ == "__main__":
    restart_backend()