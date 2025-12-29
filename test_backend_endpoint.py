#!/usr/bin/env python3
"""
Test the live audio endpoint to see if it works
"""
import requests
import json
from io import BytesIO

def test_backend_connection():
    """Test if backend is running"""
    try:
        response = requests.get('http://localhost:8000/api/ping', timeout=5)
        print(f"✅ Backend ping: {response.json()}")
        return True
    except Exception as e:
        print(f"❌ Backend connection failed: {e}")
        return False

def test_live_audio_endpoint():
    """Test the live audio endpoint"""
    try:
        # Create a dummy audio file for testing
        dummy_audio = b"dummy audio data"
        files = {
            'audio_file': ('test.webm', BytesIO(dummy_audio), 'audio/webm')
        }
        data = {
            'save_to_library': 'true',
            'simplicity_preference': '0.5'
        }
        
        print("Testing live audio endpoint...")
        response = requests.post('http://localhost:8000/api/analyze-live-audio', 
                               files=files, data=data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Live audio endpoint works!")
            print(f"   Response: {json.dumps(result, indent=2)}")
            return True
        else:
            print(f"❌ Live audio endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Live audio endpoint test failed: {e}")
        return False

def check_library():
    """Check what's in the library"""
    try:
        response = requests.get('http://localhost:8000/api/library', timeout=10)
        if response.status_code == 200:
            data = response.json()
            files = data.get('files', [])
            print(f"📚 Library contains {len(files)} files:")
            for file in files:
                source = file.get('source', 'unknown')
                name = file.get('originalName', 'unknown')
                print(f"   - {name} (source: {source})")
            return True
        else:
            print(f"❌ Library check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Library check failed: {e}")
        return False

def main():
    print("🔍 Testing Backend Live Audio Endpoint")
    print("=" * 50)
    
    if not test_backend_connection():
        print("❌ Backend not running. Please start it first.")
        return
    
    print("\n1. Testing live audio endpoint...")
    test_live_audio_endpoint()
    
    print("\n2. Checking library contents...")
    check_library()

if __name__ == "__main__":
    main()