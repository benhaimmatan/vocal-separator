---
name: test-deployment
description: Automated testing of deployed Vocal Separator app
---

# Test Deployment Command

This command runs automated browser tests on the deployed Vocal Separator application to verify functionality after deployment.

## What it tests:

1. **Homepage Loading**
   - Verifies site is accessible
   - Checks for console errors
   - Takes screenshot

2. **Navigation**
   - Tests all nav buttons (Separator, Chords, Lyrics, Combined)
   - Verifies page transitions

3. **Chord Analyzer** (when audio file provided)
   - Uploads audio file
   - Waits for chord detection
   - Tests audio player controls (play/pause/stop)
   - Verifies chord display
   - Checks for errors

4. **Backend Connection**
   - Tests API endpoints
   - Verifies no connection errors

## Usage:

After any deployment, run:
```
Ask Claude: "Test the deployment"
```

Claude will automatically:
- Navigate to the live site
- Run all tests
- Report any issues found
- Take screenshots of problems
- Check browser console for errors

## Test Audio File:

For full chord analyzer testing, provide a test audio file path or use:
```
~/Downloads/test-audio.mp3
```

## What Claude Reports:

✅ **Pass**: Feature working correctly
❌ **Fail**: Issue found with details
⚠️ **Warning**: Non-critical issue

Claude will create a test report in `.playwright-mcp/test-report.md` with:
- Test results
- Screenshots
- Console errors
- Recommendations
