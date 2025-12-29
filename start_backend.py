#!/usr/bin/env python3
"""
Start the backend server
"""
import subprocess
import sys
import os
import time
from pathlib import Path

def start_backend():
    """Start the backend server"""
    print("🚀 Starting backend server...")
    
    # Get the backend directory
    backend_dir = Path(__file__).parent / "backend"
    
    if not backend_dir.exists():
        print(f"❌ Backend directory not found: {backend_dir}")
        return False
    
    # Change to backend directory and start server
    try:
        os.chdir(str(backend_dir))
        
        # Start the server in the background
        print(f"📁 Working directory: {os.getcwd()}")
        print("🎯 Starting main.py...")
        
        # Use subprocess to start the server
        process = subprocess.Popen([
            sys.executable, "main.py"
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        print(f"✅ Backend server started with PID: {process.pid}")
        print("🔗 API should be available at: http://localhost:8000")
        
        # Keep the process running
        try:
            process.wait()
        except KeyboardInterrupt:
            print("\n🛑 Shutting down backend server...")
            process.terminate()
            process.wait()
        
        return True
        
    except Exception as e:
        print(f"❌ Error starting backend: {e}")
        return False

if __name__ == "__main__":
    start_backend()