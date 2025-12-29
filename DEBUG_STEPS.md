# Debug Steps for Live Recording Issue

## Step 1: Restart Backend Server

**Kill existing processes:**
```bash
pkill -f "python.*main.py"
```

**Start backend server:**
```bash
cd /Users/matanbenhaim/vocal-separator/backend
python main.py
```

**Verify it's running:**
```bash
curl http://localhost:8000/api/ping
```

## Step 2: Check Browser Console

1. Open browser dev tools (F12)
2. Go to Console tab
3. Try recording live audio
4. Look for these messages:
   - `🎵 Sending to backend...`
   - `🎵 Backend response: {...}`
   - `✅ Recording saved to library: {...}`

## Step 3: Check Backend Logs

Look for these log messages in the backend console:
- `[live-audio] Starting live audio analysis, save_to_library: true`
- `[live-audio] Saved recording to library: ...`

## Step 4: Test Library Endpoint

```bash
curl http://localhost:8000/api/library
```

Look for files with `"source": "live_recording"`

## Step 5: Manual Test

Run this Python script to test the endpoint:
```bash
python test_backend_endpoint.py
```

## Step 6: Check File System

Check if files are being saved:
```bash
ls -la ~/Downloads/Vocals/
```

Look for UUID-named directories containing live recordings.

## Step 7: Frontend Library Refresh

Check if the library is being refreshed after recording:
1. Record audio in Live Capture
2. Immediately switch to Library tab
3. Check if you see "🎤 Live Recordings" section

## Common Issues

1. **Backend not running**: Start with `python backend/main.py`
2. **Wrong endpoint**: Should be `/api/analyze-live-audio`
3. **Missing parameter**: Frontend should send `save_to_library: 'true'`
4. **Library not refreshing**: Frontend should call `fetchLibrary()` after save
5. **File permissions**: Check if backend can write to ~/Downloads/Vocals/

## Expected Flow

1. User records audio → LiveAudioCapture
2. Audio sent to `/api/analyze-live-audio` with `save_to_library: true`
3. Backend saves file to ~/Downloads/Vocals/{uuid}/filename
4. Backend adds entry to processing_history.json with `"source": "live_recording"`
5. Frontend receives `saved_to_library: true` response
6. Frontend calls `onRecordingSaved()` → `fetchLibrary()`
7. Library and ChordFinder refresh with new data
8. User sees recording in both tabs