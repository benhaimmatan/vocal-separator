#!/usr/bin/env python3
"""
Start the backend server
"""
import subprocess
import sys
import os
import signal
import time
import psutil

def kill_existing():
    """Kill existing Python processes running main.py"""
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['name'] in ['python', 'python3']:
                cmdline = proc.info['cmdline']
                if cmdline and 'main.py' in ' '.join(cmdline):
                    print(f"Killing process {proc.info['pid']}")
                    proc.terminate()
        except:
            pass
    time.sleep(2)

def main():
    print("Starting backend server...")
    
    # Kill existing processes
    kill_existing()
    
    # Start the server
    os.execv(sys.executable, [sys.executable, "main.py"])

if __name__ == "__main__":
    main()