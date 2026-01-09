---
title: Vocal Separator
emoji: 🎵
colorFrom: indigo
colorTo: purple
sdk: docker
pinned: false
license: mit
---

# Vocal Separator & Music Analysis

A modern audio processing tool for separating vocals, detecting chords, and fetching lyrics.

## Features

- **Vocal Separation** - Extract vocals and accompaniment from any audio file
- **Chord Detection** - Detect chord progressions with timestamps
- **Lyrics Search** - Find lyrics for any song
- **YouTube Integration** - Search and analyze YouTube videos directly
- **Combined Analysis** - View lyrics with chord annotations

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: FastAPI + Python
- **Audio Processing**: Demucs, Librosa, Essentia

## Configuration (YouTube Features)

### YouTube Search (Requires API Key)

To enable YouTube search, you need to set up a YouTube API key:

1. Get your API key from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Enable the YouTube Data API v3 for your project
3. In HuggingFace Spaces settings, add the environment variable:
   ```
   YOUTUBE_API_KEY=your_api_key_here
   ```

### ⚠️ YouTube Download Limitations

**Important**: HuggingFace Spaces may have network restrictions that block direct YouTube downloads (DNS resolution errors). If you encounter errors when analyzing YouTube videos:

- **Workaround**: Upload your audio file directly using the file upload feature
- **Alternative**: Use the app locally where YouTube downloads work without restrictions

The YouTube search functionality works fine, but video download/analysis may fail due to platform networking policies.


# Updated Jan 3 2026: YouTube Integration - Search and analyze YouTube videos directly (v2.3)
# Updated Jan 2 23:30:00 IST 2026: Cleaned UI - removed advanced settings panel and timeline table (v2.2)
