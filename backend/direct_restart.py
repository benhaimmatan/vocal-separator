#!/usr/bin/env python3
"""
Direct restart script - runs from backend directory
"""
import os
import sys
import subprocess
import time
import signal
import psutil
import requests

def main():
    print("🔄 Direct Backend Server Restart")
    print("=" * 40)
    
    # Make sure we're in the right directory
    backend_dir = "/Users/matanbenhaim/vocal-separator/backend"
    if os.getcwd() != backend_dir:
        os.chdir(backend_dir)
    
    print(f"📁 Working directory: {os.getcwd()}")
    
    # Step 1: Kill existing processes
    print("\n📋 STEP 1: Killing existing processes...")
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
    
    # Step 2: Check port 8000
    print("\n📋 STEP 2: Checking port 8000...")
    port_procs = []
    
    for proc in psutil.process_iter(['pid', 'name', 'connections']):
        try:
            connections = proc.info['connections']
            if connections:
                for conn in connections:
                    if conn.laddr and conn.laddr.port == 8000:
                        port_procs.append(proc)
                        print(f"⚠️  Port 8000 occupied by process {proc.info['pid']}: {proc.info['name']}")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    if port_procs:
        print("🔪 Killing processes occupying port 8000...")
        for proc in port_procs:
            try:
                proc.kill()
            except:
                pass
        time.sleep(2)
    else:
        print("✅ Port 8000 is free")
    
    # Step 3: Start the server
    print("\n📋 STEP 3: Starting server...")
    
    # Create/clear log file
    log_file = "server.log"
    
    try:
        with open(log_file, 'w') as log:
            process = subprocess.Popen(
                [sys.executable, "main.py"],
                stdout=log,
                stderr=subprocess.STDOUT,
                cwd=backend_dir
            )
        
        print(f"✅ Server started with PID: {process.pid}")
        print(f"📋 Logs: {os.path.join(backend_dir, log_file)}")
        
        # Step 4: Wait for initialization
        print("\n📋 STEP 4: Waiting for server initialization...")
        for i in range(20):
            time.sleep(1)
            if process.poll() is not None:
                print(f"❌ Server process terminated after {i+1} seconds!")
                break
            print(f"⏳ Waiting... ({i+1}/20)")
        
        # Step 5: Verify server is running
        print("\n📋 STEP 5: Verifying server...")
        
        if process.poll() is None:
            print("✅ Server process is running!")
            
            # Test API endpoint
            try:
                response = requests.get("http://localhost:8000/api/ping", timeout=5)
                if response.status_code == 200:
                    print("✅ API endpoint responding correctly!")
                    print("🎉 BACKEND RESTART SUCCESSFUL!")
                    
                    print(f"\n📋 Server Details:")
                    print(f"   - PID: {process.pid}")
                    print(f"   - URL: http://localhost:8000")
                    print(f"   - Logs: {os.path.join(backend_dir, log_file)}")
                    print(f"   - To stop: kill {process.pid}")
                    
                    return True
                else:
                    print(f"⚠️  API endpoint returned status {response.status_code}")
            except Exception as e:
                print(f"⚠️  Could not test API endpoint: {e}")
                print("Server process is running but API may not be ready yet")
        else:
            print("❌ Server process has terminated!")
            print("📋 Checking log file for errors...")
            try:
                with open(log_file, 'r') as f:
                    lines = f.readlines()
                    print("Last 10 lines of log:")
                    for line in lines[-10:]:
                        print(f"   {line.strip()}")
            except:
                print("Could not read log file")
        
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return False

if __name__ == "__main__":
    success = main()
    if success:
        print("\n✅ All tasks completed successfully!")
    else:
        print("\n❌ Some tasks failed. Check the logs for details.")
    
    sys.exit(0 if success else 1)