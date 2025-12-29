#!/usr/bin/env python3
"""
Debug script to test live recording functionality
"""
import requests
import json
import os
from pathlib import Path

def test_backend_connection():
    """Test if backend is running"""
    try:
        response = requests.get('http://localhost:8000/api/ping', timeout=5)
        print(f"✅ Backend is running: {response.json()}")
        return True
    except Exception as e:
        print(f"❌ Backend connection failed: {e}")
        return False

def test_library_endpoint():
    """Test the library endpoint to see current files"""
    try:
        response = requests.get('http://localhost:8000/api/library', timeout=10)
        if response.ok:
            data = response.json()
            files = data.get('files', [])
            print(f"📚 Library has {len(files)} files:")
            for file in files:
                source = file.get('source', 'unknown')
                name = file.get('originalName', 'unknown')
                print(f"   - {name} (source: {source})")
            
            # Check for live recordings specifically
            live_recordings = [f for f in files if f.get('source') == 'live_recording']
            print(f"🎤 Found {len(live_recordings)} live recordings")
            return True
        else:
            print(f"❌ Library endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Library test failed: {e}")
        return False

def check_vocals_directory():
    """Check the vocals directory structure"""
    vocals_dir = Path.home() / "Downloads" / "Vocals"
    print(f"📁 Vocals directory: {vocals_dir}")
    print(f"   Exists: {vocals_dir.exists()}")
    
    if vocals_dir.exists():
        subdirs = [d for d in vocals_dir.iterdir() if d.is_dir()]
        print(f"   Subdirectories: {len(subdirs)}")
        for subdir in subdirs[:5]:  # Show first 5
            print(f"     - {subdir.name}")

def main():
    print("🔍 Debug Live Recording Functionality")
    print("=" * 50)
    
    # Test 1: Backend connection
    print("\n1. Testing backend connection...")
    if not test_backend_connection():
        print("❌ Cannot proceed without backend running")
        return
    
    # Test 2: Library endpoint
    print("\n2. Testing library endpoint...")
    test_library_endpoint()
    
    # Test 3: Check file system
    print("\n3. Checking file system...")
    check_vocals_directory()
    
    print("\n✅ Debug completed")

if __name__ == "__main__":
    main()