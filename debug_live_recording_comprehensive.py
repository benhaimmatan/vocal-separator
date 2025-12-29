#!/usr/bin/env python3
"""
Comprehensive debug script for live recording issue
"""
import requests
import json
import os
import subprocess
import sys
import time
import signal
from pathlib import Path
from io import BytesIO

class LiveRecordingDebugger:
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.backend_dir = Path(__file__).parent / "backend"
        self.vocals_dir = Path.home() / "Downloads" / "Vocals"
        self.history_file = self.vocals_dir / "processing_history.json"
        
    def check_backend_running(self):
        """Check if backend is running"""
        try:
            response = requests.get(f"{self.base_url}/api/ping", timeout=5)
            if response.status_code == 200:
                print("✅ Backend server is running")
                return True
            else:
                print(f"❌ Backend server returned status {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Backend server not accessible: {e}")
            return False
    
    def start_backend_server(self):
        """Start the backend server"""
        print("🚀 Starting backend server...")
        
        if not self.backend_dir.exists():
            print(f"❌ Backend directory not found: {self.backend_dir}")
            return False
        
        try:
            # Change to backend directory
            os.chdir(str(self.backend_dir))
            
            # Start the server
            self.backend_process = subprocess.Popen([
                sys.executable, "main.py"
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            
            print(f"✅ Backend server started with PID: {self.backend_process.pid}")
            
            # Wait for server to start
            time.sleep(5)
            
            # Check if it's running
            if self.check_backend_running():
                print("🌟 Backend server is running successfully!")
                return True
            else:
                print("❌ Backend server failed to start properly")
                return False
                
        except Exception as e:
            print(f"❌ Error starting backend: {e}")
            return False
    
    def test_live_audio_endpoint(self):
        """Test the live audio endpoint"""
        print("🧪 Testing live audio endpoint...")
        
        try:
            # Create a small dummy audio file
            dummy_audio = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
            
            files = {
                'audio_file': ('test_recording.webm', BytesIO(dummy_audio), 'audio/webm')
            }
            
            data = {
                'save_to_library': 'true',
                'simplicity_preference': '0.5'
            }
            
            response = requests.post(f"{self.base_url}/api/analyze-live-audio", 
                                   files=files, data=data, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print("✅ Live audio endpoint works!")
                print(f"   saved_to_library: {result.get('saved_to_library', 'not found')}")
                
                if result.get('saved_to_library'):
                    print("✅ Recording was saved to library")
                    return True
                else:
                    print("❌ Recording was not saved to library")
                    return False
            else:
                print(f"❌ Live audio endpoint failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Live audio endpoint test failed: {e}")
            return False
    
    def check_library_contents(self):
        """Check library contents"""
        print("📚 Checking library contents...")
        
        try:
            response = requests.get(f"{self.base_url}/api/library", timeout=10)
            if response.status_code == 200:
                data = response.json()
                files = data.get('files', [])
                
                print(f"   Total files: {len(files)}")
                
                live_recordings = [f for f in files if f.get('source') == 'live_recording']
                print(f"   Live recordings: {len(live_recordings)}")
                
                if live_recordings:
                    print("   Live recordings found:")
                    for recording in live_recordings:
                        name = recording.get('originalName', 'unknown')
                        date = recording.get('dateProcessed', 'unknown')
                        print(f"     - {name} ({date})")
                    return True
                else:
                    print("   No live recordings found")
                    return False
                    
            else:
                print(f"❌ Library endpoint failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Library check failed: {e}")
            return False
    
    def check_file_system(self):
        """Check file system for recordings"""
        print("📁 Checking file system...")
        
        print(f"   Vocals directory: {self.vocals_dir}")
        print(f"   Exists: {self.vocals_dir.exists()}")
        
        if self.vocals_dir.exists():
            subdirs = [d for d in self.vocals_dir.iterdir() if d.is_dir()]
            print(f"   Subdirectories: {len(subdirs)}")
            
            # Check for recent directories (likely live recordings)
            recent_dirs = []
            for subdir in subdirs:
                try:
                    # Check if directory name is UUID-like
                    if len(subdir.name) == 36 and subdir.name.count('-') == 4:
                        recent_dirs.append(subdir)
                except:
                    continue
            
            print(f"   Potential recording directories: {len(recent_dirs)}")
            
            for recent_dir in recent_dirs[:5]:  # Show first 5
                files = list(recent_dir.glob('*'))
                print(f"     - {recent_dir.name}: {len(files)} files")
        
        print(f"   History file: {self.history_file}")
        print(f"   Exists: {self.history_file.exists()}")
        
        if self.history_file.exists():
            try:
                with open(self.history_file, 'r') as f:
                    history = json.load(f)
                    files = history.get('files', [])
                    live_recordings = [f for f in files if f.get('source') == 'live_recording']
                    print(f"   Live recordings in history: {len(live_recordings)}")
            except Exception as e:
                print(f"   Error reading history: {e}")
    
    def run_full_debug(self):
        """Run complete debug process"""
        print("🔍 Live Recording Debug Session")
        print("=" * 50)
        
        # Check if backend is running
        if not self.check_backend_running():
            print("\n🚀 Backend not running, starting it...")
            if not self.start_backend_server():
                print("❌ Failed to start backend server")
                return False
        
        print("\n1. Testing live audio endpoint...")
        endpoint_works = self.test_live_audio_endpoint()
        
        print("\n2. Checking library contents...")
        library_has_recordings = self.check_library_contents()
        
        print("\n3. Checking file system...")
        self.check_file_system()
        
        print("\n📊 Summary:")
        print(f"   Backend running: ✅")
        print(f"   Endpoint working: {'✅' if endpoint_works else '❌'}")
        print(f"   Library has recordings: {'✅' if library_has_recordings else '❌'}")
        
        if endpoint_works and library_has_recordings:
            print("\n🎉 Live recording functionality appears to be working!")
            print("   If you're not seeing recordings in the frontend, the issue may be:")
            print("   1. Frontend cache - try refreshing the page")
            print("   2. Library refresh - switch tabs to force reload")
            print("   3. Console errors - check browser dev tools")
        else:
            print("\n❌ Live recording functionality has issues")
            print("   Check the backend logs for more details")
        
        return endpoint_works and library_has_recordings

def main():
    debugger = LiveRecordingDebugger()
    
    try:
        debugger.run_full_debug()
    except KeyboardInterrupt:
        print("\n🛑 Debug session interrupted")
    except Exception as e:
        print(f"\n❌ Debug session failed: {e}")
    finally:
        # Clean up
        if hasattr(debugger, 'backend_process'):
            try:
                debugger.backend_process.terminate()
                debugger.backend_process.wait()
                print("🧹 Backend process terminated")
            except:
                pass

if __name__ == "__main__":
    main()