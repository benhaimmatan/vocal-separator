#!/usr/bin/env python3
"""
Emergency restart script for the vocal separator backend server
"""
import os
import sys
import subprocess
import time
import signal
import psutil

def kill_existing_processes():
    """Kill any existing Python processes running main.py"""
    print("🔍 Searching for existing Python processes...")
    killed_count = 0
    
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['name'] in ['python', 'python3']:
                cmdline = proc.info['cmdline']
                if cmdline and any('main.py' in arg for arg in cmdline):
                    print(f"🔪 Killing process {proc.info['pid']}: {' '.join(cmdline)}")
                    proc.terminate()
                    killed_count += 1
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    
    if killed_count > 0:
        print(f"⏳ Waiting for {killed_count} process(es) to terminate...")
        time.sleep(3)
        
        # Force kill any remaining processes
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if proc.info['name'] in ['python', 'python3']:
                    cmdline = proc.info['cmdline']
                    if cmdline and any('main.py' in arg for arg in cmdline):
                        print(f"💀 Force killing stubborn process {proc.info['pid']}")
                        proc.kill()
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
    else:
        print("✅ No existing Python processes found")

def check_port_8000():
    """Check if port 8000 is in use"""
    print("🔍 Checking port 8000...")
    
    for proc in psutil.process_iter(['pid', 'name', 'connections']):
        try:
            connections = proc.info['connections']
            if connections:
                for conn in connections:
                    if conn.laddr and conn.laddr.port == 8000:
                        print(f"⚠️  Port 8000 is occupied by process {proc.info['pid']}: {proc.info['name']}")
                        return proc
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    print("✅ Port 8000 is free")
    return None

def main():
    print("🚨 EMERGENCY BACKEND RESTART PROTOCOL 🚨")
    print("=" * 50)
    
    # Step 1: Kill existing processes
    kill_existing_processes()
    
    # Step 2: Check port 8000
    port_proc = check_port_8000()
    if port_proc:
        print(f"🔪 Killing process occupying port 8000: {port_proc.info['pid']}")
        try:
            port_proc.kill()
            time.sleep(2)
        except:
            pass
    
    # Step 3: Change to backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    print(f"📁 Changing to backend directory: {backend_dir}")
    os.chdir(backend_dir)
    
    # Step 4: Start the server
    print("🚀 Starting backend server...")
    
    # Create a log file for output
    log_file = os.path.join(backend_dir, "server.log")
    
    try:
        with open(log_file, 'w') as log:
            # Start main.py as a subprocess
            process = subprocess.Popen(
                [sys.executable, "main.py"],
                stdout=log,
                stderr=subprocess.STDOUT,
                cwd=backend_dir
            )
            
            print(f"✅ Server started with PID: {process.pid}")
            print(f"📋 Logs are being written to: {log_file}")
            
            # Wait a bit for server to start
            print("⏳ Waiting 10 seconds for server initialization...")
            time.sleep(10)
            
            # Check if process is still running
            if process.poll() is None:
                print("✅ Server process is still running!")
                
                # Try to test the API
                try:
                    import requests
                    response = requests.get("http://localhost:8000/api/ping", timeout=5)
                    if response.status_code == 200:
                        print("✅ API endpoint is responding!")
                        print("🎉 BACKEND RESTART SUCCESSFUL!")
                    else:
                        print(f"⚠️  API endpoint returned status {response.status_code}")
                except Exception as e:
                    print(f"⚠️  Could not test API endpoint: {e}")
                    print("✅ But server process is running, check logs for details")
                
                print(f"\n📋 Server Information:")
                print(f"   - PID: {process.pid}")
                print(f"   - Log file: {log_file}")
                print(f"   - API URL: http://localhost:8000")
                print(f"   - To stop: kill {process.pid}")
                
            else:
                print("❌ Server process has terminated!")
                print("📋 Check the log file for error details:")
                print(f"   tail -20 {log_file}")
    
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)