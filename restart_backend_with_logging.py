#!/usr/bin/env python3
"""
Restart backend server with enhanced logging
"""
import subprocess
import sys
import os
import time
import psutil
from pathlib import Path

def kill_backend_processes():
    """Kill any existing backend processes"""
    print("🔍 Looking for existing backend processes...")
    killed = False
    
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['name'] in ['python', 'python3']:
                cmdline = proc.info['cmdline']
                if cmdline and 'main.py' in ' '.join(cmdline):
                    print(f"🔪 Killing backend process {proc.info['pid']}")
                    proc.terminate()
                    killed = True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    if killed:
        print("⏳ Waiting for processes to terminate...")
        time.sleep(3)
    else:
        print("✅ No existing backend processes found")

def start_backend_server():
    """Start the backend server"""
    print("🚀 Starting backend server with enhanced logging...")
    
    # Navigate to backend directory
    backend_dir = Path(__file__).parent / "backend"
    if not backend_dir.exists():
        print(f"❌ Backend directory not found: {backend_dir}")
        return False
    
    # Change to backend directory
    os.chdir(str(backend_dir))
    print(f"📁 Working directory: {os.getcwd()}")
    
    # Start the server
    try:
        print("🎯 Starting main.py...")
        process = subprocess.Popen(
            [sys.executable, "main.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        print(f"✅ Backend server started with PID: {process.pid}")
        print("📋 Server output:")
        print("-" * 50)
        
        # Show real-time output
        for line in iter(process.stdout.readline, ''):
            print(line.rstrip())
            
        return True
        
    except Exception as e:
        print(f"❌ Error starting backend server: {e}")
        return False

def main():
    print("🔄 Restarting Backend Server with Enhanced Logging")
    print("=" * 60)
    
    # Kill existing processes
    kill_backend_processes()
    
    # Start new server
    start_backend_server()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
        kill_backend_processes()
        print("✅ Backend server stopped")