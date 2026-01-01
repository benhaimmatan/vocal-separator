---
name: diagnose-audio-player
description: Diagnose audio player issues in Chord Analyzer
---

# Audio Player Diagnostic

Run this to diagnose why the audio player isn't working.

## Diagnostic Steps:

1. **Check if audio element exists**
   - Verify `<audio>` tag is rendered
   - Check if audioUrl is created correctly
   - Verify audioRef is attached

2. **Check audio file**
   - Verify file is uploaded successfully
   - Check file format is supported
   - Verify blob URL is created

3. **Check player controls**
   - Verify play button is visible
   - Check if click handlers are attached
   - Test if play() is being called

4. **Check browser console**
   - Look for autoplay policy errors
   - Check for CORS issues
   - Verify no JavaScript errors

## Common Issues:

### Issue 1: Autoplay Policy
**Symptoms**: Play button doesn't work on first click
**Solution**: User must interact with page first

### Issue 2: Audio not loaded
**Symptoms**: Duration shows 0:00, no progress
**Solution**: Check if audio file loaded correctly

### Issue 3: No audio controls visible
**Symptoms**: Can't see play/pause buttons
**Solution**: Check if ChordAnalyzer is rendering

### Issue 4: Audio element not created
**Symptoms**: audioUrl is null
**Solution**: Verify audioFile prop is passed correctly

## Quick Fix Test:

Add this to ChordAnalyzer.jsx to debug:
```javascript
useEffect(() => {
  console.log('Audio Debug:', {
    hasAudioFile: !!audioFile,
    audioUrl,
    hasAudioRef: !!audioRef.current,
    isPlaying,
    duration
  });
}, [audioFile, audioUrl, isPlaying, duration]);
```
