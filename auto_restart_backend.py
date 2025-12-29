#!/usr/bin/env python3
"""
Auto-restart backend server
"""
import subprocess
import sys
import os
import time
import psutil
from pathlib import Path

def restart_backend():
    print("🔄 Auto-restarting backend server...")
    
    # Kill existing processes
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['name'] in ['python', 'python3']:
                cmdline = proc.info['cmdline']
                if cmdline and 'main.py' in ' '.join(cmdline):
                    print(f"🔪 Killing process {proc.info['pid']}")
                    proc.terminate()
        except:
            pass
    
    time.sleep(2)
    
    # Start new server
    backend_dir = Path(__file__).parent / "backend"
    os.chdir(str(backend_dir))
    
    print("🚀 Starting backend server...")
    subprocess.Popen([sys.executable, "main.py"])
    
    print("✅ Backend server restarted")
    print("🔗 Server should be available at: http://localhost:8000")
    print("📋 Enhanced logging is now active")

if __name__ == "__main__":
    restart_backend()