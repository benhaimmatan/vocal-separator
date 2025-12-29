# Live Recording Fix

## Problem
Live recordings were not appearing in the Library tab or Chord Finder tab after being recorded.

## Root Cause
The frontend components (Library and ChordFinder) only fetched library data when they were first mounted, but they didn't refresh when new live recordings were saved to the backend.

## Solution
Added a callback mechanism to refresh the library data after a live recording is successfully saved:

### 1. Modified LiveAudioCapture Component
- Added `onRecordingSaved?: () => void` prop to the interface
- Updated component to accept and use this callback
- Call the callback when `data.saved_to_library` is true

### 2. Modified App Component
- Pass the `fetchLibrary` function as the `onRecordingSaved` callback to LiveAudioCapture
- This ensures the library state is refreshed immediately after a recording is saved

## Files Changed
1. `frontend/src/components/LiveAudioCapture.tsx`
   - Added onRecordingSaved prop
   - Call callback when recording is saved to library

2. `frontend/src/App.tsx`
   - Pass fetchLibrary function to LiveAudioCapture component

## How It Works
1. User records audio in Live Capture tab
2. Audio is sent to backend with `save_to_library: 'true'`
3. Backend saves recording with `"source": "live_recording"` metadata
4. Frontend receives success response with `saved_to_library: true`
5. LiveAudioCapture calls `onRecordingSaved()` callback
6. App.tsx executes `fetchLibrary()` to refresh library data
7. Updated library data includes the new live recording
8. Library and ChordFinder tabs now show the live recording

## Testing
1. Start backend server: `python backend/main.py`
2. Start frontend: `npm run dev`
3. Navigate to Live Capture tab
4. Record some audio (10-30 seconds)
5. Check Library tab - should see "🎤 Live Recordings" section
6. Check Chord Finder tab - should see the recording in the file list

## Expected Result
- Live recordings appear in Library tab under "🎤 Live Recordings" section
- Live recordings appear in Chord Finder tab in the file list
- Live recordings have the same functionality as other audio files
- Recordings are automatically saved with timestamp-based filenames