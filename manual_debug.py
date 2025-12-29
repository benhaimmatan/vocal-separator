#!/usr/bin/env python3
"""
Manual debug script - run this to identify the issue
"""
import subprocess
import sys
import os
import time
from pathlib import Path

def main():
    print("🔍 Manual Debug for Live Recording Issue")
    print("=" * 50)
    
    # Step 1: Kill existing processes
    print("\n1. Killing existing Python processes...")
    try:
        result = subprocess.run(["pkill", "-f", "python.*main.py"], 
                              capture_output=True, text=True)
        print("   ✅ Killed existing processes")
    except Exception as e:
        print(f"   ⚠️ Could not kill processes: {e}")
    
    # Step 2: Start backend
    print("\n2. Starting backend server...")
    backend_dir = Path(__file__).parent / "backend"
    
    if not backend_dir.exists():
        print(f"   ❌ Backend directory not found: {backend_dir}")
        return
    
    try:
        os.chdir(str(backend_dir))
        print(f"   📁 Changed to: {os.getcwd()}")
        
        # Start the server
        print("   🚀 Starting main.py...")
        subprocess.Popen([sys.executable, "main.py"])
        
        print("   ✅ Backend server started")
        print("   🔗 Should be available at: http://localhost:8000")
        
    except Exception as e:
        print(f"   ❌ Error starting backend: {e}")
        return
    
    # Step 3: Wait and test
    print("\n3. Waiting for server to start...")
    time.sleep(5)
    
    print("\n4. Testing server...")
    try:
        import requests
        response = requests.get("http://localhost:8000/api/ping", timeout=5)
        if response.status_code == 200:
            print("   ✅ Server is responding")
        else:
            print(f"   ❌ Server returned status {response.status_code}")
    except Exception as e:
        print(f"   ❌ Server not responding: {e}")
    
    print("\n🎯 Next steps:")
    print("1. Try recording audio in the Live Capture tab")
    print("2. Check browser console for messages")
    print("3. Check if recordings appear in Library tab")
    print("4. Report back what you see")

if __name__ == "__main__":
    main()