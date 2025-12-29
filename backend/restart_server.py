#!/usr/bin/env python3
"""
Restart the backend server
"""
import subprocess
import sys
import os
import signal
import time
import psutil

def kill_existing_servers():
    """Kill any existing Python servers"""
    print("🔍 Looking for existing Python servers...")
    killed = False
    
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['name'] == 'python' or proc.info['name'] == 'python3':
                cmdline = proc.info['cmdline']
                if cmdline and 'main.py' in ' '.join(cmdline):
                    print(f"🔪 Killing process {proc.info['pid']}: {' '.join(cmdline)}")
                    proc.terminate()
                    killed = True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    if killed:
        print("⏳ Waiting for processes to terminate...")
        time.sleep(2)
    else:
        print("✅ No existing Python servers found")

def start_server():
    """Start the backend server"""
    print("🚀 Starting backend server...")
    
    # Change to backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)
    
    # Start the server
    try:
        process = subprocess.Popen([sys.executable, "main.py"])
        print(f"✅ Backend server started with PID: {process.pid}")
        
        # Wait a moment for server to start
        time.sleep(3)
        
        # Check if it's still running
        if process.poll() is None:
            print("🌟 Backend server is running successfully!")
            print("🔗 API available at: http://localhost:8000")
            return True
        else:
            print("❌ Backend server failed to start")
            return False
            
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        return False

def main():
    print("🔄 Restarting Backend Server...")
    print("=" * 40)
    
    # Kill existing servers
    kill_existing_servers()
    
    # Start new server
    if start_server():
        print("\n✅ Backend server restarted successfully!")
        print("You can now test the live recording feature.")
    else:
        print("\n❌ Failed to restart backend server")

if __name__ == "__main__":
    main()