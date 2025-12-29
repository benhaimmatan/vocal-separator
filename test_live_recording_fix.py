#!/usr/bin/env python3
"""
Test script to verify live recording functionality
"""
import subprocess
import time
import sys
import os
from pathlib import Path

def start_backend():
    """Start the backend server"""
    print("Starting backend server...")
    backend_dir = Path(__file__).parent / "backend"
    
    if not backend_dir.exists():
        print(f"❌ Backend directory not found: {backend_dir}")
        return None
    
    try:
        # Start the backend server
        process = subprocess.Popen(
            [sys.executable, "main.py"],
            cwd=str(backend_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Give it a moment to start
        time.sleep(3)
        
        # Check if it's still running
        if process.poll() is None:
            print("✅ Backend server started successfully")
            return process
        else:
            stdout, stderr = process.communicate()
            print(f"❌ Backend server failed to start")
            print(f"STDOUT: {stdout}")
            print(f"STDERR: {stderr}")
            return None
            
    except Exception as e:
        print(f"❌ Error starting backend: {e}")
        return None

def main():
    print("🧪 Testing Live Recording Fix")
    print("=" * 50)
    
    # Start backend
    backend_process = start_backend()
    
    if backend_process:
        print("\n✅ Backend is running!")
        print("\nNow test the live recording feature:")
        print("1. Open your frontend (usually http://localhost:5173)")
        print("2. Go to Live Capture tab")
        print("3. Record some audio")
        print("4. Check if it appears in Library and Chord Finder tabs")
        print("\nPress Ctrl+C to stop the backend server...")
        
        try:
            # Keep the backend running
            backend_process.wait()
        except KeyboardInterrupt:
            print("\n\n🛑 Stopping backend server...")
            backend_process.terminate()
            backend_process.wait()
            print("✅ Backend server stopped")
    else:
        print("❌ Cannot start backend server. Please check the logs.")

if __name__ == "__main__":
    main()